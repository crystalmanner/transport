import { HttpError } from './http.js';

/*
 * Seat design of a bus:
 *   { decks: [{ name, rows, cols, cells }] }
 * cells[row][col] is null (empty floor / aisle), { t: 'seat', n: '12' } or a fixture
 * { t: 'driver' | 'door' | 'wc' | 'stairs' }. Row 0 is the front of the bus.
 * Seat numbers are unique across all decks; a reservation refers to a seat by its number.
 */

const FIXTURES = ['driver', 'door', 'wc', 'stairs'];
export const MAX_ROWS = 30;
export const MAX_COLS = 10;

export function normalizeLayout(input) {
  const decksIn = input?.decks;
  if (!Array.isArray(decksIn) || decksIn.length < 1 || decksIn.length > 2) {
    throw new HttpError(400, 'The seat design must have one or two decks.');
  }

  const seats = new Set();
  const decks = decksIn.map((deck, index) => {
    const rows = Number(deck?.rows);
    const cols = Number(deck?.cols);
    if (!Number.isInteger(rows) || rows < 1 || rows > MAX_ROWS || !Number.isInteger(cols) || cols < 1 || cols > MAX_COLS) {
      throw new HttpError(400, `A deck must have 1 to ${MAX_ROWS} rows and 1 to ${MAX_COLS} columns.`);
    }

    const cells = [];
    for (let r = 0; r < rows; r += 1) {
      const row = [];
      for (let c = 0; c < cols; c += 1) {
        const cell = deck.cells?.[r]?.[c];
        if (cell?.t === 'seat') {
          const n = String(cell.n ?? '').trim();
          if (!n || n.length > 4) throw new HttpError(400, 'Every seat needs a number of 1 to 4 characters.');
          if (seats.has(n)) throw new HttpError(400, `Seat number ${n} is used more than once.`);
          seats.add(n);
          row.push({ t: 'seat', n });
        } else if (FIXTURES.includes(cell?.t)) {
          row.push({ t: cell.t });
        } else {
          row.push(null);
        }
      }
      cells.push(row);
    }

    const name = String(deck.name ?? '').trim().slice(0, 30) || (index === 0 ? 'Lower deck' : 'Upper deck');
    return { name, rows, cols, cells };
  });

  if (seats.size === 0) throw new HttpError(400, 'The seat design needs at least one seat.');
  return { layout: { decks }, seatCount: seats.size };
}

export function seatNumbers(layout) {
  return layout.decks.flatMap((deck) => deck.cells.flat().filter((cell) => cell?.t === 'seat').map((cell) => cell.n));
}

// Starting design for a new bus: 2 + 2 coach, driver front-left, door front-right, full back row.
export function defaultLayout(seatRows = 10) {
  const cols = 5;
  const cells = [[{ t: 'driver' }, null, null, null, { t: 'door' }]];
  let n = 0;
  const seat = () => ({ t: 'seat', n: String((n += 1)) });
  for (let r = 0; r < seatRows; r += 1) cells.push([seat(), seat(), null, seat(), seat()]);
  cells.push([seat(), seat(), seat(), seat(), seat()]);
  return { layout: { decks: [{ name: 'Lower deck', rows: cells.length, cols, cells }] }, seatCount: n };
}
