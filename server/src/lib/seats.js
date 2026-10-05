import { q } from '../db.js';
import { addPoints } from './points.js';

// { seatNumber: { status, ... } } for every held seat of a trip.
export async function heldSeats(tripId, conn) {
  return q(
    `SELECT s.id, s.seat, s.status, s.phone, s.user_id, s.points_used, s.points_earned, u.name
     FROM seat_reservations s LEFT JOIN users u ON u.id = s.user_id
     WHERE s.trip_id = ? AND s.active = 1`,
    [tripId],
    conn
  );
}

// Frees the seat and puts the passenger's points back the way they were before the order.
export async function cancelReservation(conn, reservation) {
  await q("UPDATE seat_reservations SET status = 'cancelled', active = NULL WHERE id = ?", [reservation.id], conn);
  if (!reservation.user_id) return;
  await addPoints(conn, reservation.user_id, reservation.points_used, 'seat_refund', reservation.id);
  await addPoints(conn, reservation.user_id, -reservation.points_earned, 'seat_cancel', reservation.id);
}
