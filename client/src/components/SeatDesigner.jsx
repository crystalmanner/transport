import { useState } from 'react';
import {
  addUpperDeck,
  FIXTURES,
  MAX_COLS,
  MAX_ROWS,
  paint,
  problem,
  removeUpperDeck,
  rename,
  renumber,
  resize,
  seatCount,
  template,
  TEMPLATES,
} from '../lib/seatLayout.js';
import Icon from './Icon.jsx';
import { Fixture } from './SeatMap.jsx';
import styles from './Seats.module.css';
import { Field, Modal, Notice, Tabs } from './ui.jsx';

const TOOLS = [
  { id: 'seat', label: 'Seat' },
  { id: 'empty', label: 'Empty' },
  ...Object.entries(FIXTURES).map(([id, fixture]) => ({ id, label: fixture.label })),
  { id: 'number', label: 'Seat number' },
];

function Stepper({ label, value, min, max, onChange }) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className={styles.stepper}>
        <button type="button" className="btn btn-sm" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Fewer ${label.toLowerCase()}`}>
          -
        </button>
        <output>{value}</output>
        <button type="button" className="btn btn-sm" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`More ${label.toLowerCase()}`}>
          +
        </button>
      </div>
    </div>
  );
}

/*
 * The guard draws the bus here: pick a tool, then tap cells of the floor grid.
 * Buses differ a lot, so nothing is fixed: grid size, where seats, the driver, doors,
 * WC and stairs are, an optional upper deck, and the seat numbers.
 */
export default function SeatDesigner({ initial, onSave, busy }) {
  const [layout, setLayout] = useState(initial);
  const [deckIndex, setDeckIndex] = useState(0);
  const [tool, setTool] = useState('seat');
  // While on, seats are numbered 1, 2, 3... after every change. Turn off to type your own numbers.
  const [autoNumber, setAutoNumber] = useState(true);
  const [naming, setNaming] = useState(null);
  const [templateId, setTemplateId] = useState('coach22');
  const [templateRows, setTemplateRows] = useState(10);

  const deck = layout.decks[Math.min(deckIndex, layout.decks.length - 1)];
  const activeDeck = Math.min(deckIndex, layout.decks.length - 1);
  const issue = problem(layout);
  const apply = (next) => setLayout(autoNumber ? renumber(next) : next);

  const tapCell = (r, c) => {
    const cell = deck.cells[r][c];
    if (tool === 'number') {
      if (cell?.t === 'seat') setNaming({ r, c, value: cell.n });
      return;
    }
    apply(paint(layout, activeDeck, r, c, tool));
  };

  const useTemplate = () => {
    if (seatCount(layout) > 0 && !window.confirm('Replace the current design with this template?')) return;
    setLayout(template(templateId, templateRows));
    setDeckIndex(0);
  };

  const pickTool = (id) => {
    setTool(id);
    // Typing your own numbers only makes sense when they are not renumbered right away.
    if (id === 'number') setAutoNumber(false);
  };

  return (
    <div className="stack">
      <section className="card stack">
        <h3>Start from a template</h3>
        <div className="form-grid">
          <Field label="Bus type">
            <select className="input" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
              {TEMPLATES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Rows of seats">
            <input className="input" type="number" min={1} max={MAX_ROWS - 2} value={templateRows} onChange={(event) => setTemplateRows(event.target.value)} />
          </Field>
        </div>
        <div>
          <button type="button" className="btn" onClick={useTemplate}>
            Use this template
          </button>
        </div>
      </section>

      <section className="card stack">
        <div className="stack-sm">
          <h3>Draw the bus</h3>
          <p className="muted small">Choose what to place, then tap the squares. Tapping the same thing again removes it.</p>
        </div>

        <div className="segmented" role="group" aria-label="Tool">
          {TOOLS.map((item) => (
            <button key={item.id} type="button" aria-pressed={tool === item.id} onClick={() => pickTool(item.id)}>
              {FIXTURES[item.id]?.icon && <Icon name={FIXTURES[item.id].icon} size={16} />}
              {item.label}
            </button>
          ))}
        </div>

        {layout.decks.length > 1 && (
          <Tabs tabs={layout.decks.map((item, index) => ({ id: index, label: item.name }))} value={activeDeck} onChange={setDeckIndex} />
        )}

        <div className={styles.wrap}>
          <div className={styles.decks}>
            <div className={styles.bus}>
              <p className={styles.front}>Front</p>
              <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${deck.cols}, var(--cell))` }}>
                {deck.cells.flatMap((row, r) =>
                  row.map((cell, c) => (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      className={`${styles.cell} ${styles.editable} ${cell?.t === 'seat' ? styles.seat : cell ? styles.fixture : ''}`}
                      aria-label={`Row ${r + 1}, column ${c + 1}: ${cell?.t === 'seat' ? `seat ${cell.n}` : cell ? FIXTURES[cell.t].label : 'empty'}`}
                      onClick={() => tapCell(r, c)}
                    >
                      {cell?.t === 'seat' ? cell.n : cell ? <Fixture type={cell.t} /> : ''}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="row" style={{ gap: '1.25rem' }}>
          <Stepper label="Rows" value={deck.rows} min={1} max={MAX_ROWS} onChange={(rows) => apply(resize(layout, activeDeck, rows, deck.cols))} />
          <Stepper label="Columns" value={deck.cols} min={1} max={MAX_COLS} onChange={(cols) => apply(resize(layout, activeDeck, deck.rows, cols))} />
        </div>

        <div className="row">
          <label className="check">
            <input
              type="checkbox"
              checked={autoNumber}
              onChange={(event) => {
                setAutoNumber(event.target.checked);
                if (event.target.checked) {
                  setLayout(renumber(layout));
                  if (tool === 'number') setTool('seat');
                }
              }}
            />
            Number the seats automatically
          </label>
          {layout.decks.length === 1 ? (
            <button type="button" className="btn btn-sm" onClick={() => { setLayout(addUpperDeck(layout)); setDeckIndex(1); }}>
              <Icon name="plus" size={16} />
              Add an upper deck
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => {
                if (!window.confirm('Remove the upper deck and its seats?')) return;
                apply(removeUpperDeck(layout));
                setDeckIndex(0);
              }}
            >
              <Icon name="trash" size={16} />
              Remove the upper deck
            </button>
          )}
        </div>
      </section>

      {issue && (
        <Notice tone="warn" icon="alert">
          {issue}
        </Notice>
      )}
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={busy || Boolean(issue)} onClick={() => onSave(layout)}>
          {busy ? 'Saving…' : `Save design (${seatCount(layout)} seats)`}
        </button>
        <button type="button" className="btn" onClick={() => { setLayout(initial); setDeckIndex(0); }}>
          Undo changes
        </button>
      </div>

      {naming && (
        <Modal title="Seat number" onClose={() => setNaming(null)}>
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              if (naming.value.trim()) setLayout(rename(layout, activeDeck, naming.r, naming.c, naming.value));
              setNaming(null);
            }}
          >
            <Field label="Number or name of this seat" hint="Up to 4 characters, for example 12 or A3">
              <input className="input" autoFocus maxLength={4} value={naming.value} onChange={(event) => setNaming({ ...naming, value: event.target.value })} />
            </Field>
            <button type="submit" className="btn btn-primary">
              Save number
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
