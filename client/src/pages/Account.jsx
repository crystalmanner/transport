import { useState } from 'react';
import AutoForm from '../components/AutoForm.jsx';
import Gate from '../components/Gate.jsx';
import Icon from '../components/Icon.jsx';
import LuckyDraw from '../components/LuckyDraw.jsx';
import Shell from '../components/Shell.jsx';
import { Async, Badge, DataTable, Notice, Status, Tabs } from '../components/ui.jsx';
import { useAuth } from '../context/Auth.jsx';
import { useSubmit } from '../context/Toast.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useLookups } from '../hooks/useLookups.js';
import { post, put } from '../lib/api.js';
import { formatDate, formatDateTime, formatMoney, humanize } from '../lib/format.js';
import { ROLE_NAMES } from '../lib/nav.js';

const POINT_REASONS = {
  lucky_draw: 'Lucky draw',
  seat_order: 'Bus seat order',
  seat_payment: 'Paid for a bus seat',
  seat_refund: 'Refund for a cancelled seat',
  seat_cancel: 'Cancelled seat order',
  freight_order: 'Freight order',
  freight_payment: 'Paid for freight',
  admin_adjust: 'Changed by the admin',
};

function Profile() {
  const { user, settings, refresh, logout } = useAuth();
  const { busy, run } = useSubmit();

  return (
    <div className="stack">
      <section className="card stack">
        <dl className="facts">
          <div>
            <dt>Name</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>Phone number</dt>
            <dd>{user.phone}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{ROLE_NAMES[user.role]}</dd>
          </div>
          <div>
            <dt>Account type</dt>
            <dd>{user.subscribed ? <Badge tone="primary">Special</Badge> : <Badge>Normal</Badge>}</dd>
          </div>
          <div>
            <dt>Subscription</dt>
            <dd>{user.subscribed ? `Paid until ${formatDate(user.subscription_until)}` : 'Not active'}</dd>
          </div>
        </dl>
        {!user.subscribed && (
          <Notice icon="card">
            A subscription costs {formatMoney(settings.subscription_price, settings.currency)} per month and makes you a Special User.
            Guards and truck drivers need it to work. Pay at the office; the admin then activates it.
          </Notice>
        )}
      </section>

      <section className="card stack">
        <h2>Change your name</h2>
        <AutoForm single fields={[{ name: 'name', label: 'Name' }]} initial={{ name: user.name }} busy={busy} submitLabel="Save" onSubmit={(values) => run(() => put('/auth/profile', values).then(refresh), 'Name saved')} />
      </section>

      <section className="card stack">
        <h2>Change your password</h2>
        <AutoForm
          single
          resetOnSuccess
          fields={[
            { name: 'current_password', label: 'Current password', type: 'password' },
            { name: 'new_password', label: 'New password', type: 'password', hint: 'At least 6 characters' },
          ]}
          busy={busy}
          submitLabel="Change password"
          onSubmit={(values) => run(() => put('/auth/password', values), 'Password changed')}
        />
      </section>

      <button type="button" className="btn btn-danger" onClick={logout}>
        <Icon name="logout" />
        Log out
      </button>
    </div>
  );
}

function Points() {
  const { user } = useAuth();
  // Reloaded whenever the balance changes, so a new lucky draw shows up in the list.
  const state = useFetch(`/points?balance=${user.points}`);

  return (
    <div className="stack">
      <section className="card stack">
        <div>
          <p className="muted small">Reward points</p>
          <p className="num" style={{ fontSize: '2.2rem', fontWeight: 750, color: 'var(--warn)', lineHeight: 1.1 }}>
            {user.points}
          </p>
        </div>
        <LuckyDraw />
      </section>
      <h2>Point history</h2>
      <Async state={state}>
        {(data) =>
          data.transactions.length === 0 ? (
            <p className="muted">No points yet. Press the lucky draw or place an order.</p>
          ) : (
            <DataTable
              columns={[
                { key: 'created_at', label: 'Date', render: (row) => formatDateTime(row.created_at) },
                { key: 'reason', label: 'Reason', render: (row) => POINT_REASONS[row.reason] ?? humanize(row.reason) },
                {
                  key: 'amount',
                  label: 'Points',
                  render: (row) => (
                    <span className="num strong" style={{ color: row.amount > 0 ? 'var(--good)' : 'var(--bad)' }}>
                      {row.amount > 0 ? `+${row.amount}` : row.amount}
                    </span>
                  ),
                },
              ]}
              rows={data.transactions}
            />
          )
        }
      </Async>
    </div>
  );
}

const ROLE_CHOICES = [
  { id: 'guard', label: 'Guard' },
  { id: 'driver', label: 'Truck Driver' },
  { id: 'warehouse', label: 'Warehouse Manager' },
];

// A normal user asks for a working role here; the admin approves it.
function RoleApplication() {
  const { user, refresh } = useAuth();
  const lookups = useLookups();
  const { busy, run } = useSubmit();
  const [role, setRole] = useState('guard');
  const state = useFetch('/user/applications');

  const fields = {
    guard: [
      { name: 'bus_number', label: 'Bus number' },
      { name: 'model', label: 'Bus model', required: false },
      { name: 'route_id', label: 'Route', type: 'select', options: lookups.routeOptions },
      { name: 'fare', label: 'Fare', type: 'number' },
    ],
    driver: [
      { name: 'plate_number', label: 'Truck plate number' },
      { name: 'model', label: 'Truck model', required: false },
      { name: 'capacity_tons', label: 'Capacity (tons)', type: 'number' },
    ],
    warehouse: [{ name: 'warehouse_id', label: 'Warehouse you manage', type: 'select', options: lookups.warehouseOptions, wide: true }],
  };

  const pending = state.data?.some((application) => application.status === 'pending');

  return (
    <div className="stack">
      {user.role !== 'user' ? (
        <Notice tone="good" icon="check">
          Your account has the role <span className="strong">{ROLE_NAMES[user.role]}</span>.
        </Notice>
      ) : pending ? (
        <Notice icon="clock">Your application is waiting for the admin.</Notice>
      ) : (
        <section className="card stack">
          <p className="muted">Choose the role you want to work as and enter your details. The admin checks and approves the application.</p>
          <div className="segmented">
            {ROLE_CHOICES.map((choice) => (
              <button key={choice.id} type="button" aria-pressed={role === choice.id} onClick={() => setRole(choice.id)}>
                {choice.label}
              </button>
            ))}
          </div>
          <AutoForm
            key={role}
            fields={fields[role]}
            busy={busy}
            submitLabel="Send application"
            onSubmit={(values) =>
              run(async () => {
                await post('/user/applications', { role, ...values });
                state.reload();
                refresh();
              }, 'Application sent')
            }
          />
        </section>
      )}

      {state.data?.length > 0 && (
        <>
          <h2>Your applications</h2>
          <DataTable
            columns={[
              { key: 'created_at', label: 'Sent', render: (row) => formatDateTime(row.created_at) },
              { key: 'role', label: 'Role', render: (row) => ROLE_NAMES[row.role] },
              { key: 'status', label: 'Status', render: (row) => <Status value={row.status} /> },
              { key: 'admin_note', label: 'Admin note', render: (row) => row.admin_note || '-' },
            ]}
            rows={state.data}
          />
        </>
      )}
    </div>
  );
}

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'points', label: 'Reward points' },
  { id: 'role', label: 'Apply for a role' },
];

export default function Account() {
  const [tab, setTab] = useState('profile');
  return (
    <Gate>
      <Shell title="Account" back="/">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
        {tab === 'profile' && <Profile />}
        {tab === 'points' && <Points />}
        {tab === 'role' && <RoleApplication />}
      </Shell>
    </Gate>
  );
}
