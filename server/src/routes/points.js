import { randomInt } from 'node:crypto';
import { Router } from 'express';
import { q, tx } from '../db.js';
import { h, HttpError } from '../lib/http.js';
import { addPoints } from '../lib/points.js';
import { getSettings } from '../lib/settings.js';

const router = Router();

router.get(
  '/',
  h(async (req, res) => {
    const transactions = await q(
      'SELECT id, amount, reason, created_at FROM point_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 100',
      [req.user.id]
    );
    res.json({ points: req.user.points, transactions });
  })
);

// The hourly lucky draw: a random number of points, at most once per interval.
router.post(
  '/draw',
  h(async (req, res) => {
    const result = await tx(async (conn) => {
      const settings = await getSettings(conn);
      // Claiming the hour and checking it are one statement, so two taps at once win only once.
      const claim = await q(
        `UPDATE users SET last_draw_at = NOW()
         WHERE id = ? AND (last_draw_at IS NULL OR last_draw_at <= NOW() - INTERVAL ? MINUTE)`,
        [req.user.id, settings.draw_interval_minutes],
        conn
      );
      if (claim.affectedRows === 0) {
        throw new HttpError(429, 'You already used the lucky draw. Please come back later.', 'DRAW_NOT_READY');
      }
      const low = Math.min(settings.draw_min, settings.draw_max);
      const high = Math.max(settings.draw_min, settings.draw_max);
      const won = randomInt(low, high + 1);
      await addPoints(conn, req.user.id, won, 'lucky_draw');
      return { won, wait_seconds: settings.draw_interval_minutes * 60 };
    });
    res.json({ ...result, points: req.user.points + result.won });
  })
);

export default router;
