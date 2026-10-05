import { Router } from 'express';
import { one, q } from '../db.js';
import { createSession, destroySession, featureMap, hashPassword, loadUser, requireAuth, verifyPassword } from '../lib/auth.js';
import { h, HttpError, parse, v } from '../lib/http.js';
import { getSettings } from '../lib/settings.js';

const router = Router();

// Slows down password guessing: 10 wrong passwords for one phone locks it for 10 minutes.
const MAX_FAILURES = 10;
const LOCK_MS = 10 * 60 * 1000;
const failures = new Map();

function assertNotLocked(phone) {
  const entry = failures.get(phone);
  if (entry && entry.count >= MAX_FAILURES && entry.until > Date.now()) {
    throw new HttpError(429, 'Too many wrong passwords. Please try again in 10 minutes.');
  }
  if (entry && entry.until <= Date.now()) failures.delete(phone);
}

function recordFailure(phone) {
  const entry = failures.get(phone) ?? { count: 0, until: 0 };
  entry.count += 1;
  entry.until = Date.now() + LOCK_MS;
  failures.set(phone, entry);
}

// Everything the client needs to draw the screens for this account.
async function profile(user) {
  const settings = await getSettings();
  const [features, application, wait] = await Promise.all([
    featureMap(user),
    one('SELECT id, role, status, admin_note, created_at FROM role_applications WHERE user_id = ? ORDER BY id DESC LIMIT 1', [
      user.id,
    ]),
    // Sent as seconds-to-wait, not a clock time, because phones on an offline network often have the wrong time.
    one(
      'SELECT GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), last_draw_at + INTERVAL ? MINUTE)) AS seconds FROM users WHERE id = ?',
      [settings.draw_interval_minutes, user.id]
    ),
  ]);
  const { last_draw_at, status, ...account } = user;
  return {
    user: { ...account, draw_wait_seconds: Number(wait?.seconds ?? 0) },
    features,
    application,
    settings,
  };
}

router.post(
  '/register',
  h(async (req, res) => {
    const body = parse(req.body, { name: v.str(100), phone: v.phone(), password: v.str(100, 6) });
    let result;
    try {
      result = await q('INSERT INTO users (name, phone, password_hash) VALUES (?, ?, ?)', [
        body.name,
        body.phone,
        await hashPassword(body.password),
      ]);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'This phone number is already registered.');
      throw err;
    }
    const token = await createSession(result.insertId);
    res.status(201).json({ token, ...(await profile(await loadUser(result.insertId))) });
  })
);

router.post(
  '/login',
  h(async (req, res) => {
    const body = parse(req.body, { phone: v.phone(), password: v.str(100) });
    assertNotLocked(body.phone);

    const row = await one('SELECT id, password_hash, status FROM users WHERE phone = ?', [body.phone]);
    if (!row || !(await verifyPassword(body.password, row.password_hash))) {
      recordFailure(body.phone);
      throw new HttpError(401, 'Wrong phone number or password.');
    }
    if (row.status !== 'active') throw new HttpError(403, 'This account is blocked. Please contact the admin.');

    failures.delete(body.phone);
    const token = await createSession(row.id);
    res.json({ token, ...(await profile(await loadUser(row.id))) });
  })
);

router.post(
  '/logout',
  requireAuth,
  h(async (req, res) => {
    await destroySession(req.token);
    res.json({ ok: true });
  })
);

router.get(
  '/me',
  requireAuth,
  h(async (req, res) => {
    res.json(await profile(req.user));
  })
);

router.put(
  '/profile',
  requireAuth,
  h(async (req, res) => {
    const body = parse(req.body, { name: v.str(100) });
    await q('UPDATE users SET name = ? WHERE id = ?', [body.name, req.user.id]);
    res.json({ ok: true });
  })
);

router.put(
  '/password',
  requireAuth,
  h(async (req, res) => {
    const body = parse(req.body, { current_password: v.str(100), new_password: v.str(100, 6) });
    const row = await one('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!(await verifyPassword(body.current_password, row.password_hash))) {
      throw new HttpError(400, 'The current password is wrong.');
    }
    await q('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(body.new_password), req.user.id]);
    res.json({ ok: true });
  })
);

export default router;
