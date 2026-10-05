import { q } from '../db.js';

// Defaults are inserted by `npm run db:setup`; the admin edits them on the Settings page.
export const SETTING_DEFAULTS = {
  draw_min: 1,
  draw_max: 10,
  draw_interval_minutes: 60,
  points_per_seat_order: 5,
  points_per_freight_order: 10,
  // How much money one reward point pays for.
  point_value: 10,
  subscription_price: 1000,
  max_seats_per_trip: 5,
  // Unit shown after money amounts. Empty shows the number alone.
  currency: '',
};

export const FEATURE_DEFAULTS = [
  ['bus_seat_order', 'Order Bus Seat', 1, 1],
  ['urban_freight', 'Order Urban Freight Transport', 1, 1],
  ['long_freight', 'Order Long Distance Freight Transport', 1, 1],
  ['guard_feedback', 'Feedback about the Guard', 1, 1],
  ['pay_with_points', 'Pay with Reward Points', 1, 1],
  ['route_search', 'Route Search (guard rating and phone)', 0, 1],
  ['bus_search', 'Bus Search (live status and arrival forecast)', 0, 1],
];

export async function getSettings(conn) {
  const rows = await q('SELECT name, value FROM settings', [], conn);
  const settings = { ...SETTING_DEFAULTS };
  for (const { name, value } of rows) {
    if (!(name in SETTING_DEFAULTS)) continue;
    settings[name] = typeof SETTING_DEFAULTS[name] === 'number' ? Number(value) : value;
  }
  return settings;
}

export const pointsForAmount = (amount, settings) => Math.ceil(Number(amount) / Math.max(settings.point_value, 0.01));
