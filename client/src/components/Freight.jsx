import { useState } from 'react';
import { useAuth } from '../context/Auth.jsx';
import { useLookups } from '../hooks/useLookups.js';
import { formatDateTime, formatMoney, formatNumber, inputDateTime } from '../lib/format.js';
import { FormField } from './AutoForm.jsx';
import Icon from './Icon.jsx';
import { Badge, Field, Status } from './ui.jsx';

// ------------------------------------------------------------ order form

const BLANK_ITEM = { name: '', height: '', width: '', weight: '', count: 1 };

const SENDER_FIELDS = [
  { name: 'sender_name', label: 'Sender name' },
  { name: 'sender_phone', label: 'Sender phone number', type: 'tel' },
  { name: 'sender_phone2', label: 'Second phone number', type: 'tel', required: false },
  { name: 'departure_address', label: 'Departure position', placeholder: 'Address where the car picks up the freight' },
  { name: 'departure_features', label: 'Special features of the departure position', required: false, placeholder: 'Gate color, floor, narrow road...', wide: true },
];

const RECEIVER_FIELDS = [
  { name: 'receiver_name', label: 'Receiver name' },
  { name: 'receiver_phone', label: 'Receiver phone number', type: 'tel', hint: 'The receiver sees the order status with this number' },
  { name: 'destination_address', label: 'Destination position', wide: true },
];

const TRANSPORT_FIELDS = [
  { name: 'cars_count', label: 'Number of cars', type: 'number', min: 1, step: 1 },
  { name: 'car_arrive_at', label: 'Car arrival date and time', type: 'datetime-local' },
  { name: 'urgent', label: 'Urgent', type: 'checkbox' },
  { name: 'note', label: 'Note', type: 'textarea', required: false },
];

const ITEM_FIELDS = [
  { name: 'name', label: 'Freight name' },
  { name: 'height', label: 'Height (cm)', type: 'number' },
  { name: 'width', label: 'Width (cm)', type: 'number' },
  { name: 'weight', label: 'Weight (kg)', type: 'number' },
  { name: 'count', label: 'Count', type: 'number', min: 1, step: 1 },
];

/*
 * Application form for a freight transport. type 'urban' or 'long'; the long-distance
 * form adds the two warehouses, the baggage claim condition and who pays.
 */
export function FreightForm({ type, busy, onSubmit }) {
  const { user } = useAuth();
  const lookups = useLookups();
  const blank = () => ({
    sender_name: user.name,
    sender_phone: user.phone,
    sender_phone2: '',
    departure_address: '',
    departure_features: '',
    receiver_name: '',
    receiver_phone: '',
    destination_address: '',
    cars_count: 1,
    car_arrive_at: inputDateTime(120),
    urgent: false,
    note: '',
    origin_warehouse_id: '',
    dest_warehouse_id: '',
    claim_condition: 'direct',
    payment_target: 'sender',
  });
  const [values, setValues] = useState(blank);
  const [items, setItems] = useState([BLANK_ITEM]);

  const longFields = [
    { name: 'origin_warehouse_id', label: 'Departure warehouse', type: 'select', options: lookups.warehouseOptions, hint: 'Its manager accepts the order' },
    { name: 'dest_warehouse_id', label: 'Destination warehouse', type: 'select', options: lookups.warehouseOptions },
    { name: 'claim_condition', label: 'Baggage claim', type: 'radio', options: [{ value: 'direct', label: 'Receiver collects' }, { value: 'delivery', label: 'Delivery to the address' }] },
    { name: 'payment_target', label: 'Who pays', type: 'radio', options: [{ value: 'sender', label: 'Sender' }, { value: 'receiver', label: 'Receiver' }] },
  ];

  const group = (fields) => fields.map((field) => <FormField key={field.name} field={field} value={values[field.name]} onChange={(value) => setValues((prev) => ({ ...prev, [field.name]: value }))} />);
  const setItem = (index, name, value) => setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [name]: value } : item)));

  const submit = async (event) => {
    event.preventDefault();
    const ok = await onSubmit({ ...values, type, items });
    if (ok) {
      setValues(blank());
      setItems([BLANK_ITEM]);
    }
  };

  return (
    <form className="stack" onSubmit={submit}>
      <section className="card stack">
        <h2>Sender</h2>
        <div className="form-grid">{group(SENDER_FIELDS)}</div>
      </section>

      <section className="card stack">
        <h2>Receiver</h2>
        <div className="form-grid">{group(RECEIVER_FIELDS)}</div>
      </section>

      <section className="card stack">
        <h2>Freight</h2>
        {items.map((item, index) => (
          <fieldset key={index} className="field" style={{ gap: '0.75rem', paddingBottom: '0.9rem', borderBottom: '1px solid var(--border)' }}>
            <legend className="row between" style={{ width: '100%' }}>
              <span>Freight {index + 1}</span>
              {items.length > 1 && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}>
                  <Icon name="trash" size={16} />
                  Remove
                </button>
              )}
            </legend>
            <div className="form-grid">
              {ITEM_FIELDS.map((field) => (
                <FormField key={field.name} field={{ ...field, wide: field.name === 'name' }} value={item[field.name]} onChange={(value) => setItem(index, field.name, value)} />
              ))}
            </div>
          </fieldset>
        ))}
        <div>
          <button type="button" className="btn btn-sm" onClick={() => setItems((prev) => [...prev, BLANK_ITEM])} disabled={items.length >= 30}>
            <Icon name="plus" size={16} />
            Add another freight
          </button>
        </div>
      </section>

      <section className="card stack">
        <h2>Transport</h2>
        <div className="form-grid">
          {type === 'long' && group(longFields)}
          {group(TRANSPORT_FIELDS)}
        </div>
      </section>

      <div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Sending…' : 'Send the order'}
        </button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------ order card

const STEPS = ['pending', 'accepted', 'departed', 'arrived'];
const STEP_LABELS = { pending: 'Sent', accepted: 'Accepted', departed: 'Departed', arrived: 'Arrived' };

// Sent -> Accepted -> Departed -> Arrived, with the steps already passed marked.
function Progress({ status }) {
  const reached = STEPS.indexOf(status);
  if (reached < 0) return null;
  return (
    <ol className="row small" style={{ gap: '0.35rem 0.6rem' }} aria-label="Progress of the order">
      {STEPS.map((step, index) => {
        const done = index <= reached;
        return (
          <li key={step} className="row" style={{ gap: '0.3rem', color: done ? 'var(--good)' : 'var(--faint)' }}>
            <Icon name={done ? 'check' : 'clock'} size={15} />
            <span style={{ color: done ? 'var(--text)' : 'var(--faint)' }}>{STEP_LABELS[step]}</span>
            {index < STEPS.length - 1 && <Icon name="right" size={14} style={{ color: 'var(--faint)' }} />}
          </li>
        );
      })}
    </ol>
  );
}

/*
 * One freight order with everything every side needs to see: who, where, what,
 * the decision, the real departure time, arrival, payment and the driver.
 * `children` is the row of action buttons, different for each side.
 */
export function OrderCard({ order, children }) {
  const { settings } = useAuth();
  const long = order.type === 'long';

  return (
    <article className="card stack">
      <div className="row between">
        <div className="row">
          <h3>Order #{order.id}</h3>
          <Badge tone="primary">{long ? 'Long distance' : 'Urban'}</Badge>
          {Boolean(order.urgent) && <Badge tone="bad">Urgent</Badge>}
          {order.party && <Badge>{order.party === 'sender' ? 'You send' : 'You receive'}</Badge>}
        </div>
        <Status value={order.status} />
      </div>

      <Progress status={order.status} />
      {order.status === 'rejected' && <p className="small" style={{ color: 'var(--bad)' }}>Reason: {order.reject_reason || 'not given'}</p>}

      <dl className="facts">
        <div>
          <dt>Sender</dt>
          <dd>
            {order.sender_name}, {order.sender_phone}
            {order.sender_phone2 ? `, ${order.sender_phone2}` : ''}
          </dd>
        </div>
        <div>
          <dt>From</dt>
          <dd>
            {order.departure_address}
            {order.departure_features ? ` (${order.departure_features})` : ''}
          </dd>
        </div>
        <div>
          <dt>Receiver</dt>
          <dd>
            {order.receiver_name}, {order.receiver_phone}
          </dd>
        </div>
        <div>
          <dt>To</dt>
          <dd>{order.destination_address}</dd>
        </div>
        {long && (
          <>
            <div>
              <dt>Warehouses</dt>
              <dd>
                {order.origin_warehouse ?? '-'} → {order.dest_warehouse ?? '-'}
              </dd>
            </div>
            <div>
              <dt>Baggage claim</dt>
              <dd>{order.claim_condition === 'delivery' ? 'Delivery to the address' : 'Receiver collects'}</dd>
            </div>
            <div>
              <dt>Who pays</dt>
              <dd>{order.payment_target === 'receiver' ? 'Receiver' : 'Sender'}</dd>
            </div>
          </>
        )}
        <div>
          <dt>Cars / car arrival</dt>
          <dd>
            {order.cars_count} / {formatDateTime(order.car_arrive_at)}
          </dd>
        </div>
        <div>
          <dt>Real departure time</dt>
          <dd>{order.departed_at ? formatDateTime(order.departed_at) : 'Not departed yet'}</dd>
        </div>
        <div>
          <dt>Arrived</dt>
          <dd>{order.arrived_at ? formatDateTime(order.arrived_at) : 'Not arrived yet'}</dd>
        </div>
        <div>
          <dt>Charge</dt>
          <dd className="row" style={{ gap: '0.4rem' }}>
            {order.charge === null ? 'Set when accepted' : formatMoney(order.charge, settings.currency)}
            {order.charge !== null && <Status value={order.payment_status} />}
          </dd>
        </div>
      </dl>

      <div className="small">
        <p className="muted">Freight</p>
        <ul>
          {order.items.map((item, index) => (
            <li key={index}>
              {item.count} × {item.name}
              <span className="muted">
                {' '}
                ({formatNumber(item.height, 2)} × {formatNumber(item.width, 2)} cm, {formatNumber(item.weight, 2)} kg each)
              </span>
            </li>
          ))}
        </ul>
        {order.note && <p className="muted pre-line">Note: {order.note}</p>}
      </div>

      {order.commands?.length > 0 && (
        <div className="small">
          <p className="muted">Truck</p>
          <ul className="stack-sm">
            {order.commands.map((command) => (
              <li key={command.id} className="row" style={{ gap: '0.4rem' }}>
                <Icon name="truck" size={16} />
                {command.driver_name}, {command.driver_phone}
                {command.plate_number ? `, ${command.plate_number}` : ''}
                <Status value={command.status} />
                {command.decline_reason && <span className="muted">({command.decline_reason})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {children && <div className="row">{children}</div>}
    </article>
  );
}

// Small "pick a time and confirm" control used for the real departure and arrival times.
export function TimeAction({ label, busy, onConfirm }) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(inputDateTime());
  if (!open) {
    return (
      <button type="button" className="btn btn-primary btn-sm" onClick={() => { setAt(inputDateTime()); setOpen(true); }}>
        {label}
      </button>
    );
  }
  return (
    <form
      className="row"
      style={{ alignItems: 'flex-end' }}
      onSubmit={async (event) => {
        event.preventDefault();
        if (await onConfirm(at)) setOpen(false);
      }}
    >
      <Field label={`${label}: date and time`}>
        <input className="input" type="datetime-local" value={at} onChange={(event) => setAt(event.target.value)} required />
      </Field>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        Confirm
      </button>
      <button type="button" className="btn" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  );
}

// "Accept with a charge" / "Reject with a reason", shared by the admin and the warehouse manager.
export function DecideAction({ busy, onDecide }) {
  const { settings } = useAuth();
  const [mode, setMode] = useState(null);
  const [value, setValue] = useState('');

  if (!mode) {
    return (
      <>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => { setMode('accept'); setValue(''); }}>
          Accept
        </button>
        <button type="button" className="btn btn-danger btn-sm" onClick={() => { setMode('reject'); setValue(''); }}>
          Reject
        </button>
      </>
    );
  }
  const accept = mode === 'accept';
  return (
    <form
      className="row"
      style={{ alignItems: 'flex-end', width: '100%' }}
      onSubmit={async (event) => {
        event.preventDefault();
        if (await onDecide(accept ? { accept: true, charge: value } : { accept: false, reason: value })) setMode(null);
      }}
    >
      <div className="grow">
        <Field label={accept ? `Charge${settings.currency ? ` (${settings.currency})` : ''}` : 'Reason for rejecting'}>
          {accept ? (
            <input className="input" type="number" min={0} step="any" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} required autoFocus />
          ) : (
            <input className="input" value={value} onChange={(event) => setValue(event.target.value)} required maxLength={255} autoFocus />
          )}
        </Field>
      </div>
      <button type="submit" className={`btn ${accept ? 'btn-primary' : 'btn-danger'}`} disabled={busy}>
        {accept ? 'Accept order' : 'Reject order'}
      </button>
      <button type="button" className="btn" onClick={() => setMode(null)}>
        Cancel
      </button>
    </form>
  );
}
