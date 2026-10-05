import { one, q, tx } from '../db.js';
import { HttpError } from './http.js';
import { addPoints } from './points.js';
import { getSettings } from './settings.js';

const ORDER_SQL = `
  SELECT o.*, su.name AS account_name,
         ow.name AS origin_warehouse, oo.name AS origin_office,
         dw.name AS dest_warehouse, dof.name AS dest_office
  FROM freight_orders o
  JOIN users su ON su.id = o.user_id
  LEFT JOIN warehouses ow ON ow.id = o.origin_warehouse_id
  LEFT JOIN transport_offices oo ON oo.id = ow.office_id
  LEFT JOIN warehouses dw ON dw.id = o.dest_warehouse_id
  LEFT JOIN transport_offices dof ON dof.id = dw.office_id`;

// Orders with their freight rows and transport commands attached. `where` is trusted SQL from the caller.
export async function loadOrders(where, params = [], limit = 200) {
  const orders = await q(`${ORDER_SQL} WHERE ${where} ORDER BY o.id DESC LIMIT ${Number(limit)}`, params);
  if (orders.length === 0) return orders;

  const ids = orders.map((order) => order.id);
  const [items, commands] = await Promise.all([
    q('SELECT order_id, name, height, width, weight, count FROM freight_items WHERE order_id IN (?) ORDER BY id', [ids]),
    q(
      `SELECT c.id, c.order_id, c.status, c.note, c.decline_reason, c.created_at, c.responded_at,
              u.name AS driver_name, u.phone AS driver_phone, t.plate_number
       FROM transport_commands c
       JOIN users u ON u.id = c.driver_id
       LEFT JOIN trucks t ON t.driver_id = c.driver_id
       WHERE c.order_id IN (?) ORDER BY c.id`,
      [ids]
    ),
  ]);

  for (const order of orders) {
    order.items = items.filter((item) => item.order_id === order.id);
    order.commands = commands.filter((command) => command.order_id === order.id);
  }
  return orders;
}

/*
 * The state changes below are single conditional UPDATEs: the WHERE holds both the
 * allowed starting state and the caller's scope (for example "AND origin_warehouse_id = ?"
 * for a warehouse manager), so a stale screen or a wrong account changes nothing.
 */
export const ANY_ORDER = { sql: '', params: [] };

const refuse = () => {
  throw new HttpError(409, 'This order cannot be changed that way now. Please refresh the list.');
};

export async function decideOrder(orderId, actorId, { accept, charge, reason }, scope = ANY_ORDER) {
  await tx(async (conn) => {
    const result = accept
      ? await q(
          `UPDATE freight_orders SET status = 'accepted', charge = ?, decided_by = ?, decided_at = NOW()
           WHERE id = ? AND status = 'pending' ${scope.sql}`,
          [charge, actorId, orderId, ...scope.params],
          conn
        )
      : await q(
          `UPDATE freight_orders SET status = 'rejected', reject_reason = ?, decided_by = ?, decided_at = NOW()
           WHERE id = ? AND status = 'pending' ${scope.sql}`,
          [reason, actorId, orderId, ...scope.params],
          conn
        );
    if (result.affectedRows === 0) refuse();

    // Points for using the system are given once the order is real, not when it is typed in.
    if (accept) {
      const order = await one('SELECT user_id FROM freight_orders WHERE id = ?', [orderId], conn);
      const settings = await getSettings(conn);
      await addPoints(conn, order.user_id, settings.points_per_freight_order, 'freight_order', orderId);
    }
  });
}

export async function markDeparted(orderId, at, scope = ANY_ORDER) {
  const result = await q(
    `UPDATE freight_orders SET status = 'departed', departed_at = ? WHERE id = ? AND status = 'accepted' ${scope.sql}`,
    [at, orderId, ...scope.params]
  );
  if (result.affectedRows === 0) refuse();
}

export async function markArrived(orderId, at, scope = ANY_ORDER) {
  const result = await q(
    `UPDATE freight_orders SET status = 'arrived', arrived_at = ? WHERE id = ? AND status = 'departed' ${scope.sql}`,
    [at, orderId, ...scope.params]
  );
  if (result.affectedRows === 0) refuse();
}

export async function markPaidCash(orderId, scope = ANY_ORDER) {
  const result = await q(
    `UPDATE freight_orders SET payment_status = 'cash'
     WHERE id = ? AND payment_status = 'unpaid' AND charge IS NOT NULL
       AND status IN ('accepted', 'departed', 'arrived') ${scope.sql}`,
    [orderId, ...scope.params]
  );
  if (result.affectedRows === 0) refuse();
}
