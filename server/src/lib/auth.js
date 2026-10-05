import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { one, q } from '../db.js';
import { h, HttpError } from './http.js';

const scryptAsync = promisify(scrypt);

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [saltHex, keyHex] = String(stored).split(':');
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const key = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(key, expected);
}

// Only the hash is stored, so a copy of the database cannot be used to log in.
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export async function createSession(userId) {
  const token = randomBytes(32).toString('hex');
  await q('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, NOW() + INTERVAL 30 DAY)', [
    hashToken(token),
    userId,
  ]);
  return token;
}

export async function destroySession(token) {
  await q('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)]);
}

const USER_SQL = `
  SELECT u.id, u.phone, u.name, u.role, u.status, u.points, u.warehouse_id,
         u.subscription_until, u.last_draw_at, u.created_at,
         (u.subscription_until IS NOT NULL AND u.subscription_until >= CURDATE()) AS subscribed`;

function shapeUser(row) {
  row.subscribed = Boolean(row.subscribed);
  // A running subscription is what makes a Special User.
  row.tier = row.subscribed ? 'special' : 'normal';
  return row;
}

export async function loadUser(id, conn) {
  const row = await one(`${USER_SQL} FROM users u WHERE u.id = ?`, [id], conn);
  return row && shapeUser(row);
}

// Attaches req.user when the request carries a valid token. Never rejects; the require* guards do that.
export const authenticate = h(async (req, res, next) => {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    const row = await one(
      `${USER_SQL},
         (u.last_seen_at IS NULL OR u.last_seen_at < NOW() - INTERVAL 1 MINUTE) AS stale
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > NOW()`,
      [hashToken(token)]
    );
    if (row && row.status === 'active') {
      // last_seen_at drives the "users online now" count; one write a minute is enough.
      if (row.stale) await q('UPDATE users SET last_seen_at = NOW() WHERE id = ?', [row.id]);
      delete row.stale;
      req.user = shapeUser(row);
      req.token = token;
    }
  }
  next();
});

export function requireAuth(req, res, next) {
  next(req.user ? undefined : new HttpError(401, 'Please log in.', 'LOGIN_REQUIRED'));
}

export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(new HttpError(401, 'Please log in.', 'LOGIN_REQUIRED'));
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, 'Your account cannot use this part of the system.', 'WRONG_ROLE'));
    }
    next();
  };

export function requireSubscription(req, res, next) {
  if (!req.user?.subscribed) {
    return next(
      new HttpError(402, 'Your monthly subscription is not active. Please pay at the office.', 'SUBSCRIPTION_REQUIRED')
    );
  }
  next();
}

export async function assertFeature(user, feature) {
  if (user.role === 'admin') return;
  const row = await one('SELECT normal_allowed, special_allowed FROM feature_permissions WHERE feature = ?', [feature]);
  const allowed = row ? (user.tier === 'special' ? row.special_allowed : row.normal_allowed) : true;
  if (!allowed) {
    throw new HttpError(403, 'This function is not available for your account type.', 'FEATURE_LOCKED');
  }
}

export const requireFeature = (feature) =>
  h(async (req, res, next) => {
    await assertFeature(req.user, feature);
    next();
  });

// { feature: true | false } for the logged-in user, so the client can show locks.
export async function featureMap(user) {
  const rows = await q('SELECT feature, normal_allowed, special_allowed FROM feature_permissions');
  return Object.fromEntries(
    rows.map((row) => [
      row.feature,
      user.role === 'admin' || Boolean(user.tier === 'special' ? row.special_allowed : row.normal_allowed),
    ])
  );
}
