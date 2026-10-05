import { q } from '../db.js';
import { HttpError } from './http.js';

// All point changes run inside the caller's transaction and leave a ledger row.

export async function addPoints(conn, userId, amount, reason, refId = null) {
  if (!amount) return;
  await q('UPDATE users SET points = GREATEST(points + ?, 0) WHERE id = ?', [amount, userId], conn);
  await q('INSERT INTO point_transactions (user_id, amount, reason, ref_id) VALUES (?, ?, ?, ?)', [userId, amount, reason, refId], conn);
}

export async function spendPoints(conn, userId, amount, reason, refId = null) {
  if (!amount) return;
  // The balance check lives in the WHERE so two requests at once cannot both spend the same points.
  const result = await q('UPDATE users SET points = points - ? WHERE id = ? AND points >= ?', [amount, userId, amount], conn);
  if (result.affectedRows === 0) throw new HttpError(400, `Not enough reward points. ${amount} points are needed.`);
  await q('INSERT INTO point_transactions (user_id, amount, reason, ref_id) VALUES (?, ?, ?, ?)', [userId, -amount, reason, refId], conn);
}
