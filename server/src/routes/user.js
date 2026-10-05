import { Router } from 'express';
import { one, q, tx } from '../db.js';
import { assertFeature, requireFeature } from '../lib/auth.js';
import { loadOrders } from '../lib/freight.js';
import { h, HttpError, idParam, like, parse, v } from '../lib/http.js';
import { seatNumbers } from '../lib/layout.js';
import { addPoints, spendPoints } from '../lib/points.js';
import { cancelReservation, heldSeats } from '../lib/seats.js';
import { getSettings, pointsForAmount } from '../lib/settings.js';

// User Side. Every logged-in account may come here; the feature table decides what each tier can use.
const router = Router();

// ---------------------------------------------------------------------------
// Order Bus Seat
// ---------------------------------------------------------------------------

const TRIP_SQL = `
  SELECT t.id, t.status, t.direction, t.departure_at, t.eta, t.fare, t.seat_count,
         b.bus_number, b.model, r.name AS route,
         dp.name AS departure_park, ap.name AS arrival_park,
         (SELECT COUNT(*) FROM seat_reservations s WHERE s.trip_id = t.id AND s.active = 1) AS taken
  FROM trips t
  JOIN buses b ON b.id = t.bus_id
  JOIN routes r ON r.id = t.route_id
  JOIN parks dp ON dp.id = t.departure_park_id
  JOIN parks ap ON ap.id = t.arrival_park_id`;

router.get(
  '/trips',
  requireFeature('bus_seat_order'),
  h(async (req, res) => {
    res.json(await q(`${TRIP_SQL} WHERE t.status = 'preparing' AND r.name LIKE ? ORDER BY t.departure_at LIMIT 100`, [like(req.query.route)]));
  })
);

router.get(
  '/trips/:id',
  requireFeature('bus_seat_order'),
  h(async (req, res) => {
    const tripId = idParam(req);
    const trip = await one(`${TRIP_SQL} WHERE t.id = ?`, [tripId]);
    if (!trip) throw new HttpError(404, 'Trip not found.');

    const [{ layout }, held, settings] = await Promise.all([
      one('SELECT layout FROM trips WHERE id = ?', [tripId]),
      heldSeats(tripId),
      getSettings(),
    ]);
    // Other passengers' phone numbers are never sent to a user, only whether the seat is taken.
    const seats = Object.fromEntries(held.map((s) => [s.seat, { status: s.status, mine: s.user_id === req.user.id }]));
    res.json({ ...trip, layout: JSON.parse(layout), seats, point_cost: pointsForAmount(trip.fare, settings) });
  })
);

router.post(
  '/trips/:id/reserve',
  requireFeature('bus_seat_order'),
  h(async (req, res) => {
    const tripId = idParam(req);
    const body = parse(req.body, { seat: v.str(10), phone: v.phone(), use_points: v.bool() });
    if (body.use_points) await assertFeature(req.user, 'pay_with_points');

    const result = await tx(async (conn) => {
      // Locking the trip row makes reservations for one bus happen one at a time.
      const trip = await one('SELECT id, status, fare, layout FROM trips WHERE id = ? FOR UPDATE', [tripId], conn);
      if (!trip) throw new HttpError(404, 'Trip not found.');
      if (trip.status !== 'preparing') throw new HttpError(409, 'This bus is no longer taking reservations.');
      if (!seatNumbers(JSON.parse(trip.layout)).includes(body.seat)) throw new HttpError(400, 'That seat does not exist on this bus.');

      const settings = await getSettings(conn);
      const mine = await one('SELECT COUNT(*) AS n FROM seat_reservations WHERE trip_id = ? AND user_id = ? AND active = 1', [tripId, req.user.id], conn);
      if (mine.n >= settings.max_seats_per_trip) {
        throw new HttpError(400, `You can reserve at most ${settings.max_seats_per_trip} seats on one bus.`);
      }

      const used = body.use_points ? pointsForAmount(trip.fare, settings) : 0;
      const earned = body.use_points ? 0 : settings.points_per_seat_order;
      let inserted;
      try {
        inserted = await q(
          'INSERT INTO seat_reservations (trip_id, seat, user_id, phone, points_used, points_earned) VALUES (?, ?, ?, ?, ?, ?)',
          [tripId, body.seat, req.user.id, body.phone, used, earned],
          conn
        );
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'That seat was just taken. Please choose another seat.');
        throw err;
      }
      await spendPoints(conn, req.user.id, used, 'seat_payment', inserted.insertId);
      await addPoints(conn, req.user.id, earned, 'seat_order', inserted.insertId);
      return { id: inserted.insertId, points_used: used, points_earned: earned };
    });
    res.status(201).json(result);
  })
);

router.get(
  '/reservations',
  h(async (req, res) => {
    res.json(
      await q(
        `SELECT s.id, s.seat, s.phone, s.status, s.points_used, s.points_earned, s.created_at,
                t.id AS trip_id, t.status AS trip_status, t.departure_at, t.eta, t.fare,
                b.bus_number, r.name AS route, dp.name AS departure_park, ap.name AS arrival_park
         FROM seat_reservations s
         JOIN trips t ON t.id = s.trip_id
         JOIN buses b ON b.id = t.bus_id
         JOIN routes r ON r.id = t.route_id
         JOIN parks dp ON dp.id = t.departure_park_id
         JOIN parks ap ON ap.id = t.arrival_park_id
         WHERE s.user_id = ? ORDER BY s.id DESC LIMIT 200`,
        [req.user.id]
      )
    );
  })
);

router.post(
  '/reservations/:id/cancel',
  h(async (req, res) => {
    const id = idParam(req);
    await tx(async (conn) => {
      const reservation = await one(
        `SELECT s.id, s.user_id, s.status, s.points_used, s.points_earned, t.status AS trip_status
         FROM seat_reservations s JOIN trips t ON t.id = s.trip_id
         WHERE s.id = ? AND s.user_id = ? FOR UPDATE`,
        [id, req.user.id],
        conn
      );
      if (!reservation) throw new HttpError(404, 'Reservation not found.');
      if (reservation.status !== 'reserved' || reservation.trip_status !== 'preparing') {
        throw new HttpError(409, 'This reservation can no longer be cancelled.');
      }
      await cancelReservation(conn, reservation);
    });
    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------------------
// Route search and bus search
// ---------------------------------------------------------------------------

const BUS_SQL = `
  SELECT b.id, b.bus_number, b.model, b.fare, b.seat_count, b.departure_time, b.note, b.status, b.status_at,
         r.name AS route, pa.name AS park_a, pb.name AS park_b,
         g.name AS guard_name, g.phone AS guard_phone,
         COALESCE(f.rating, 0) AS rating, COALESCE(f.ratings, 0) AS ratings
  FROM buses b
  JOIN users g ON g.id = b.guard_id
  LEFT JOIN routes r ON r.id = b.route_id
  LEFT JOIN parks pa ON pa.id = r.park_a_id
  LEFT JOIN parks pb ON pb.id = r.park_b_id
  LEFT JOIN (SELECT guard_id, AVG(stars) AS rating, COUNT(*) AS ratings FROM guard_feedback GROUP BY guard_id) f
         ON f.guard_id = b.guard_id`;

async function remember(userId, kind, query) {
  if (query) await q('INSERT INTO search_history (user_id, kind, query) VALUES (?, ?, ?)', [userId, kind, query.slice(0, 150)]);
}

router.get(
  '/route-search',
  requireFeature('route_search'),
  h(async (req, res) => {
    const text = String(req.query.q ?? '').trim();
    await remember(req.user.id, 'route', text);
    // Best-rated guard first; a guard with more ratings wins a tie.
    res.json(await q(`${BUS_SQL} WHERE r.name LIKE ? ORDER BY rating DESC, ratings DESC, b.bus_number LIMIT 100`, [like(text)]));
  })
);

router.get(
  '/bus-search',
  requireFeature('bus_search'),
  h(async (req, res) => {
    const text = String(req.query.number ?? '').trim();
    if (!text) return res.json([]);
    await remember(req.user.id, 'bus', text);

    const buses = await q(`${BUS_SQL} WHERE b.bus_number LIKE ? ORDER BY b.bus_number LIMIT 20`, [like(text)]);
    if (buses.length === 0) return res.json([]);

    // The latest trip of each bus carries its parks, departure time and forecast arrival.
    const trips = await q(
      `SELECT t.bus_id, t.status, t.direction, t.departure_at, t.departed_at, t.eta, t.arrived_at,
              dp.name AS departure_park, ap.name AS arrival_park
       FROM trips t
       JOIN parks dp ON dp.id = t.departure_park_id
       JOIN parks ap ON ap.id = t.arrival_park_id
       WHERE t.id IN (SELECT MAX(id) FROM trips WHERE bus_id IN (?) AND status <> 'cancelled' GROUP BY bus_id)`,
      [buses.map((bus) => bus.id)]
    );
    res.json(buses.map((bus) => ({ ...bus, trip: trips.find((trip) => trip.bus_id === bus.id) ?? null })));
  })
);

router.get(
  '/search-history',
  h(async (req, res) => {
    const kind = req.query.kind === 'bus' ? 'bus' : 'route';
    res.json(
      await q(
        `SELECT query, MAX(created_at) AS created_at FROM search_history
         WHERE user_id = ? AND kind = ? GROUP BY query ORDER BY created_at DESC LIMIT 20`,
        [req.user.id, kind]
      )
    );
  })
);

// ---------------------------------------------------------------------------
// Freight orders (urban and long distance)
// ---------------------------------------------------------------------------

const ORDER_SPEC = {
  type: v.oneOf('urban', 'long'),
  sender_name: v.str(100),
  sender_phone: v.phone(),
  sender_phone2: v.opt(v.phone()),
  departure_address: v.str(255),
  departure_features: v.str(255, 0),
  receiver_name: v.str(100),
  receiver_phone: v.phone(),
  destination_address: v.str(255),
  cars_count: v.int(1, 50),
  urgent: v.bool(),
  car_arrive_at: v.datetime(),
  note: v.str(1000, 0),
};

const LONG_SPEC = {
  claim_condition: v.oneOf('direct', 'delivery'),
  payment_target: v.oneOf('sender', 'receiver'),
  origin_warehouse_id: v.int(1),
  dest_warehouse_id: v.int(1),
};

const ITEM_SPEC = {
  name: v.str(150),
  height: v.num(0, 100000),
  width: v.num(0, 100000),
  weight: v.num(0, 10000000),
  count: v.int(1, 100000),
};

router.post(
  '/freight',
  h(async (req, res) => {
    const order = parse(req.body, ORDER_SPEC);
    await assertFeature(req.user, order.type === 'urban' ? 'urban_freight' : 'long_freight');
    order.sender_phone2 ??= '';

    if (order.type === 'long') {
      Object.assign(order, parse(req.body, LONG_SPEC));
      const found = await q('SELECT id FROM warehouses WHERE id IN (?)', [[order.origin_warehouse_id, order.dest_warehouse_id]]);
      const ids = found.map((w) => w.id);
      if (!ids.includes(order.origin_warehouse_id) || !ids.includes(order.dest_warehouse_id)) {
        throw new HttpError(400, 'Please choose the departure and destination warehouses.');
      }
    }

    const rows = req.body?.items;
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 30) {
      throw new HttpError(400, 'Add 1 to 30 freight rows to the order.');
    }
    const items = rows.map((row) => parse(row, ITEM_SPEC));

    const id = await tx(async (conn) => {
      const inserted = await q('INSERT INTO freight_orders SET ?', [{ ...order, user_id: req.user.id }], conn);
      await q('INSERT INTO freight_items (order_id, name, height, width, weight, count) VALUES ?', [
        items.map((item) => [inserted.insertId, item.name, item.height, item.width, item.weight, item.count]),
      ], conn);
      return inserted.insertId;
    });
    res.status(201).json({ id });
  })
);

// Orders this account sent, plus orders addressed to this account's phone number.
router.get(
  '/freight',
  h(async (req, res) => {
    const type = ['urban', 'long'].includes(req.query.type) ? req.query.type : null;
    const settings = await getSettings();
    const orders = await loadOrders('(o.user_id = ? OR o.receiver_phone = ?) AND (? IS NULL OR o.type = ?)', [
      req.user.id,
      req.user.phone,
      type,
      type,
    ]);
    res.json(
      orders.map((order) => ({
        ...order,
        party: order.user_id === req.user.id ? 'sender' : 'receiver',
        point_cost: order.charge === null ? null : pointsForAmount(order.charge, settings),
      }))
    );
  })
);

router.post(
  '/freight/:id/cancel',
  h(async (req, res) => {
    const result = await q("UPDATE freight_orders SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status = 'pending'", [
      idParam(req),
      req.user.id,
    ]);
    if (result.affectedRows === 0) throw new HttpError(409, 'Only your own order that is still pending can be cancelled.');
    res.json({ ok: true });
  })
);

router.post(
  '/freight/:id/pay-points',
  requireFeature('pay_with_points'),
  h(async (req, res) => {
    const id = idParam(req);
    const used = await tx(async (conn) => {
      const order = await one(
        'SELECT id, status, charge, payment_status FROM freight_orders WHERE id = ? AND (user_id = ? OR receiver_phone = ?) FOR UPDATE',
        [id, req.user.id, req.user.phone],
        conn
      );
      if (!order) throw new HttpError(404, 'Order not found.');
      if (order.charge === null || !['accepted', 'departed', 'arrived'].includes(order.status)) {
        throw new HttpError(409, 'This order has no charge to pay yet.');
      }
      if (order.payment_status !== 'unpaid') throw new HttpError(409, 'This order is already paid.');

      const cost = pointsForAmount(order.charge, await getSettings(conn));
      await spendPoints(conn, req.user.id, cost, 'freight_payment', id);
      await q("UPDATE freight_orders SET payment_status = 'points', points_used = ? WHERE id = ?", [cost, id], conn);
      return cost;
    });
    res.json({ points_used: used });
  })
);

// ---------------------------------------------------------------------------
// Feedback about the guard
// ---------------------------------------------------------------------------

// A user may rate a guard once per trip they held a seat on, after the bus has left.
const RATEABLE_SQL = `
  FROM seat_reservations s
  JOIN trips t ON t.id = s.trip_id
  JOIN buses b ON b.id = t.bus_id
  JOIN routes r ON r.id = t.route_id
  JOIN users g ON g.id = t.guard_id
  LEFT JOIN guard_feedback f ON f.trip_id = t.id AND f.user_id = s.user_id
  WHERE s.user_id = ? AND s.active = 1 AND t.status IN ('departed', 'arrived') AND f.id IS NULL`;

router.get(
  '/feedback/pending',
  requireFeature('guard_feedback'),
  h(async (req, res) => {
    res.json(
      await q(
        `SELECT DISTINCT t.id AS trip_id, t.departure_at, t.status, b.bus_number, r.name AS route, g.name AS guard_name
         ${RATEABLE_SQL} ORDER BY t.departure_at DESC LIMIT 50`,
        [req.user.id]
      )
    );
  })
);

router.post(
  '/feedback',
  requireFeature('guard_feedback'),
  h(async (req, res) => {
    const body = parse(req.body, { trip_id: v.int(1), stars: v.int(1, 5), comment: v.str(1000, 0) });
    const trip = await one(`SELECT t.id, t.guard_id ${RATEABLE_SQL} AND t.id = ? LIMIT 1`, [req.user.id, body.trip_id]);
    if (!trip) throw new HttpError(409, 'You can rate a guard once, after riding the bus.');
    await q('INSERT INTO guard_feedback (guard_id, user_id, trip_id, stars, comment) VALUES (?, ?, ?, ?, ?)', [
      trip.guard_id,
      req.user.id,
      trip.id,
      body.stars,
      body.comment,
    ]);
    res.status(201).json({ ok: true });
  })
);

router.get(
  '/feedback',
  h(async (req, res) => {
    res.json(
      await q(
        `SELECT f.id, f.stars, f.comment, f.created_at, g.name AS guard_name, b.bus_number, r.name AS route, t.departure_at
         FROM guard_feedback f
         JOIN users g ON g.id = f.guard_id
         JOIN trips t ON t.id = f.trip_id
         JOIN buses b ON b.id = t.bus_id
         JOIN routes r ON r.id = t.route_id
         WHERE f.user_id = ? ORDER BY f.id DESC LIMIT 100`,
        [req.user.id]
      )
    );
  })
);

// ---------------------------------------------------------------------------
// Applying to become a guard, truck driver or warehouse manager
// ---------------------------------------------------------------------------

const APPLICATION_SPECS = {
  guard: { bus_number: v.str(30), model: v.str(100, 0), route_id: v.int(1), fare: v.num(0) },
  driver: { plate_number: v.str(30), model: v.str(100, 0), capacity_tons: v.num(0, 1000) },
  warehouse: { warehouse_id: v.int(1) },
};

router.get(
  '/applications',
  h(async (req, res) => {
    res.json(await q('SELECT id, role, data, status, admin_note, created_at, decided_at FROM role_applications WHERE user_id = ? ORDER BY id DESC', [req.user.id]));
  })
);

router.post(
  '/applications',
  h(async (req, res) => {
    const { role } = parse(req.body, { role: v.oneOf('guard', 'driver', 'warehouse') });
    if (req.user.role !== 'user') throw new HttpError(409, 'Your account already has a role.');
    const data = parse(req.body, APPLICATION_SPECS[role]);

    const pending = await one("SELECT id FROM role_applications WHERE user_id = ? AND status = 'pending'", [req.user.id]);
    if (pending) throw new HttpError(409, 'You already have an application waiting for the admin.');

    await q('INSERT INTO role_applications (user_id, role, data) VALUES (?, ?, ?)', [req.user.id, role, JSON.stringify(data)]);
    res.status(201).json({ ok: true });
  })
);

export default router;
