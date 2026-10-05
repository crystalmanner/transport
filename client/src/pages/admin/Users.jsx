import { useEffect, useState } from 'react';
import AutoForm from '../../components/AutoForm.jsx';
import { Async, Badge, DataTable, Field, Modal, Notice, Status } from '../../components/ui.jsx';
import { useSubmit } from '../../context/Toast.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useDebounced, useLookups } from '../../hooks/useLookups.js';
import { post, put, query } from '../../lib/api.js';
import { formatDate, formatMoney } from '../../lib/format.js';
import { ROLE_NAMES } from '../../lib/nav.js';
import { useAuth } from '../../context/Auth.jsx';

const ROLE_OPTIONS = Object.entries(ROLE_NAMES).map(([value, label]) => ({ value, label }));

// ------------------------------------------------------------------ users

function EditUser({ user, onClose, onChanged }) {
  const lookups = useLookups();
  const { busy, run } = useSubmit();

  const act = async (action, message) => {
    const ok = await run(action, message);
    if (ok) onChanged();
    return ok;
  };

  return (
    <Modal title={`${user.name} (${user.phone})`} onClose={onClose}>
      <div className="stack">
        <AutoForm
          single
          fields={[
            { name: 'name', label: 'Name' },
            { name: 'role', label: 'Role (permission)', type: 'select', options: ROLE_OPTIONS },
            { name: 'warehouse_id', label: 'Warehouse this manager works for', type: 'select', options: lookups.warehouseOptions, show: (values) => values.role === 'warehouse' },
            { name: 'status', label: 'Account', type: 'radio', options: [{ value: 'active', label: 'Active' }, { value: 'blocked', label: 'Blocked' }] },
          ]}
          initial={{ ...user, warehouse_id: user.warehouse_id ?? '' }}
          busy={busy}
          submitLabel="Save user"
          onSubmit={(values) => act(() => put(`/admin/users/${user.id}`, values), 'User saved')}
        />

        <hr style={{ width: '100%', border: 0, borderTop: '1px solid var(--border)' }} />
        <h3>Reward points: {user.points}</h3>
        <AutoForm
          single
          resetOnSuccess
          fields={[{ name: 'amount', label: 'Points to add (use a minus sign to remove)', type: 'number', min: -1000000, step: 1 }]}
          busy={busy}
          submitLabel="Change points"
          onSubmit={(values) => act(() => post(`/admin/users/${user.id}/points`, values), 'Points changed')}
        />

        <hr style={{ width: '100%', border: 0, borderTop: '1px solid var(--border)' }} />
        <h3>Reset password</h3>
        <AutoForm
          single
          resetOnSuccess
          fields={[{ name: 'password', label: 'New password', hint: 'At least 6 characters. The user is logged out everywhere.' }]}
          busy={busy}
          submitLabel="Set new password"
          onSubmit={(values) => act(() => post(`/admin/users/${user.id}/password`, values), 'Password changed')}
        />
      </div>
    </Modal>
  );
}

export function Users() {
  const [text, setText] = useState('');
  const [role, setRole] = useState('');
  const [editingId, setEditingId] = useState(null);
  const state = useFetch(`/admin/users${query({ q: useDebounced(text), role })}`);
  // Looked up from the fresh list, so the open window shows the new values after each save.
  const editing = state.data?.find((user) => user.id === editingId);

  return (
    <>
      <h2>Manage Users</h2>
      <div className="card form-grid">
        <Field label="Search">
          <input className="input" type="search" value={text} onChange={(event) => setText(event.target.value)} placeholder="Name or phone number" />
        </Field>
        <Field label="Role">
          <select className="input" value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Async state={state} empty="No user matches." emptyIcon="users">
        {(users) => (
          <DataTable
            columns={[
              { key: 'name', label: 'Name', render: (user) => <span className="row" style={{ gap: '0.4rem' }}>{user.name}{Boolean(user.online) && <Badge tone="good">Online</Badge>}</span> },
              { key: 'phone', label: 'Phone' },
              { key: 'role', label: 'Role', render: (user) => `${ROLE_NAMES[user.role]}${user.warehouse ? ` (${user.warehouse})` : ''}` },
              { key: 'status', label: 'Account', render: (user) => <Status value={user.status} /> },
              { key: 'points', label: 'Points' },
              { key: 'subscription_until', label: 'Subscription', render: (user) => (user.subscribed ? `Until ${formatDate(user.subscription_until)}` : user.subscription_until ? 'Expired' : '-') },
              { key: 'created_at', label: 'Joined', render: (user) => formatDate(user.created_at) },
            ]}
            rows={users}
            actions={(user) => (
              <button type="button" className="btn btn-sm" onClick={() => setEditingId(user.id)}>
                Manage
              </button>
            )}
          />
        )}
      </Async>
      {editing && <EditUser user={editing} onClose={() => setEditingId(null)} onChanged={state.reload} />}
    </>
  );
}

// ------------------------------------------------------------ permissions

// What the applicant entered, in words.
function ApplicationDetails({ application }) {
  const lookups = useLookups();
  const { settings } = useAuth();
  const { role, data } = application;
  if (role === 'guard') {
    const route = lookups.routes.find((item) => item.id === data.route_id)?.name ?? 'unknown route';
    return `Bus ${data.bus_number}${data.model ? ` (${data.model})` : ''}, ${route}, fare ${formatMoney(data.fare, settings.currency)}`;
  }
  if (role === 'driver') return `Truck ${data.plate_number}${data.model ? ` (${data.model})` : ''}, ${data.capacity_tons} tons`;
  const warehouse = lookups.warehouses.find((item) => item.id === data.warehouse_id);
  return warehouse ? `${warehouse.name} (${warehouse.office})` : 'Unknown warehouse';
}

function Applications() {
  const state = useFetch('/admin/applications');
  const { busy, run } = useSubmit();

  const decide = async (application, approve) => {
    const note = approve ? '' : window.prompt('Reason for rejecting (the applicant sees it):', '');
    if (note === null) return;
    if (await run(() => post(`/admin/applications/${application.id}/decide`, { approve, note }), approve ? 'Application approved' : 'Application rejected')) state.reload();
  };

  return (
    <Async state={state} empty="No one has applied for a role yet." emptyIcon="users">
      {(applications) => (
        <DataTable
          columns={[
            { key: 'created_at', label: 'Sent', render: (row) => formatDate(row.created_at) },
            { key: 'name', label: 'User', render: (row) => `${row.name}, ${row.phone}` },
            { key: 'role', label: 'Wants to be', render: (row) => ROLE_NAMES[row.role] },
            { key: 'data', label: 'Details', render: (row) => <ApplicationDetails application={row} /> },
            { key: 'status', label: 'Status', render: (row) => <Status value={row.status} /> },
          ]}
          rows={applications}
          actions={(row) =>
            row.status === 'pending' ? (
              <>
                <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => decide(row, true)}>
                  Approve
                </button>
                <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={() => decide(row, false)}>
                  Reject
                </button>
              </>
            ) : null
          }
        />
      )}
    </Async>
  );
}

// The table that decides which User Side functions a Normal user and a Special user may use.
function FeatureTable() {
  const state = useFetch('/admin/permissions');
  const { busy, run } = useSubmit();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    if (state.data) setRows(state.data);
  }, [state.data]);

  if (!rows) return <Async state={state}>{() => null}</Async>;

  const toggle = (feature, column) => setRows(rows.map((row) => (row.feature === feature ? { ...row, [column]: row[column] ? 0 : 1 } : row)));
  const box = (row, column, label) => (
    <label className="check" style={{ minHeight: 0 }}>
      <input type="checkbox" checked={Boolean(row[column])} onChange={() => toggle(row.feature, column)} aria-label={`${row.label}: ${label}`} />
      <span className="small muted">{row[column] ? 'Allowed' : 'Locked'}</span>
    </label>
  );

  return (
    <div className="stack">
      <DataTable
        rowKey="feature"
        columns={[
          { key: 'label', label: 'Function' },
          { key: 'normal_allowed', label: 'Normal user', render: (row) => box(row, 'normal_allowed', 'Normal user') },
          { key: 'special_allowed', label: 'Special user', render: (row) => box(row, 'special_allowed', 'Special user') },
        ]}
        rows={rows}
      />
      <div>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(() => put('/admin/permissions', { features: rows }), 'Permissions saved')}>
          Save permissions
        </button>
      </div>
    </div>
  );
}

export function Permissions() {
  return (
    <>
      <h2>User Permissions</h2>
      <h3>Role applications</h3>
      <p className="muted">Approving gives the user the role and registers the bus, truck or warehouse they entered. A user's role can also be changed directly on the Users page.</p>
      <Applications />
      <h3>Functions for Normal and Special users</h3>
      <Notice>
        A Special User is a user with a paid monthly subscription. Untick "Normal user" to make a function available only to Special Users.
      </Notice>
      <FeatureTable />
    </>
  );
}
