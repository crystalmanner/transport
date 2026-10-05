import { Router } from 'express';
import { one, q } from '../db.js';
import { requireRole } from '../lib/auth.js';
import { decideOrder, loadOrders, markArrived, markDeparted, markPaidCash } from '../lib/freight.js';
import { h, HttpError, idParam, parse, v } from '../lib/http.js';

// Warehouse Manager Side. The manager works for one warehouse (users.warehouse_id) and
// handles the long-distance orders that leave from it or arrive at it.
const router = Router();

router.use(requireRole('warehouse'), (req, res, next) => {
  if (!req.user.warehouse_id) {
    return next(new HttpError(409, 'No warehouse is assigned to your account yet. Please ask the admin.', 'NO_WAREHOUSE'));
  }
  next();
});

const leavingMine = (req) => ({ sql: "AND type = 'long' AND origin_warehouse_id = ?", params: [req.user.warehouse_id] });
const comingToMine = (req) => ({ sql: "AND type = 'long' AND dest_warehouse_id = ?", params: [req.user.warehouse_id] });
const touchingMine = (req) => ({
  sql: "AND type = 'long' AND (origin_warehouse_id = ? OR dest_warehouse_id = ?)",
  params: [req.user.warehouse_id, req.user.warehouse_id],
});

router.get(
  '/info',
  h(async (req, res) => {
    res.json(
      await one(
        `SELECT w.id, w.name, w.address, w.info, o.name AS office, pr.name AS province
         FROM warehouses w
         JOIN transport_offices o ON o.id = w.office_id
         JOIN provinces pr ON pr.id = o.province_id
         WHERE w.id = ?`,
        [req.user.warehouse_id]
      )
    );
  })
);

// scope=outgoing: orders that start at this warehouse (to accept and send).
// scope=incoming: accepted orders on their way here (to mark as arrived).
router.get(
  '/orders',
  h(async (req, res) => {
    const incoming = req.query.scope === 'incoming';
    const where = incoming
      ? "o.type = 'long' AND o.dest_warehouse_id = ? AND o.status IN ('accepted', 'departed', 'arrived')"
      : "o.type = 'long' AND o.origin_warehouse_id = ? AND o.status <> 'cancelled'";
    res.json(await loadOrders(where, [req.user.warehouse_id]));
  })
);

router.post(
  '/orders/:id/decide',
  h(async (req, res) => {
    const { accept } = parse(req.body, { accept: v.bool() });
    const body = accept ? parse(req.body, { charge: v.num(0) }) : parse(req.body, { reason: v.str(255) });
    await decideOrder(idParam(req), req.user.id, { accept, ...body }, leavingMine(req));
    res.json({ ok: true });
  })
);

router.post(
  '/orders/:id/sent',
  h(async (req, res) => {
    const { at } = parse(req.body, { at: v.datetime() });
    await markDeparted(idParam(req), at, leavingMine(req));
    res.json({ ok: true });
  })
);

router.post(
  '/orders/:id/arrived',
  h(async (req, res) => {
    const { at } = parse(req.body, { at: v.datetime() });
    await markArrived(idParam(req), at, comingToMine(req));
    res.json({ ok: true });
  })
);

router.post(
  '/orders/:id/paid-cash',
  h(async (req, res) => {
    await markPaidCash(idParam(req), touchingMine(req));
    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------------------
// Daily report: freight brought in and freight removed
// ---------------------------------------------------------------------------

router.post(
  '/reports',
  h(async (req, res) => {
    const body = parse(req.body, {
      report_date: v.date(),
      in_count: v.int(0, 1000000),
      in_weight: v.num(0, 10000000),
      in_note: v.str(500, 0),
      out_count: v.int(0, 1000000),
      out_weight: v.num(0, 10000000),
      out_note: v.str(500, 0),
    });
    await q('INSERT INTO warehouse_daily_reports SET ?', [{ ...body, warehouse_id: req.user.warehouse_id, manager_id: req.user.id }]);
    res.status(201).json({ ok: true });
  })
);

router.get(
  '/reports',
  h(async (req, res) => {
    res.json(await q('SELECT * FROM warehouse_daily_reports WHERE warehouse_id = ? ORDER BY id DESC LIMIT 100', [req.user.warehouse_id]));
  })
);

export default router;
