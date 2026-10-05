import { useEffect, useRef } from 'react';
import { humanize } from '../lib/format.js';
import Icon from './Icon.jsx';

// ----------------------------------------------------------------- Modal

export function Modal({ title, onClose, wide = false, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // The page behind must not scroll while the window is open.
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Tabs

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button key={tab.id} type="button" role="tab" aria-selected={tab.id === value} onClick={() => onChange(tab.id)}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Status

// Every status word of the system with its color and the text shown to people.
const STATUS = {
  pending: ['warn', 'Pending'],
  accepted: ['info', 'Accepted'],
  rejected: ['bad', 'Rejected'],
  departed: ['primary', 'Departed'],
  arrived: ['good', 'Arrived'],
  cancelled: ['', 'Cancelled'],
  idle: ['', 'Not running'],
  preparing: ['info', 'Preparing'],
  working: ['primary', 'Working'],
  repairing: ['warn', 'Repairing'],
  downtime: ['', 'Downtime'],
  reserved: ['warn', 'Reserved'],
  occupied: ['good', 'In use'],
  allowed: ['good', 'Allowed'],
  declined: ['bad', 'Not allowed'],
  approved: ['good', 'Approved'],
  active: ['good', 'Active'],
  blocked: ['bad', 'Blocked'],
  unpaid: ['warn', 'Not paid'],
  points: ['good', 'Paid with points'],
  cash: ['good', 'Paid in cash'],
};

export function Status({ value }) {
  const [tone, label] = STATUS[value] ?? ['', humanize(value)];
  return <span className={`badge ${tone}`}>{label}</span>;
}

export function Badge({ tone = '', children }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

// ----------------------------------------------------------------- Stars

// Shows a rating; with onChange it becomes the 1 to 5 star input.
export function Stars({ value = 0, onChange, size = 18 }) {
  const rounded = Math.round(Number(value));
  if (!onChange) {
    return (
      <span className="row" style={{ gap: 2, color: 'var(--warn)' }} role="img" aria-label={`${Number(value).toFixed(1)} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Icon key={n} name="star" size={size} filled={n <= rounded} style={n <= rounded ? undefined : { color: 'var(--border-strong)' }} />
        ))}
      </span>
    );
  }
  return (
    <span className="row" style={{ gap: 0 }} role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === rounded}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className="btn btn-ghost"
          style={{ padding: '0 0.3rem', color: n <= rounded ? 'var(--warn)' : 'var(--border-strong)' }}
          onClick={() => onChange(n)}
        >
          <Icon name="star" size={30} filled={n <= rounded} />
        </button>
      ))}
    </span>
  );
}

// ------------------------------------------------------------ Small parts

export function Notice({ tone = '', icon = 'info', children }) {
  return (
    <div className={`notice ${tone}`}>
      <Icon name={icon} />
      <div>{children}</div>
    </div>
  );
}

export function Empty({ icon = 'list', children }) {
  return (
    <div className="card muted" style={{ display: 'grid', justifyItems: 'center', gap: '0.5rem', padding: '2rem 1rem', textAlign: 'center' }}>
      <Icon name={icon} size={28} />
      <div>{children}</div>
    </div>
  );
}

// Loading / error / empty handling for one useFetch() result.
export function Async({ state, empty = 'Nothing here yet.', emptyIcon, children }) {
  if (state.error) {
    return (
      <Notice tone="bad" icon="alert">
        {state.error.message}{' '}
        <button type="button" className="link" style={{ background: 'none', border: 0, cursor: 'pointer' }} onClick={state.reload}>
          Try again
        </button>
      </Notice>
    );
  }
  if (state.data === null) return <p className="muted">Loading…</p>;
  if (Array.isArray(state.data) && state.data.length === 0) return <Empty icon={emptyIcon}>{empty}</Empty>;
  return children(state.data);
}

export function Field({ label, hint, wide = false, children }) {
  return (
    <label className={`field${wide ? ' wide' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

// ------------------------------------------------------------- DataTable

/*
 * columns: [{ key, label, render?(row) }]. A table on wide screens; on a phone each
 * row turns into a card (see .table in global.css). `actions(row)` adds a last cell of buttons.
 */
export function DataTable({ columns, rows, actions, rowKey = 'id' }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
            {actions && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row[rowKey] ?? index}>
              {columns.map((column) => (
                <td key={column.key} data-label={column.label}>
                  {column.render ? column.render(row) : (row[column.key] ?? '-')}
                </td>
              ))}
              {actions && <td className="actions">{actions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
