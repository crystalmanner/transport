import { useState } from 'react';
import AutoForm from '../../components/AutoForm.jsx';
import { DecideAction, OrderCard, TimeAction } from '../../components/Freight.jsx';
import { Async, Badge, DataTable, Field, Modal, Notice, Stars, Status, Tabs } from '../../components/ui.jsx';
import { useAuth } from '../../context/Auth.jsx';
import { useSubmit, useToast } from '../../context/Toast.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useDebounced } from '../../hooks/useLookups.js';
import { post, put, query } from '../../lib/api.js';
import { formatDate, formatDateTime, formatMoney, formatNumber, humanize } from '../../lib/format.js';
import { ROLE_NAMES } from '../../lib/nav.js';

const PREP_TYPES = { urban: 'urban', long: 'long distance' };
const subscription = (row) => (row.subscribed ? <Badge tone="good">Paid</Badge> : <Badge tone="warn">Not paid</Badge>);

// ------------------------------------------------------- buses and cars

export function Buses() {
  const { settings } = useAuth();
  const state = useFetch('/admin/buses');
  return (
    <>
      <h2>Buses</h2>
      <p className="muted">Guards register and update their own bus. This list shows where every bus stands now.</p>
      <Async state={state} empty="No bus is registered yet." emptyIcon="bus">
        {(buses) => (
          <DataTable
            columns={[
              { key: 'bus_number', label: 'Bus number' },
              { key: 'model', label: 'Model', render: (bus) => bus.model || '-' },
              { key: 'route', label: 'Route' },
              { key: 'guard_name', label: 'Guard', render: (bus) => `${bus.guard_name}, ${bus.guard_phone}` },
              { key: 'fare', label: 'Fare', render: (bus) => formatMoney(bus.fare, settings.currency) },
              { key: 'seat_count', label: 'Seats' },
              { key: 'status', label: 'Status', render: (bus) => <Status value={bus.status} /> },
              { key: 'status_at', label: 'Since', render: (bus) => formatDateTime(bus.status_at) },
              { key: 'rating', label: 'Guard rating', render: (bus) => (bus.ratings ? <span className="row" style={{ gap: '0.3rem' }}><Stars value={bus.rating} size={14} /><span className="small muted">({bus.ratings})</span></span> : '-') },
              { key: 'subscribed', label: 'Subscription', render: subscription },
            ]}
            rows={buses}
          />
        )}
      </Async>
    </>
  );
}

const truckColumns = [
  { key: 'plate_number', label: 'Plate number' },
  { key: 'model', label: 'Model', render: (truck) => truck.model || '-' },
  { key: 'capacity_tons', label: 'Capacity', render: (truck) => `${formatNumber(truck.capacity_tons, 2)} t` },
  { key: 'driver_name', label: 'Driver', render: (truck) => `${truck.driver_name}, ${truck.driver_phone}` },
  { key: 'status', label: 'Status', render: (truck) => <span className="row" style={{ gap: '0.3rem' }}><Status value={truck.status} />{truck.status === 'preparing' && truck.prep_type && <span className="small muted">for {PREP_TYPES[truck.prep_type]}</span>}</span> },
  { key: 'current_position', label: 'Position', render: (truck) => truck.current_position || '-' },
];

export function Cars() {
  const state = useFetch('/admin/trucks');
  return (
    <>
      <h2>Cars</h2>
      <p className="muted">Truck drivers send their own status. Trucks that are preparing come first.</p>
      <Async state={state} empty="No truck is registered yet." emptyIcon="truck">
        {(trucks) => (
          <DataTable
            columns={[
              ...truckColumns,
              { key: 'status_at', label: 'Since', render: (truck) => formatDateTime(truck.status_at) },
              { key: 'pending_commands', label: 'Commands waiting' },
              { key: 'subscribed', label: 'Subscription', render: subscription },
            ]}
            rows={trucks}
          />
        )}
      </Async>
    </>
  );
}

// ------------------------------------------------------- freight orders

// Choosing the truck driver who receives the transport command for an order.
function SendCommand({ order, onClose, onSent }) {
  const trucks = useFetch('/admin/trucks');
  const { busy, run } = useSubmit();
  const [note, setNote] = useState('');

  const send = async (truck) => {
    if (await run(() => post(`/admin/freight/${order.id}/command`, { driver_id: truck.driver_id, note }), `Command sent to ${truck.driver_name}`)) onSent();
  };

  return (
    <Modal title={`Send a truck for order #${order.id}`} onClose={onClose} wide>
      <div className="stack">
        <Field label="Message for the driver (optional)">
          <input className="input" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
        </Field>
        <p className="muted small">The driver must allow the command. Trucks preparing for {order.type === 'urban' ? 'urban' : 'long distance'} transport fit this order best.</p>
        <Async state={trucks} empty="No truck is registered yet." emptyIcon="truck">
          {(list) => (
            <DataTable
              columns={truckColumns}
              rows={list}
              actions={(truck) => (
                <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => send(truck)}>
                  Send command
                </button>
              )}
            />
          )}
        </Async>
      </div>
    </Modal>
  );
}

const ORDER_STATUSES = ['pending', 'accepted', 'departed', 'arrived', 'rejected', 'cancelled'];

export function FreightOrders() {
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [commanding, setCommanding] = useState(null);
  const state = useFetch(`/admin/freight${query({ type, status })}`);
  const { busy, run } = useSubmit();

  const act = async (path, body, message) => {
    const ok = await run(() => post(path, body), message);
    if (ok) state.reload();
    return ok;
  };

  return (
    <>
      <h2>Freight Transport Orders</h2>
      <div className="card form-grid">
        <Field label="Kind">
          <select className="input" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">Urban and long distance</option>
            <option value="urban">Urban</option>
            <option value="long">Long distance</option>
          </select>
        </Field>
        <Field label="Status">
          <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Every status</option>
            {ORDER_STATUSES.map((item) => (
              <option key={item} value={item}>
                {humanize(item)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Async state={state} empty="No freight order matches." emptyIcon="box">
        {(orders) =>
          orders.map((order) => {
            const payable = order.payment_status === 'unpaid' && order.charge !== null && ['accepted', 'departed', 'arrived'].includes(order.status);
            return (
              <OrderCard key={order.id} order={order}>
                {order.status === 'pending' && order.type === 'long' && <p className="muted small" style={{ width: '100%' }}>Normally the manager of the departure warehouse decides this order. You can decide it for them.</p>}
                {order.status === 'pending' && <DecideAction busy={busy} onDecide={(body) => act(`/admin/freight/${order.id}/decide`, body, body.accept ? 'Order accepted' : 'Order rejected')} />}
                {order.status === 'accepted' && (
                  <>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setCommanding(order)}>
                      Send command to a driver
                    </button>
                    <TimeAction label="Departed" busy={busy} onConfirm={(at) => act(`/admin/freight/${order.id}/progress`, { action: 'depart', at }, 'Departure recorded')} />
                  </>
                )}
                {order.status === 'departed' && <TimeAction label="Arrived" busy={busy} onConfirm={(at) => act(`/admin/freight/${order.id}/progress`, { action: 'arrive', at }, 'Arrival recorded')} />}
                {payable && (
                  <button type="button" className="btn btn-sm" disabled={busy} onClick={() => window.confirm('Record that this order was paid in cash?') && act(`/admin/freight/${order.id}/paid-cash`, {}, 'Payment recorded')}>
                    Paid in cash
                  </button>
                )}
              </OrderCard>
            );
          })
        }
      </Async>
      {commanding && (
        <SendCommand
          order={commanding}
          onClose={() => setCommanding(null)}
          onSent={() => {
            setCommanding(null);
            state.reload();
          }}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------- payments

function RecordPayment({ user, onClose, onSaved }) {
  const { settings } = useAuth();
  const { busy, run } = useSubmit();
  const [months, setMonths] = useState(1);
  // Follows the month count until the admin types an amount of their own.
  const [amount, setAmount] = useState(null);
  const [note, setNote] = useState('');
  const shownAmount = amount ?? months * settings.subscription_price;

  const save = async (event) => {
    event.preventDefault();
    const result = await run(() => post('/admin/payments', { user_id: user.id, months, amount: shownAmount, note }));
    if (result) onSaved(`Subscription of ${user.name} is paid until ${formatDate(result.period_end)}`);
  };

  return (
    <Modal title={`Subscription payment: ${user.name}`} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <p className="muted">
          {user.phone}, {ROLE_NAMES[user.role]}. {user.subscribed ? `Paid until ${formatDate(user.subscription_until)}; the new months are added after that day.` : 'No running subscription; the new months start today.'}
        </p>
        <Field label="Months paid">
          <input className="input" type="number" min={1} max={24} step={1} value={months} onChange={(event) => setMonths(event.target.value)} required />
        </Field>
        <Field label={`Amount received${settings.currency ? ` (${settings.currency})` : ''}`} hint={`${formatMoney(settings.subscription_price, settings.currency)} per month`}>
          <input className="input" type="number" min={0} step="any" value={shownAmount} onChange={(event) => setAmount(event.target.value)} required />
        </Field>
        <Field label="Note (optional)">
          <input className="input" value={note} onChange={(event) => setNote(event.target.value)} maxLength={255} />
        </Field>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          Record payment
        </button>
      </form>
    </Modal>
  );
}

const PAYMENT_TABS = [
  { id: 'subscribers', label: 'Subscriptions' },
  { id: 'find', label: 'Find a user' },
  { id: 'history', label: 'Payment history' },
];

const subscriberColumns = [
  { key: 'name', label: 'Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'role', label: 'Role', render: (user) => ROLE_NAMES[user.role] },
  { key: 'subscription_until', label: 'Paid until', render: (user) => (user.subscription_until ? formatDate(user.subscription_until) : 'Never paid') },
  { key: 'subscribed', label: 'Status', render: (user) => (user.subscribed ? <Badge tone="good">Active</Badge> : <Badge tone="warn">Not active</Badge>) },
];

export function Payments() {
  const { settings } = useAuth();
  const [tab, setTab] = useState('subscribers');
  const [text, setText] = useState('');
  const [paying, setPaying] = useState(null);
  const toast = useToast();
  const search = useDebounced(text);
  const paths = { subscribers: '/admin/subscribers', find: search ? `/admin/users${query({ q: search })}` : null, history: '/admin/payments' };
  const state = useFetch(paths[tab]);

  const payButton = (user) => (
    <button type="button" className="btn btn-sm btn-primary" onClick={() => setPaying(user)}>
      Record payment
    </button>
  );

  return (
    <>
      <h2>Payments</h2>
      <p className="muted">Subscriptions are paid in cash at the office. Recording a payment here activates the account: guards and truck drivers can work, and a normal user becomes a Special User.</p>
      <Tabs tabs={PAYMENT_TABS} value={tab} onChange={setTab} />

      {tab === 'find' && (
        <Field label="Find any user to record a payment">
          <input className="input" type="search" value={text} onChange={(event) => setText(event.target.value)} placeholder="Name or phone number" />
        </Field>
      )}
      {tab === 'find' && !search ? (
        <Notice>Type a name or a phone number.</Notice>
      ) : (
        <Async state={state} empty={tab === 'history' ? 'No payment recorded yet.' : 'No user found.'} emptyIcon="card">
          {(rows) =>
            tab === 'history' ? (
              <DataTable
                columns={[
                  { key: 'created_at', label: 'Recorded', render: (row) => formatDateTime(row.created_at) },
                  { key: 'name', label: 'User', render: (row) => `${row.name}, ${row.phone}` },
                  { key: 'months', label: 'Months' },
                  { key: 'amount', label: 'Amount', render: (row) => formatMoney(row.amount, settings.currency) },
                  { key: 'period', label: 'Period', render: (row) => `${formatDate(row.period_start)} to ${formatDate(row.period_end)}` },
                  { key: 'note', label: 'Note', render: (row) => row.note || '-' },
                  { key: 'recorded_by', label: 'By' },
                ]}
                rows={rows}
              />
            ) : (
              <DataTable columns={subscriberColumns} rows={rows} actions={payButton} />
            )
          }
        </Async>
      )}

      {paying && (
        <RecordPayment
          user={paying}
          onClose={() => setPaying(null)}
          onSaved={(message) => {
            setPaying(null);
            toast(message);
            state.reload();
          }}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------ histories

const HISTORIES = [
  { id: 'reservations', label: 'Bus seat orders' },
  { id: 'bus_status', label: 'Bus status (route operation)' },
  { id: 'guard_reports', label: 'Guard daily reports' },
  { id: 'truck_status', label: 'Truck status' },
  { id: 'driver_reports', label: 'Truck driver daily reports' },
  { id: 'commands', label: 'Transport commands' },
  { id: 'warehouse_reports', label: 'Warehouse daily reports' },
  { id: 'points', label: 'Reward points' },
  { id: 'feedback', label: 'Guard feedback' },
];

// A history row can hold any columns; each value is shown by what its column name says it is.
function cell(key, value) {
  if (value === null || value === '') return '-';
  if (key === 'status') return <Status value={value} />;
  if (key === 'stars') return <Stars value={value} size={14} />;
  if (key.endsWith('_at')) return formatDateTime(value);
  if (key.endsWith('_date')) return formatDate(value);
  if (key === 'direction' || key === 'prep_type' || key === 'reason') return humanize(value);
  return value;
}

export function Histories() {
  const [kind, setKind] = useState('reservations');
  const state = useFetch(`/admin/histories/${kind}`);

  return (
    <>
      <h2>Histories</h2>
      <Field label="Show the history of">
        <select className="input" value={kind} onChange={(event) => setKind(event.target.value)}>
          {HISTORIES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>
      <Async state={state} empty="Nothing recorded yet." emptyIcon="history">
        {(rows) => (
          <>
            <DataTable
              columns={Object.keys(rows[0])
                .filter((key) => key !== 'id')
                .map((key) => ({ key, label: key === 'created_at' ? 'Recorded' : humanize(key), render: (row) => cell(key, row[key]) }))}
              rows={rows}
            />
            {rows.length === 300 && <p className="muted small">Showing the newest 300 records.</p>}
          </>
        )}
      </Async>
    </>
  );
}

// ------------------------------------------------------------- settings

const SETTING_FIELDS = [
  { name: 'subscription_price', label: 'Subscription price per month', type: 'number' },
  { name: 'currency', label: 'Currency unit shown after amounts', required: false, placeholder: 'Leave empty to show numbers only' },
  { name: 'draw_interval_minutes', label: 'Lucky draw: minutes between draws', type: 'number', min: 1, step: 1 },
  { name: 'max_seats_per_trip', label: 'Most seats one user may reserve on one bus', type: 'number', min: 1, step: 1 },
  { name: 'draw_min', label: 'Lucky draw: smallest prize (points)', type: 'number', step: 1 },
  { name: 'draw_max', label: 'Lucky draw: biggest prize (points)', type: 'number', step: 1 },
  { name: 'points_per_seat_order', label: 'Points for a bus seat order', type: 'number', step: 1 },
  { name: 'points_per_freight_order', label: 'Points for an accepted freight order', type: 'number', step: 1 },
  { name: 'point_value', label: 'Money value of one reward point', type: 'number', min: 0.01, hint: 'A fare of 1,500 with a value of 10 costs 150 points', wide: true },
];

export function Settings() {
  const state = useFetch('/admin/settings');
  const { refresh } = useAuth();
  const { busy, run } = useSubmit();
  return (
    <>
      <h2>Settings</h2>
      <Async state={state}>
        {(settings) => (
          <div className="card">
            <AutoForm
              fields={SETTING_FIELDS}
              initial={settings}
              busy={busy}
              submitLabel="Save settings"
              onSubmit={(values) => run(() => put('/admin/settings', values).then(refresh), 'Settings saved')}
            />
          </div>
        )}
      </Async>
    </>
  );
}
