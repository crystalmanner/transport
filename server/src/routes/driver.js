import { Router } from 'express';
import { one, q, tx } from '../db.js';
import { requireRole, requireSubscription } from '../lib/auth.js';
import { markArrived, markDeparted } from '../lib/freight.js';
import { h, HttpError, idParam, parse, v } from '../lib/http.js';

// Truck Driver Side. Needs the driver role and a paid subscription.
const router = Router();
router.use(requireRole('driver'), requireSubscription);

async function myTruck(driverId, conn) {
  const truck = await one('SELECT * FROM trucks WHERE driver_id = ?', [driverId], conn);
  if (!truck) throw new HttpError(409, 'Register your truck first.', 'NO_TRUCK');
  return truck;
}

router.get(
  '/truck',
  h(async (req, res) => {
    res.json({ truck: await one('SELECT * FROM trucks WHERE driver_id = ?', [req.user.id]) });
  })
);

router.put(
  '/truck',
  h(async (req, res) => {
    const body = parse(req.body, { plate_number: v.str(30), model: v.str(100, 0), capacity_tons: v.num(0, 1000) });
    try {
      const existing = await one('SELECT id FROM trucks WHERE driver_id = ?', [req.user.id]);
      if (existing) await q('UPDATE trucks SET ? WHERE id = ?', [body, existing.id]);
      else await q('INSERT INTO trucks SET ?', [{ ...body, driver_id: req.user.id }]);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Another truck already uses this plate number.');
      throw err;
    }
    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------------------
// Operating Status Information
// ---------------------------------------------------------------------------

async function setTruckStatus(conn, truck, status, prepType = null, position = truck.current_position) {
  await q('UPDATE trucks SET status = ?, prep_type = ?, current_position = ?, status_at = NOW() WHERE id = ?', [status, prepType, position, truck.id], conn);
  await q('INSERT INTO truck_status_reports (truck_id, driver_id, status, prep_type, position) VALUES (?, ?, ?, ?, ?)', [
    truck.id,
    truck.driver_id,
    status,
    prepType,
    position,
  ], conn);
}

router.post(
  '/status',
  h(async (req, res) => {
    const { status } = parse(req.body, { status: v.oneOf('preparing', 'working', 'repairing', 'downtime') });
    // Only "preparing" carries input: where the truck is and which kind of transport it is ready for.
    const extra = status === 'preparing' ? parse(req.body, { position: v.str(255), prep_type: v.oneOf('urban', 'long') }) : {};
    await tx(async (conn) => {
      const truck = await myTruck(req.user.id, conn);
      await setTruckStatus(conn, truck, status, extra.prep_type, extra.position);
    });
    res.status(201).json({ ok: true });
  })
);

router.get(
  '/status/history',
  h(async (req, res) => {
    res.json(await q('SELECT id, status, prep_type, position, created_at FROM truck_status_reports WHERE driver_id = ? ORDER BY id DESC LIMIT 100', [req.user.id]));
  })
);

// ---------------------------------------------------------------------------
// Operate Daily Report
// ---------------------------------------------------------------------------

router.post(
  '/reports',
  h(async (req, res) => {
    const body = parse(req.body, {
      departure_position: v.str(255),
      arrival_position: v.str(255),
      arrive_date: v.date(),
      go_amount: v.num(0, 100000),
      come_amount: v.num(0, 100000),
      repeat_count: v.int(0, 1000),
      current_position: v.str(255),
    });
    await tx(async (conn) => {
      const truck = await myTruck(req.user.id, conn);
      await q('INSERT INTO driver_daily_reports SET ?', [{ ...body, driver_id: req.user.id, truck_id: truck.id }], conn);
      await q('UPDATE trucks SET current_position = ? WHERE id = ?', [body.current_position, truck.id], conn);
    });
    res.status(201).json({ ok: true });
  })
);

router.get(
  '/reports',
  h(async (req, res) => {
    res.json(await q('SELECT * FROM driver_daily_reports WHERE driver_id = ? ORDER BY id DESC LIMIT 100', [req.user.id]));
  })
);

// ---------------------------------------------------------------------------
// Transport Commands
// ---------------------------------------------------------------------------

router.get(
  '/commands',
  h(async (req, res) => {
    const commands = await q(
      `SELECT c.id, c.status, c.note, c.decline_reason, c.created_at, c.responded_at,
              o.id AS order_id, o.type, o.status AS order_status, o.urgent, o.cars_count, o.car_arrive_at,
              o.sender_name, o.sender_phone, o.departure_address, o.departure_features,
              o.receiver_name, o.receiver_phone, o.destination_address, o.note AS order_note,
              o.departed_at, o.arrived_at
       FROM transport_commands c JOIN freight_orders o ON o.id = c.order_id
       WHERE c.driver_id = ? ORDER BY c.id DESC LIMIT 100`,
      [req.user.id]
    );
    if (commands.length > 0) {
      const items = await q('SELECT order_id, name, height, width, weight, count FROM freight_items WHERE order_id IN (?) ORDER BY id', [
        commands.map((command) => command.order_id),
      ]);
      for (const command of commands) command.items = items.filter((item) => item.order_id === command.order_id);
    }
    res.json(commands);
  })
);

router.post(
  '/commands/:id/respond',
  h(async (req, res) => {
    const id = idParam(req);
    const body = parse(req.body, { allow: v.bool(), reason: v.str(255, 0) });
    await tx(async (conn) => {
      const result = await q(
        "UPDATE transport_commands SET status = ?, decline_reason = ?, responded_at = NOW() WHERE id = ? AND driver_id = ? AND status = 'pending'",
        [body.allow ? 'allowed' : 'declined', body.allow ? '' : body.reason, id, req.user.id],
        conn
      );
      if (result.affectedRows === 0) throw new HttpError(409, 'This command was already answered.');
      // Taking a command means the truck is now working; the admin sees that on the car list.
      if (body.allow) await setTruckStatus(conn, await myTruck(req.user.id, conn), 'working');
    });
    res.json({ ok: true });
  })
);

// For urban orders the driver reports the real departure and arrival. Long-distance orders are reported by the warehouses.
router.post(
  '/commands/:id/progress',
  h(async (req, res) => {
    const body = parse(req.body, { action: v.oneOf('depart', 'arrive'), at: v.datetime() });
    const command = await one(
      `SELECT c.order_id, o.type FROM transport_commands c JOIN freight_orders o ON o.id = c.order_id
       WHERE c.id = ? AND c.driver_id = ? AND c.status = 'allowed'`,
      [idParam(req), req.user.id]
    );
    if (!command) throw new HttpError(404, 'Command not found.');
    if (command.type !== 'urban') throw new HttpError(409, 'Departure and arrival of long-distance freight are recorded by the warehouse.');
    if (body.action === 'depart') await markDeparted(command.order_id, body.at);
    else await markArrived(command.order_id, body.at);
    res.json({ ok: true });
  })
);

export default router;
