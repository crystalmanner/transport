const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// The server sends 'YYYY-MM-DD' and 'YYYY-MM-DD HH:MM:SS' in its own local time.
// They are shown as written, with no time-zone conversion on the visitor's device.
function parts(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(text ?? '');
  return m && { year: m[1], month: MONTHS[Number(m[2]) - 1], day: Number(m[3]), time: m[4] ? `${m[4]}:${m[5]}` : null };
}

export function formatDate(text) {
  const p = parts(text);
  return p ? `${p.day} ${p.month} ${p.year}` : '-';
}

export function formatDateTime(text) {
  const p = parts(text);
  if (!p) return '-';
  return p.time ? `${p.day} ${p.month} ${p.year}, ${p.time}` : `${p.day} ${p.month} ${p.year}`;
}

// Short form for chart axes: "3 Oct".
export function formatDay(text) {
  const p = parts(text);
  return p ? `${p.day} ${p.month}` : '';
}

export function formatMonth(text) {
  const m = /^(\d{4})-(\d{2})/.exec(text ?? '');
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
}

export function formatNumber(value, digits = 0) {
  const n = Number(value ?? 0);
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

// The currency unit comes from the admin settings; without one the number stands alone.
export function formatMoney(value, currency = '') {
  if (value === null || value === undefined) return '-';
  const text = formatNumber(value, 2);
  return currency ? `${text} ${currency}` : text;
}

const pad = (n) => String(n).padStart(2, '0');

// Values for <input type="datetime-local"> and <input type="date">, `minutes` from now.
export function inputDateTime(minutes = 0) {
  const d = new Date(Date.now() + minutes * 60000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const inputDate = () => inputDateTime().slice(0, 10);

export function formatCountdown(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

// 'long_freight' -> 'Long freight'
export const humanize = (text) => String(text ?? '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
