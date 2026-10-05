export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Express 4 does not catch rejected promises, so every async handler goes through this.
export const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function idParam(req, name = 'id') {
  const id = Number(req.params[name]);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, 'Not found');
  return id;
}

const label = (key) => key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const empty = (val) => val === undefined || val === null || val === '';
const fail = (key, message) => {
  throw new HttpError(400, `${label(key)} ${message}`);
};

// Field validators for parse(). Each returns the cleaned value or throws a 400.
export const v = {
  str:
    (max = 255, min = 1) =>
    (val, key) => {
      if (empty(val)) {
        if (min === 0) return '';
        fail(key, 'is required');
      }
      if (typeof val !== 'string' && typeof val !== 'number') fail(key, 'must be text');
      const text = String(val).trim();
      if (text.length < min) fail(key, min > 1 ? `must be at least ${min} characters` : 'is required');
      if (text.length > max) fail(key, `must be at most ${max} characters`);
      return text;
    },

  int:
    (min = 0, max = 1_000_000_000) =>
    (val, key) => {
      const n = empty(val) ? NaN : Number(val);
      if (!Number.isInteger(n) || n < min || n > max) fail(key, `must be a whole number from ${min} to ${max}`);
      return n;
    },

  num:
    (min = 0, max = 1_000_000_000) =>
    (val, key) => {
      const n = empty(val) ? NaN : Number(val);
      if (!Number.isFinite(n) || n < min || n > max) fail(key, `must be a number from ${min} to ${max}`);
      return n;
    },

  bool: () => (val) => val === true || val === 1 || val === '1' || val === 'true',

  oneOf:
    (...values) =>
    (val, key) => {
      if (!values.includes(val)) fail(key, `must be one of: ${values.join(', ')}`);
      return val;
    },

  // Stored without spaces or dashes so the same number always compares equal.
  phone: () => (val, key) => {
    const text = String(val ?? '').trim();
    if (!/^\+?[0-9][0-9\s-]{2,19}$/.test(text)) fail(key, 'must be a valid phone number');
    return text.replace(/[\s-]/g, '');
  },

  // Accepts the value of <input type="datetime-local"> and returns MySQL DATETIME text.
  datetime: () => (val, key) => {
    const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?/.exec(String(val ?? ''));
    if (!m || Number.isNaN(Date.parse(`${m[1]}T${m[2]}`))) fail(key, 'must be a date and time');
    return `${m[1]} ${m[2]}${m[3] ?? ':00'}`;
  },

  date: () => (val, key) => {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(val ?? ''));
    if (!m || Number.isNaN(Date.parse(m[1]))) fail(key, 'must be a date');
    return m[1];
  },

  opt: (validator) => (val, key) => (empty(val) ? null : validator(val, key)),
};

export function parse(body, spec) {
  const out = {};
  for (const [key, validator] of Object.entries(spec)) {
    out[key] = validator(body?.[key], key);
  }
  return out;
}

// For LIKE '%text%' searches: the user's % and _ are matched literally.
export const like = (text) => `%${String(text ?? '').trim().replace(/[\\%_]/g, '\\$&')}%`;
