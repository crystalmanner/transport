import { useState } from 'react';
import AutoForm from '../../components/AutoForm.jsx';
import Icon from '../../components/Icon.jsx';
import { Async, Badge, DataTable, Modal, Tabs } from '../../components/ui.jsx';
import { useSubmit } from '../../context/Toast.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { del, post, put } from '../../lib/api.js';
import { formatDateTime } from '../../lib/format.js';

/*
 * List, add, edit and delete for one kind of record.
 * path: the admin API path; columns: for the table; fields: for the form (see AutoForm).
 */
function Crud({ path, itemName, columns, fields, onChanged }) {
  const state = useFetch(path);
  const { busy, run } = useSubmit();
  // null: closed. {}: adding. A row: editing it.
  const [editing, setEditing] = useState(null);

  const changed = () => {
    state.reload();
    onChanged?.();
  };

  const save = async (values) => {
    const ok = await run(() => (editing.id ? put(`${path}/${editing.id}`, values) : post(path, values)), 'Saved');
    if (ok) {
      setEditing(null);
      changed();
    }
    return ok;
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete this ${itemName}? This cannot be undone.`)) return;
    if (await run(() => del(`${path}/${row.id}`), 'Deleted')) changed();
  };

  return (
    <>
      <div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing({})}>
          <Icon name="plus" size={18} />
          Add {itemName}
        </button>
      </div>
      <Async state={state} empty={`No ${itemName} yet.`}>
        {(rows) => (
          <DataTable
            columns={columns}
            rows={rows}
            actions={(row) => (
              <>
                <button type="button" className="btn btn-sm" onClick={() => setEditing(row)}>
                  <Icon name="edit" size={16} />
                  Edit
                </button>
                <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={() => remove(row)}>
                  <Icon name="trash" size={16} />
                  Delete
                </button>
              </>
            )}
          />
        )}
      </Async>
      {editing && (
        <Modal title={editing.id ? `Edit ${itemName}` : `Add ${itemName}`} onClose={() => setEditing(null)}>
          <AutoForm single fields={fields} initial={editing} busy={busy} submitLabel="Save" onSubmit={save} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </>
  );
}

// ------------------------------------------------------------------ news

export function NewsAdmin() {
  return (
    <>
      <h2>Manage News</h2>
      <p className="muted">News appears on the first page for everyone. Pinned news stays on top.</p>
      <Crud
        path="/admin/news"
        itemName="news item"
        columns={[
          { key: 'title', label: 'Title', render: (row) => <span className="row" style={{ gap: '0.4rem' }}>{row.title}{Boolean(row.pinned) && <Badge tone="primary">Pinned</Badge>}</span> },
          { key: 'author', label: 'Author' },
          { key: 'created_at', label: 'Published', render: (row) => formatDateTime(row.created_at) },
        ]}
        fields={[
          { name: 'title', label: 'Title' },
          { name: 'body', label: 'Text', type: 'textarea' },
          { name: 'pinned', label: 'Pin to the top', type: 'checkbox' },
        ]}
      />
    </>
  );
}

// --------------------------------------------------- places and routes

const MASTER_TABS = [
  { id: 'provinces', label: 'Provinces' },
  { id: 'parks', label: 'Parks' },
  { id: 'routes', label: 'Routes' },
  { id: 'offices', label: 'Transport offices' },
  { id: 'warehouses', label: 'Warehouses' },
];

const options = (rows) => (rows ?? []).map((row) => ({ value: row.id, label: row.name }));

// The master data behind the two information pages, the bus routes and the freight warehouses.
export function MasterData() {
  const [tab, setTab] = useState('provinces');
  // The dropdowns of one tab are filled from the lists of the others.
  const provinces = useFetch('/admin/provinces');
  const parks = useFetch('/admin/parks');
  const offices = useFetch('/admin/offices');

  const province = { name: 'province_id', label: 'Province', type: 'select', options: options(provinces.data) };
  const address = { name: 'address', label: 'Position (address)', required: false };
  const phone = { name: 'phone', label: 'Phone number', type: 'tel', required: false };

  const configs = {
    provinces: {
      itemName: 'province',
      onChanged: provinces.reload,
      columns: [{ key: 'name', label: 'Name' }],
      fields: [{ name: 'name', label: 'Name' }],
    },
    parks: {
      itemName: 'park',
      onChanged: parks.reload,
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'province', label: 'Province' },
        { key: 'address', label: 'Position' },
        { key: 'working_time', label: 'Working time' },
        { key: 'phone', label: 'Phone' },
      ],
      fields: [{ name: 'name', label: 'Name' }, province, address, { name: 'working_time', label: 'Working time', required: false, placeholder: '05:00 - 22:00' }, phone],
    },
    routes: {
      itemName: 'route',
      columns: [
        { key: 'name', label: 'Route name' },
        { key: 'parks', label: 'Between', render: (row) => `${row.park_a} ↔ ${row.park_b}` },
        { key: 'duration_minutes', label: 'Travel time (min)' },
      ],
      fields: [
        { name: 'name', label: 'Route name' },
        { name: 'park_a_id', label: 'First park (outbound starts here)', type: 'select', options: options(parks.data) },
        { name: 'park_b_id', label: 'Second park (return starts here)', type: 'select', options: options(parks.data) },
        { name: 'duration_minutes', label: 'Travel time in minutes', type: 'number', min: 1, step: 1, hint: 'Used for the forecast arrival time' },
      ],
    },
    offices: {
      itemName: 'transport office',
      onChanged: offices.reload,
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'province', label: 'Province' },
        { key: 'address', label: 'Position' },
        { key: 'phone', label: 'Phone' },
      ],
      fields: [{ name: 'name', label: 'Name' }, province, address, phone],
    },
    warehouses: {
      itemName: 'warehouse',
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'office', label: 'Transport office' },
        { key: 'address', label: 'Position' },
        { key: 'info', label: 'Stores freight from' },
      ],
      fields: [
        { name: 'name', label: 'Name' },
        { name: 'office_id', label: 'Transport office', type: 'select', options: options(offices.data) },
        address,
        { name: 'info', label: 'Information (stores freight from where)', type: 'textarea', required: false },
      ],
    },
  };

  return (
    <>
      <h2>Places and Routes</h2>
      <Tabs tabs={MASTER_TABS} value={tab} onChange={setTab} />
      <Crud key={tab} path={`/admin/${tab}`} {...configs[tab]} />
    </>
  );
}
