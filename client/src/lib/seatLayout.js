/*
 * Seat design of a bus (the same shape the server validates in server/src/lib/layout.js):
 *   { decks: [{ name, rows, cols, cells }] }
 * cells[row][col] is null (empty floor / aisle), { t: 'seat', n: '12' } or a fixture
 * { t: 'driver' | 'door' | 'wc' | 'stairs' }. Row 0 is the front of the bus.
 * Every function here returns a new layout and leaves its input unchanged.
 */

export const MAX_ROWS = 30;
export const MAX_COLS = 10;

export const FIXTURES = {
  driver: { label: 'Driver', icon: 'wheel' },
  door: { label: 'Door', icon: 'door' },
  wc: { label: 'WC', text: 'WC' },
  stairs: { label: 'Stairs', icon: 'stairs' },
};

const clone = (layout) => JSON.parse(JSON.stringify(layout));
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const allSeats = (layout) => layout.decks.flatMap((deck) => deck.cells.flat().filter((cell) => cell?.t === 'seat'));

export const seatCount = (layout) => allSeats(layout).length;

// Numbers every seat 1, 2, 3... front to back, left to right, lower deck first.
export function renumber(layout) {
  let n = 0;
  return {
    decks: layout.decks.map((deck) => ({
      ...deck,
      cells: deck.cells.map((row) => row.map((cell) => (cell?.t === 'seat' ? { t: 'seat', n: String((n += 1)) } : cell))),
    })),
  };
}

function freeNumber(layout) {
  const used = new Set(allSeats(layout).map((seat) => seat.n));
  let n = 1;
  while (used.has(String(n))) n += 1;
  return String(n);
}

// Applies a tool to one cell. Using the same tool on the same thing again clears the cell.
export function paint(layout, deck, row, col, tool) {
  const next = clone(layout);
  const current = next.decks[deck].cells[row][col];
  if (tool === 'seat') next.decks[deck].cells[row][col] = current?.t === 'seat' ? null : { t: 'seat', n: freeNumber(layout) };
  else if (tool === 'empty') next.decks[deck].cells[row][col] = null;
  else next.decks[deck].cells[row][col] = current?.t === tool ? null : { t: tool };
  return next;
}

export function rename(layout, deck, row, col, number) {
  const next = clone(layout);
  next.decks[deck].cells[row][col] = { t: 'seat', n: String(number).trim().slice(0, 4) };
  return next;
}

// Rows are added or removed at the back, columns at the right; everything else stays where it is.
export function resize(layout, deck, rows, cols) {
  const next = clone(layout);
  const target = next.decks[deck];
  target.rows = clamp(rows, 1, MAX_ROWS);
  target.cols = clamp(cols, 1, MAX_COLS);
  target.cells = Array.from({ length: target.rows }, (_, r) => Array.from({ length: target.cols }, (_, c) => target.cells[r]?.[c] ?? null));
  return next;
}

export function addUpperDeck(layout) {
  const lower = layout.decks[0];
  // Starts as a copy of the lower deck's seats, without the driver and the door.
  const cells = lower.cells.map((row) => row.map((cell) => (cell?.t === 'seat' ? { t: 'seat', n: '' } : null)));
  return renumber({ decks: [lower, { name: 'Upper deck', rows: lower.rows, cols: lower.cols, cells }] });
}

export const removeUpperDeck = (layout) => ({ decks: [layout.decks[0]] });

export const TEMPLATES = [
  { id: 'coach22', label: 'Coach, 2 + 2 seats' },
  { id: 'coach21', label: 'Coach, 2 + 1 seats' },
  { id: 'sleeper', label: 'Sleeper, 1 + 1 + 1 on two decks' },
  { id: 'blank', label: 'Empty floor' },
];

export function template(id, seatRows) {
  const rows = clamp(Number(seatRows) || 1, 1, MAX_ROWS - 2);
  const S = () => ({ t: 'seat', n: '' });
  const repeat = (makeRow) => Array.from({ length: rows }, makeRow);
  const deck = (name, cells) => ({ name, rows: cells.length, cols: cells[0].length, cells });
  const front = (cols) => [{ t: 'driver' }, ...Array(cols - 2).fill(null), { t: 'door' }];

  let decks;
  if (id === 'coach21') {
    decks = [deck('Lower deck', [front(4), ...repeat(() => [S(), S(), null, S()]), [S(), S(), S(), S()]])];
  } else if (id === 'sleeper') {
    const berths = () => [S(), null, S(), null, S()];
    decks = [deck('Lower deck', [front(5), ...repeat(berths)]), deck('Upper deck', [...repeat(berths), berths()])];
  } else if (id === 'blank') {
    decks = [deck('Lower deck', [front(5), ...repeat(() => Array(5).fill(null))])];
  } else {
    decks = [deck('Lower deck', [front(5), ...repeat(() => [S(), S(), null, S(), S()]), [S(), S(), S(), S(), S()]])];
  }
  return renumber({ decks });
}

// What stops this design from being saved, as a sentence for the guard; null when it is fine.
export function problem(layout) {
  const numbers = allSeats(layout).map((seat) => seat.n);
  if (numbers.length === 0) return 'Add at least one seat.';
  if (numbers.some((n) => !n)) return 'Every seat needs a number.';
  const twice = numbers.find((n, index) => numbers.indexOf(n) !== index);
  return twice ? `Seat number ${twice} is used more than once.` : null;
}
