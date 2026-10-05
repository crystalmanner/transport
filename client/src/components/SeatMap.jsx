import { FIXTURES } from '../lib/seatLayout.js';
import Icon from './Icon.jsx';
import styles from './Seats.module.css';

const STATE_LABEL = { free: 'free', reserved: 'reserved', occupied: 'in use', mine: 'your seat' };

export function Fixture({ type }) {
  const fixture = FIXTURES[type];
  return fixture.icon ? <Icon name={fixture.icon} size={18} /> : fixture.text;
}

export function SeatLegend({ mine = false }) {
  return (
    <ul className={styles.legend}>
      <li>
        <span className={`${styles.cell} ${styles.seat}`} /> Free
      </li>
      <li>
        <span className={`${styles.cell} ${styles.seat} ${styles.reserved}`} /> Reserved
      </li>
      <li>
        <span className={`${styles.cell} ${styles.seat} ${styles.occupied}`} /> In use
      </li>
      {mine && (
        <li>
          <span className={`${styles.cell} ${styles.seat} ${styles.mine}`} /> Yours
        </li>
      )}
    </ul>
  );
}

/*
 * Draws the bus with the state of every seat.
 * seats: { seatNumber: { status: 'reserved' | 'occupied', mine? } }; a seat not listed is free.
 * onSeat(number, info) makes seats clickable; canPick(number, info) limits which ones.
 */
export default function SeatMap({ layout, seats = {}, onSeat, canPick = () => true, selected }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.decks}>
        {layout.decks.map((deck, deckIndex) => (
          <div key={deckIndex} className={styles.deck}>
            {layout.decks.length > 1 && <p className={styles.deckName}>{deck.name}</p>}
            <div className={styles.bus}>
              <p className={styles.front}>Front</p>
              <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${deck.cols}, var(--cell))` }}>
                {deck.cells.flatMap((row, r) =>
                  row.map((cell, c) => {
                    const key = `${r}-${c}`;
                    if (!cell) return <span key={key} className={styles.cell} />;
                    if (cell.t !== 'seat') {
                      return (
                        <span key={key} className={`${styles.cell} ${styles.fixture}`} title={FIXTURES[cell.t].label}>
                          <Fixture type={cell.t} />
                        </span>
                      );
                    }
                    const info = seats[cell.n];
                    const state = info?.mine ? 'mine' : (info?.status ?? 'free');
                    const className = `${styles.cell} ${styles.seat} ${state === 'free' ? '' : styles[state]} ${selected === cell.n ? styles.selected : ''}`;
                    const label = `Seat ${cell.n}, ${STATE_LABEL[state]}`;
                    if (!onSeat) {
                      return (
                        <span key={key} className={className} title={label}>
                          {cell.n}
                        </span>
                      );
                    }
                    return (
                      <button key={key} type="button" className={className} aria-label={label} disabled={!canPick(cell.n, info)} onClick={() => onSeat(cell.n, info)}>
                        {cell.n}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
