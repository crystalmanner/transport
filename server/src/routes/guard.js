import { Router } from 'express';
import { one, q, tx } from '../db.js';
import { requireRole, requireSubscription } from '../lib/auth.js';
import { h, HttpError, idParam, parse, v } from '../lib/http.js';
import { defaultLayout, normalizeLayout, seatNumbers } from '../lib/layout.js';
import { cancelReservation, heldSeats } from '../lib/seats.js';

// Guard Side: the conductor of one bus. Needs the guard role and a paid subscription.
const router = Router();
router.use(requireRole('guard'), requireSubscription);

const BUS_SPEC = {
  bus_number: v.str(30),
  model: v.str(100, 0),
  route_id: v.int(1),
  fare: v.num(0),
  departure_time: v.str(50, 0),
  note: v.str(255, 0),
};

async function myBus(guardId, conn) {
  const bus = await one('SELECT * FROM buses WHERE guard_id = ?', [guardId], conn);
  if (!bus) throw new HttpError(409, 'Register your bus first.', 'NO_BUS');
  return bus;
}

async function getRoute(routeId, conn) {
  const route = await one('SELECT id, park_a_id, park_b_id, duration_minutes FROM routes WHERE id = ?', [routeId], conn);
  if (!route) throw new HttpError(400, 'Please choose a route.');
  return route;
}

async function assertPark(parkId, conn) {
  if (!(await one('SELECT id FROM parks WHERE id = ?', [parkId], conn))) throw new HttpError(400, 'Please choose a park.');
}

// The far end of the route from where the bus leaves.
function arrivalParkOf(route, departureParkId, direction) {
  if (departureParkId === route.park_a_id) return route.park_b_id;
  if (departureParkId === route.park_b_id) return route.park_a_id;
  return direction === 'return' ? route.park_a_id : route.park_b_id;
}

// ---------------------------------------------------------------------------
// The bus and its seat design
// ---------------------------------------------------------------------------

router.get(
  '/bus',
  h(async (req, res) => {
    const bus = await one(
      'SELECT b.*, r.name AS route FROM buses b LEFT JOIN routes r ON r.id = b.route_id WHERE b.guard_id = ?',
      [req.user.id]
    );
    // Wrapped in an object so "no bus yet" ({ bus: null }) differs from an empty answer.
    res.json({ bus: bus && { ...bus, layout: JSON.parse(bus.layout) } });
  })
);

router.put(
  '/bus',
  h(async (req, res) => {
    const body = parse(req.body, BUS_SPEC);
    await getRoute(body.route_id);
    try {
      const existing = await one('SELECT id FROM buses WHERE guard_id = ?', [req.user.id]);
      if (existing) {
        await q('UPDATE buses SET ? WHERE id = ?', [body, existing.id]);
      } else {
        const { layout, seatCount } = defaultLayout();
        await q('INSERT INTO buses SET ?', [{ ...body, guard_id: req.user.id, layout: JSON.stringify(layout), seat_count: seatCount }]);
      }
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Another bus already uses this bus number.');
      throw err;
    }
    res.json({ ok: true });
  })
);

router.put(
  '/bus/layout',
  h(async (req, res) => {
    const { layout, seatCount } = normalizeLayout(req.body?.layout);
    const bus = await myBus(req.user.id);
    const json = JSON.stringify(layout);
    await q('UPDATE buses SET layout = ?, seat_count = ? WHERE id = ?', [json, seatCount, bus.id]);
    // A trip that is open but has sold nothing yet takes the new design; a trip with sold seats keeps its own copy.
    const updated = await q(
      `UPDATE trips SET layout = ?, seat_count = ?
       WHERE bus_id = ? AND status = 'preparing'
         AND NOT EXISTS (SELECT 1 FROM seat_reservations s WHERE s.trip_id = trips.id AND s.active = 1)`,
      [json, seatCount, bus.id]
    );
    res.json({ seat_count: seatCount, applied_to_open_trip: updated.affectedRows > 0 });
  })
);

// ---------------------------------------------------------------------------
// Route Operation Information
// ---------------------------------------------------------------------------

const OPEN_TRIP_SQL = `
  SELECT t.id, t.status, t.direction, t.route_id, t.departure_park_id, t.arrival_park_id,
         t.departure_at, t.departed_at, t.eta, t.seat_count,
         r.name AS route, dp.name AS departure_park, ap.name AS arrival_park,
         (SELECT COUNT(*) FROM seat_reservations s WHERE s.trip_id = t.id AND s.active = 1) AS taken
  FROM trips t
  JOIN routes r ON r.id = t.route_id
  JOIN parks dp ON dp.id = t.departure_park_id
  JOIN parks ap ON ap.id = t.arrival_park_id`;

router.get(
  '/status',
  h(async (req, res) => {
    const bus = await one(
      `SELECT b.id, b.bus_number, b.model, b.route_id, b.fare, b.departure_time, b.note, b.seat_count, b.status, b.status_at,
              r.name AS route
       FROM buses b LEFT JOIN routes r ON r.id = b.route_id WHERE b.guard_id = ?`,
      [req.user.id]
    );
    const trip = bus && (await one(`${OPEN_TRIP_SQL} WHERE t.bus_id = ? AND t.status IN ('preparing', 'departed') ORDER BY t.id DESC LIMIT 1`, [bus.id]));
    res.json({ bus, trip });
  })
);

router.post(
  '/status',
  h(async (req, res) => {
    const { status } = parse(req.body, { status: v.oneOf('preparing', 'departed', 'arrived') });

    await tx(async (conn) => {
      const bus = await myBus(req.user.id, conn);
      const open = await one(
        "SELECT * FROM trips WHERE bus_id = ? AND status IN ('preparing', 'departed') ORDER BY id DESC LIMIT 1 FOR UPDATE",
        [bus.id],
        conn
      );
      const report = { bus_id: bus.id, guard_id: req.user.id, status };

      if (status === 'preparing') {
        // Opens a trip that users can reserve seats on. Sending it again corrects the open trip.
        const body = parse(req.body, {
          departure_park_id: v.int(1),
          route_id: v.opt(v.int(1)),
          direction: v.oneOf('outbound', 'return'),
          departure_at: v.datetime(),
        });
        if (open?.status === 'departed') {
          throw new HttpError(409, 'The bus is on the road. Send "Arrived" before preparing the next trip.');
        }
        await assertPark(body.departure_park_id, conn);
        const route = await getRoute(body.route_id ?? bus.route_id, conn);
        const trip = {
          route_id: route.id,
          direction: body.direction,
          departure_park_id: body.departure_park_id,
          arrival_park_id: arrivalParkOf(route, body.departure_park_id, body.direction),
          departure_at: body.departure_at,
        };
        if (open) {
          await q('UPDATE trips SET ? WHERE id = ?', [trip, open.id], conn);
          report.trip_id = open.id;
        } else {
          const inserted = await q(
            'INSERT INTO trips SET ?',
            [{ ...trip, bus_id: bus.id, guard_id: req.user.id, fare: bus.fare, layout: bus.layout, seat_count: bus.seat_count }],
            conn
          );
          report.trip_id = inserted.insertId;
        }
        await q('UPDATE trips SET eta = departure_at + INTERVAL ? MINUTE WHERE id = ?', [route.duration_minutes, report.trip_id], conn);
        Object.assign(report, { park_id: trip.departure_park_id, route_id: route.id, direction: trip.direction, reported_at: trip.departure_at });
      }

      if (status === 'departed') {
        const body = parse(req.body, { departure_park_id: v.int(1), route_id: v.int(1), departure_at: v.datetime() });
        if (open?.status === 'departed') throw new HttpError(409, 'This trip has already departed. Send "Arrived" next.');
        await assertPark(body.departure_park_id, conn);
        const route = await getRoute(body.route_id, conn);
        const direction = open?.direction ?? (body.departure_park_id === route.park_b_id ? 'return' : 'outbound');
        const trip = {
          route_id: route.id,
          direction,
          departure_park_id: body.departure_park_id,
          arrival_park_id: arrivalParkOf(route, body.departure_park_id, direction),
          departed_at: body.departure_at,
          status: 'departed',
        };
        if (open) {
          await q('UPDATE trips SET ? WHERE id = ?', [trip, open.id], conn);
          report.trip_id = open.id;
        } else {
          // The guard skipped "Preparing": record the trip anyway so the bus can be tracked.
          const inserted = await q(
            'INSERT INTO trips SET ?',
            [{ ...trip, departure_at: body.departure_at, bus_id: bus.id, guard_id: req.user.id, fare: bus.fare, layout: bus.layout, seat_count: bus.seat_count }],
            conn
          );
          report.trip_id = inserted.insertId;
        }
        // The forecast now counts from the real departure time.
        await q('UPDATE trips SET eta = departed_at + INTERVAL ? MINUTE WHERE id = ?', [route.duration_minutes, report.trip_id], conn);
        Object.assign(report, { park_id: trip.departure_park_id, route_id: route.id, direction, reported_at: body.departure_at });
      }

      if (status === 'arrived') {
        const body = parse(req.body, { arrival_park_id: v.int(1), arrived_at: v.datetime() });
        if (open?.status !== 'departed') throw new HttpError(409, 'Send "Departed" before "Arrived".');
        await assertPark(body.arrival_park_id, conn);
        await q("UPDATE trips SET status = 'arrived', arrival_park_id = ?, arrived_at = ? WHERE id = ?", [body.arrival_park_id, body.arrived_at, open.id], conn);
        Object.assign(report, { trip_id: open.id, park_id: body.arrival_park_id, route_id: open.route_id, direction: open.direction, reported_at: body.arrived_at });
      }

      await q('INSERT INTO bus_status_reports SET ?', [report], conn);
      await q('UPDATE buses SET status = ?, status_at = NOW() WHERE id = ?', [status, bus.id], conn);
    });
    res.status(201).json({ ok: true });
  })
);

router.get(
  '/status/history',
  h(async (req, res) => {
    res.json(
      await q(
        `SELECT s.id, s.status, s.direction, s.reported_at, s.created_at, p.name AS park, r.name AS route
         FROM bus_status_reports s
         LEFT JOIN parks p ON p.id = s.park_id
         LEFT JOIN routes r ON r.id = s.route_id
         WHERE s.guard_id = ? ORDER BY s.id DESC LIMIT 100`,
        [req.user.id]
      )
    );
  })
);

// ---------------------------------------------------------------------------
// Operate Daily Report
// ---------------------------------------------------------------------------

const count = v.int(0, 1000000);

router.post(
  '/reports',
  h(async (req, res) => {
    const body = parse(req.body, {
      route_id: v.int(1),
      direction: v.oneOf('outbound', 'return'),
      departure_date: v.date(),
      passengers_count: count,
      repeat_time_count: count,
      repeat_date_count: count,
      deferred_count: count,
      free_count: count,
      count1: count,
      count2: count,
      count3: count,
    });
    await getRoute(body.route_id);
    const bus = await one('SELECT id FROM buses WHERE guard_id = ?', [req.user.id]);
    await q('INSERT INTO guard_daily_reports SET ?', [{ ...body, guard_id: req.user.id, bus_id: bus?.id ?? null }]);
    res.status(201).json({ ok: true });
  })
);

router.get(
  '/reports',
  h(async (req, res) => {
    res.json(
      await q(
        `SELECT d.*, r.name AS route FROM guard_daily_reports d JOIN routes r ON r.id = d.route_id
         WHERE d.guard_id = ? ORDER BY d.id DESC LIMIT 100`,
        [req.user.id]
      )
    );
  })
);

// ---------------------------------------------------------------------------
// Status of Order: who sits where
// ---------------------------------------------------------------------------

router.get(
  '/trips',
  h(async (req, res) => {
    res.json(await q(`${OPEN_TRIP_SQL} WHERE t.guard_id = ? ORDER BY t.id DESC LIMIT 30`, [req.user.id]));
  })
);

router.get(
  '/trips/:id',
  h(async (req, res) => {
    const tripId = idParam(req);
    const trip = await one(`${OPEN_TRIP_SQL} WHERE t.id = ? AND t.guard_id = ?`, [tripId, req.user.id]);
    if (!trip) throw new HttpError(404, 'Trip not found.');
    const [{ layout }, held] = await Promise.all([one('SELECT layout FROM trips WHERE id = ?', [tripId]), heldSeats(tripId)]);
    const seats = Object.fromEntries(held.map((s) => [s.seat, { status: s.status, phone: s.phone, name: s.name, paid_with_points: s.points_used > 0 }]));
    res.json({ ...trip, layout: JSON.parse(layout), seats });
  })
);

// occupy: a passenger is sitting there (boards a reservation, or seats a walk-in). free: empty the seat.
router.post(
  '/trips/:id/seats',
  h(async (req, res) => {
    const tripId = idParam(req);
    const body = parse(req.body, { seat: v.str(10), action: v.oneOf('occupy', 'free'), phone: v.opt(v.phone()) });

    await tx(async (conn) => {
      const trip = await one('SELECT id, status, layout FROM trips WHERE id = ? AND guard_id = ? FOR UPDATE', [tripId, req.user.id], conn);
      if (!trip) throw new HttpError(404, 'Trip not found.');
      if (!['preparing', 'departed'].includes(trip.status)) throw new HttpError(409, 'This trip is finished.');
      if (!seatNumbers(JSON.parse(trip.layout)).includes(body.seat)) throw new HttpError(400, 'That seat does not exist on this bus.');

      const held = await one(
        'SELECT id, user_id, status, points_used, points_earned FROM seat_reservations WHERE trip_id = ? AND seat = ? AND active = 1',
        [tripId, body.seat],
        conn
      );
      if (body.action === 'free') {
        if (held) await cancelReservation(conn, held);
      } else if (held) {
        await q("UPDATE seat_reservations SET status = 'occupied' WHERE id = ?", [held.id], conn);
      } else {
        await q("INSERT INTO seat_reservations (trip_id, seat, phone, status) VALUES (?, ?, ?, 'occupied')", [tripId, body.seat, body.phone ?? ''], conn);
      }
    });
    res.json({ ok: true });
  })
);

router.get(
  '/feedback',
  h(async (req, res) => {
    const [summary, list] = await Promise.all([
      one('SELECT COALESCE(AVG(stars), 0) AS rating, COUNT(*) AS ratings FROM guard_feedback WHERE guard_id = ?', [req.user.id]),
      q('SELECT id, stars, comment, created_at FROM guard_feedback WHERE guard_id = ? ORDER BY id DESC LIMIT 100', [req.user.id]),
    ]);
    res.json({ ...summary, list });
  })
);

export default router;
