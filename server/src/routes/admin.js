import { Router } from 'express';
import { one, q, tx } from '../db.js';
import { hashPassword } from '../lib/auth.js';
import { decideOrder, loadOrders, markArrived, markDeparted, markPaidCash } from '../lib/freight.js';
import { h, HttpError, idParam, like, parse, v } from '../lib/http.js';
import { defaultLayout } from '../lib/layout.js';
import { addPoints } from '../lib/points.js';
import { getSettings, SETTING_DEFAULTS } from '../lib/settings.js';
import masterRouter from './adminMaster.js';

// Admin: the "manager". Mounted behind requireRole('admin') in app.js.
const router = Router();
router.use(masterRouter);

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

const DAYS = 14;
const MONTHS = 6;

// ['2026-09-20', ..., today], oldest first, from the database's own date.
function lastDays(today) {
  const end = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: DAYS }, (_, i) => new Date(end - (DAYS - 1 - i) * 86400000).toISOString().slice(0, 10));
}

function lastMonths(today) {
  const [year, month] = today.split('-').map(Number);
  return Array.from({ length: MONTHS }, (_, i) => new Date(Date.UTC(year, month - 1 - (MONTHS - 1 - i), 1)).toISOString().slice(0, 7));
}

const perDay = (table, where = '') =>
  q(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS n FROM ${table}
     WHERE created_at >= CURDATE() - INTERVAL ${DAYS - 1} DAY ${where} GROUP BY day`
  );

router.get(
  '/stats',
  h(async (req, res) => {
    const [users, counts, roles, buses, trucks, freight, newUsers, seats, urban, long, revenue, { today }] = await Promise.all([
      one(`SELECT COUNT(*) AS total,
                  COALESCE(SUM(last_seen_at >= NOW() - INTERVAL 5 MINUTE), 0) AS online,
                  COALESCE(SUM(created_at >= CURDATE()), 0) AS new_today,
                  COALESCE(SUM(subscription_until >= CURDATE()), 0) AS subscribed
           FROM users`),
      one(`SELECT
             (SELECT COUNT(*) FROM buses) AS buses,
             (SELECT COUNT(*) FROM trucks) AS trucks,
             (SELECT COUNT(*) FROM trips WHERE status IN ('preparing', 'departed')) AS open_trips,
             (SELECT COUNT(*) FROM seat_reservations WHERE created_at >= CURDATE()) AS seats_today,
             (SELECT COUNT(*) FROM freight_orders WHERE status = 'pending') AS freight_pending,
             (SELECT COUNT(*) FROM role_applications WHERE status = 'pending') AS applications_pending,
             (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS revenue_month`),
      q('SELECT role AS label, COUNT(*) AS value FROM users GROUP BY role'),
      q('SELECT status AS label, COUNT(*) AS value FROM buses GROUP BY status'),
      q('SELECT status AS label, COUNT(*) AS value FROM trucks GROUP BY status'),
      q('SELECT status AS label, COUNT(*) AS value FROM freight_orders GROUP BY status'),
      perDay('users'),
      perDay('seat_reservations'),
      perDay('freight_orders', "AND type = 'urban'"),
      perDay('freight_orders', "AND type = 'long'"),
      q(`SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, SUM(amount) AS total FROM payments
         WHERE created_at >= DATE_FORMAT(CURDATE() - INTERVAL ${MONTHS - 1} MONTH, '%Y-%m-01') GROUP BY month`),
      one("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today"),
    ]);

    // Days with no rows are missing from the GROUP BY result; the charts need them as zero.
    const days = lastDays(today);
    const fill = (rows) => days.map((day) => Number(rows.find((row) => row.day === day)?.n ?? 0));
    const months = lastMonths(today);

    res.json({
      users: Object.fromEntries(Object.entries(users).map(([key, value]) => [key, Number(value)])),
      counts,
      roles,
      buses,
      trucks,
      freight,
      daily: { days, users: fill(newUsers), seats: fill(seats), urban: fill(urban), long: fill(long) },
      revenue: { months, totals: months.map((month) => Number(revenue.find((row) => row.month === month)?.total ?? 0)) },
    });
  })
);

// ---------------------------------------------------------------------------
// Users and their permissions
// ---------------------------------------------------------------------------

const ROLES = ['user', 'guard', 'driver', 'warehouse', 'admin'];

router.get(
  '/users',
  h(async (req, res) => {
    const role = ROLES.includes(req.query.role) ? req.query.role : null;
    const text = like(req.query.q);
    res.json(
      await q(
        `SELECT u.id, u.name, u.phone, u.role, u.status, u.points, u.subscription_until, u.warehouse_id,
                u.created_at, u.last_seen_at, w.name AS warehouse,
                COALESCE(u.last_seen_at >= NOW() - INTERVAL 5 MINUTE, 0) AS online,
                COALESCE(u.subscription_until >= CURDATE(), 0) AS subscribed
         FROM users u LEFT JOIN warehouses w ON w.id = u.warehouse_id
         WHERE (u.name LIKE ? OR u.phone LIKE ?) AND (? IS NULL OR u.role = ?)
         ORDER BY u.id DESC LIMIT 300`,
        [text, text, role, role]
      )
    );
  })
);

router.put(
  '/users/:id',
  h(async (req, res) => {
    const id = idParam(req);
    const body = parse(req.body, {
      name: v.str(100),
      role: v.oneOf(...ROLES),
      status: v.oneOf('active', 'blocked'),
      warehouse_id: v.opt(v.int(1)),
    });
    // Guards against the last admin locking everyone out by mistake.
    if (id === req.user.id && (body.role !== 'admin' || body.status !== 'active')) {
      throw new HttpError(400, 'You cannot remove your own admin role or block yourself.');
    }
    if (body.role === 'warehouse' && !body.warehouse_id) throw new HttpError(400, 'Choose the warehouse this manager works for.');
    if (body.role !== 'warehouse') body.warehouse_id = null;

    const result = await q('UPDATE users SET ? WHERE id = ?', [body, id]);
    if (result.affectedRows === 0) throw new HttpError(404, 'User not found.');
    if (body.status === 'blocked') await q('DELETE FROM sessions WHERE user_id = ?', [id]);
    res.json({ ok: true });
  })
);

router.post(
  '/users/:id/password',
  h(async (req, res) => {
    const id = idParam(req);
    const body = parse(req.body, { password: v.str(100, 6) });
    const result = await q('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(body.password), id]);
    if (result.affectedRows === 0) throw new HttpError(404, 'User not found.');
    // The old password may be known to someone else, so every device has to log in again.
    if (id !== req.user.id) await q('DELETE FROM sessions WHERE user_id = ?', [id]);
    res.json({ ok: true });
  })
);

router.post(
  '/users/:id/points',
  h(async (req, res) => {
    const id = idParam(req);
    const body = parse(req.body, { amount: v.int(-1000000, 1000000) });
    if (body.amount === 0) throw new HttpError(400, 'Enter the number of points to add or remove.');
    await tx(async (conn) => {
      if (!(await one('SELECT id FROM users WHERE id = ? FOR UPDATE', [id], conn))) throw new HttpError(404, 'User not found.');
      await addPoints(conn, id, body.amount, 'admin_adjust');
    });
    res.json({ ok: true });
  })
);

router.get(
  '/applications',
  h(async (req, res) => {
    const rows = await q(
      `SELECT a.id, a.role, a.data, a.status, a.admin_note, a.created_at, a.decided_at,
              u.id AS user_id, u.name, u.phone
       FROM role_applications a JOIN users u ON u.id = a.user_id
       ORDER BY (a.status = 'pending') DESC, a.id DESC LIMIT 200`
    );
    res.json(rows.map((row) => ({ ...row, data: JSON.parse(row.data) })));
  })
);

// Approving gives the role and registers the bus, truck or warehouse the applicant entered.
router.post(
  '/applications/:id/decide',
  h(async (req, res) => {
    const id = idParam(req);
    const body = parse(req.body, { approve: v.bool(), note: v.str(255, 0) });

    await tx(async (conn) => {
      const application = await one("SELECT * FROM role_applications WHERE id = ? AND status = 'pending' FOR UPDATE", [id], conn);
      if (!application) throw new HttpError(409, 'This application was already decided.');

      if (body.approve) {
        const data = JSON.parse(application.data);
        try {
          if (application.role === 'guard') {
            const { layout, seatCount } = defaultLayout();
            await q(
              'INSERT INTO buses SET ?',
              [{ guard_id: application.user_id, bus_number: data.bus_number, model: data.model, route_id: data.route_id, fare: data.fare, layout: JSON.stringify(layout), seat_count: seatCount }],
              conn
            );
          }
          if (application.role === 'driver') {
            await q(
              'INSERT INTO trucks SET ?',
              [{ driver_id: application.user_id, plate_number: data.plate_number, model: data.model, capacity_tons: data.capacity_tons }],
              conn
            );
          }
        } catch (err) {
          if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'That bus number or plate number is already registered.');
          throw err;
        }
        await q('UPDATE users SET role = ?, warehouse_id = ? WHERE id = ?', [
          application.role,
          application.role === 'warehouse' ? data.warehouse_id : null,
          application.user_id,
        ], conn);
      }

      await q('UPDATE role_applications SET status = ?, admin_note = ?, decided_by = ?, decided_at = NOW() WHERE id = ?', [
        body.approve ? 'approved' : 'rejected',
        body.note,
        req.user.id,
        id,
      ], conn);
    });
    res.json({ ok: true });
  })
);

router.get(
  '/permissions',
  h(async (req, res) => {
    res.json(await q('SELECT feature, label, normal_allowed, special_allowed FROM feature_permissions ORDER BY label'));
  })
);

router.put(
  '/permissions',
  h(async (req, res) => {
    const rows = Array.isArray(req.body?.features) ? req.body.features : [];
    for (const row of rows) {
      const body = parse(row, { feature: v.str(64), normal_allowed: v.bool(), special_allowed: v.bool() });
      await q('UPDATE feature_permissions SET normal_allowed = ?, special_allowed = ? WHERE feature = ?', [
        body.normal_allowed,
        body.special_allowed,
        body.feature,
      ]);
    }
    res.json({ ok: true });
  })
);

router.get(
  '/settings',
  h(async (req, res) => {
    res.json(await getSettings());
  })
);

router.put(
  '/settings',
  h(async (req, res) => {
    const body = parse(req.body, {
      draw_min: v.int(0, 1000),
      draw_max: v.int(0, 1000),
      draw_interval_minutes: v.int(1, 100000),
      points_per_seat_order: v.int(0, 100000),
      points_per_freight_order: v.int(0, 100000),
      point_value: v.num(0.01, 1000000),
      subscription_price: v.num(0),
      max_seats_per_trip: v.int(1, 100),
      currency: v.str(10, 0),
    });
    if (body.draw_min > body.draw_max) throw new HttpError(400, 'The smallest lucky draw prize cannot be larger than the biggest.');
    await q('INSERT INTO settings (name, value) VALUES ? ON DUPLICATE KEY UPDATE value = VALUES(value)', [
      Object.keys(SETTING_DEFAULTS).map((name) => [name, String(body[name])]),
    ]);
    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------------------
// Buses and cars (display only: the guards and drivers keep them up to date)
// ---------------------------------------------------------------------------

router.get(
  '/buses',
  h(async (req, res) => {
    res.json(
      await q(
        `SELECT b.id, b.bus_number, b.model, b.fare, b.seat_count, b.departure_time, b.note, b.status, b.status_at,
                r.name AS route, g.name AS guard_name, g.phone AS guard_phone,
                COALESCE(g.subscription_until >= CURDATE(), 0) AS subscribed,
                COALESCE(f.rating, 0) AS rating, COALESCE(f.ratings, 0) AS ratings
         FROM buses b
         JOIN users g ON g.id = b.guard_id
         LEFT JOIN routes r ON r.id = b.route_id
         LEFT JOIN (SELECT guard_id, AVG(stars) AS rating, COUNT(*) AS ratings FROM guard_feedback GROUP BY guard_id) f
                ON f.guard_id = b.guard_id
         ORDER BY b.bus_number`
      )
    );
  })
);

router.get(
  '/trucks',
  h(async (req, res) => {
    res.json(
      await q(
        `SELECT t.id, t.plate_number, t.model, t.capacity_tons, t.status, t.prep_type, t.current_position, t.status_at,
                d.id AS driver_id, d.name AS driver_name, d.phone AS driver_phone,
                COALESCE(d.subscription_until >= CURDATE(), 0) AS subscribed,
                (SELECT COUNT(*) FROM transport_commands c WHERE c.driver_id = d.id AND c.status = 'pending') AS pending_commands
         FROM trucks t JOIN users d ON d.id = t.driver_id
         ORDER BY FIELD(t.status, 'preparing', 'working', 'repairing', 'downtime'), t.plate_number`
      )
    );
  })
);

// ---------------------------------------------------------------------------
// Freight transport orders
// ---------------------------------------------------------------------------

router.get(
  '/freight',
  h(async (req, res) => {
    const type = ['urban', 'long'].includes(req.query.type) ? req.query.type : null;
    const status = ['pending', 'accepted', 'rejected', 'departed', 'arrived', 'cancelled'].includes(req.query.status) ? req.query.status : null;
    res.json(await loadOrders('(? IS NULL OR o.type = ?) AND (? IS NULL OR o.status = ?)', [type, type, status, status], 300));
  })
);

router.post(
  '/freight/:id/decide',
  h(async (req, res) => {
    const { accept } = parse(req.body, { accept: v.bool() });
    const body = accept ? parse(req.body, { charge: v.num(0) }) : parse(req.body, { reason: v.str(255) });
    await decideOrder(idParam(req), req.user.id, { accept, ...body });
    res.json({ ok: true });
  })
);

// Sends a transport command to a truck driver, who then allows or declines it.
router.post(
  '/freight/:id/command',
  h(async (req, res) => {
    const orderId = idParam(req);
    const body = parse(req.body, { driver_id: v.int(1), note: v.str(500, 0) });

    const order = await one('SELECT status FROM freight_orders WHERE id = ?', [orderId]);
    if (!order) throw new HttpError(404, 'Order not found.');
    if (order.status !== 'accepted') throw new HttpError(409, 'A command can be sent only for an accepted order that has not departed.');

    const driver = await one("SELECT u.id FROM users u JOIN trucks t ON t.driver_id = u.id WHERE u.id = ? AND u.role = 'driver'", [body.driver_id]);
    if (!driver) throw new HttpError(400, 'Choose a driver with a registered truck.');

    const open = await one("SELECT id FROM transport_commands WHERE order_id = ? AND driver_id = ? AND status IN ('pending', 'allowed')", [orderId, body.driver_id]);
    if (open) throw new HttpError(409, 'This driver already has a command for this order.');

    await q('INSERT INTO transport_commands (order_id, driver_id, issued_by, note) VALUES (?, ?, ?, ?)', [orderId, body.driver_id, req.user.id, body.note]);
    res.status(201).json({ ok: true });
  })
);

router.post(
  '/freight/:id/progress',
  h(async (req, res) => {
    const body = parse(req.body, { action: v.oneOf('depart', 'arrive'), at: v.datetime() });
    if (body.action === 'depart') await markDeparted(idParam(req), body.at);
    else await markArrived(idParam(req), body.at);
    res.json({ ok: true });
  })
);

router.post(
  '/freight/:id/paid-cash',
  h(async (req, res) => {
    await markPaidCash(idParam(req));
    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------------------
// Payments: monthly subscriptions paid in cash
// ---------------------------------------------------------------------------

router.get(
  '/payments',
  h(async (req, res) => {
    res.json(
      await q(
        `SELECT p.id, p.months, p.amount, p.period_start, p.period_end, p.note, p.created_at,
                u.name, u.phone, u.role, a.name AS recorded_by
         FROM payments p JOIN users u ON u.id = p.user_id LEFT JOIN users a ON a.id = p.recorded_by
         ORDER BY p.id DESC LIMIT 300`
      )
    );
  })
);

// Everyone who must pay (guards and drivers) plus every user who has paid before.
router.get(
  '/subscribers',
  h(async (req, res) => {
    res.json(
      await q(
        `SELECT u.id, u.name, u.phone, u.role, u.subscription_until,
                COALESCE(u.subscription_until >= CURDATE(), 0) AS subscribed
         FROM users u
         WHERE u.role IN ('guard', 'driver') OR u.subscription_until IS NOT NULL
         ORDER BY subscribed, u.subscription_until, u.name LIMIT 500`
      )
    );
  })
);

router.post(
  '/payments',
  h(async (req, res) => {
    const body = parse(req.body, { user_id: v.int(1), months: v.int(1, 24), amount: v.num(0), note: v.str(255, 0) });
    const period = await tx(async (conn) => {
      // New months are added after the paid period, or from today when it has run out.
      const user = await one(
        `SELECT DATE_FORMAT(GREATEST(CURDATE(), COALESCE(subscription_until + INTERVAL 1 DAY, CURDATE())), '%Y-%m-%d') AS start
         FROM users WHERE id = ? FOR UPDATE`,
        [body.user_id],
        conn
      );
      if (!user) throw new HttpError(404, 'User not found.');
      const { end } = await one("SELECT DATE_FORMAT(DATE(?) + INTERVAL ? MONTH - INTERVAL 1 DAY, '%Y-%m-%d') AS end", [user.start, body.months], conn);

      await q('INSERT INTO payments SET ?', [{ ...body, period_start: user.start, period_end: end, recorded_by: req.user.id }], conn);
      await q('UPDATE users SET subscription_until = ? WHERE id = ?', [end, body.user_id], conn);
      return { period_start: user.start, period_end: end };
    });
    res.status(201).json(period);
  })
);

// ---------------------------------------------------------------------------
// Histories: read-only logs of everything that was sent
// ---------------------------------------------------------------------------

const HISTORIES = {
  reservations: `
    SELECT s.id, s.created_at, u.name AS user, s.phone, b.bus_number, r.name AS route, s.seat, s.status, s.points_used
    FROM seat_reservations s
    JOIN trips t ON t.id = s.trip_id JOIN buses b ON b.id = t.bus_id JOIN routes r ON r.id = t.route_id
    LEFT JOIN users u ON u.id = s.user_id`,
  bus_status: `
    SELECT s.id, s.created_at, g.name AS guard, b.bus_number, s.status, p.name AS park, r.name AS route, s.direction, s.reported_at
    FROM bus_status_reports s
    JOIN users g ON g.id = s.guard_id JOIN buses b ON b.id = s.bus_id
    LEFT JOIN parks p ON p.id = s.park_id LEFT JOIN routes r ON r.id = s.route_id`,
  guard_reports: `
    SELECT d.id, d.created_at, g.name AS guard, r.name AS route, d.direction, d.departure_date, d.passengers_count,
           d.repeat_time_count, d.repeat_date_count, d.deferred_count, d.free_count, d.count1, d.count2, d.count3
    FROM guard_daily_reports d JOIN users g ON g.id = d.guard_id JOIN routes r ON r.id = d.route_id`,
  truck_status: `
    SELECT s.id, s.created_at, d.name AS driver, t.plate_number, s.status, s.prep_type, s.position
    FROM truck_status_reports s JOIN users d ON d.id = s.driver_id JOIN trucks t ON t.id = s.truck_id`,
  driver_reports: `
    SELECT r.id, r.created_at, d.name AS driver, r.departure_position, r.arrival_position, r.arrive_date,
           r.go_amount, r.come_amount, r.repeat_count, r.current_position
    FROM driver_daily_reports r JOIN users d ON d.id = r.driver_id`,
  warehouse_reports: `
    SELECT r.id, r.created_at, w.name AS warehouse, m.name AS manager, r.report_date,
           r.in_count, r.in_weight, r.in_note, r.out_count, r.out_weight, r.out_note
    FROM warehouse_daily_reports r JOIN warehouses w ON w.id = r.warehouse_id JOIN users m ON m.id = r.manager_id`,
  commands: `
    SELECT c.id, c.created_at, d.name AS driver, c.order_id, c.status, c.note, c.decline_reason, c.responded_at
    FROM transport_commands c JOIN users d ON d.id = c.driver_id`,
  points: `
    SELECT p.id, p.created_at, u.name AS user, u.phone, p.amount, p.reason
    FROM point_transactions p JOIN users u ON u.id = p.user_id`,
  feedback: `
    SELECT f.id, f.created_at, u.name AS user, g.name AS guard, f.stars, f.comment
    FROM guard_feedback f JOIN users u ON u.id = f.user_id JOIN users g ON g.id = f.guard_id`,
};

router.get(
  '/histories/:kind',
  h(async (req, res) => {
    const sql = Object.hasOwn(HISTORIES, req.params.kind) ? HISTORIES[req.params.kind] : null;
    if (!sql) throw new HttpError(404, 'Unknown history.');
    // Every query lists its id first, so "ORDER BY 1" is newest first.
    res.json(await q(`${sql} ORDER BY 1 DESC LIMIT 300`));
  })
);

export default router;
