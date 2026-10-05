import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import Shell from '../components/Shell.jsx';
import { Async, Badge, DataTable, Field } from '../components/ui.jsx';
import { useAuth } from '../context/Auth.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useDebounced, useLookups } from '../hooks/useLookups.js';
import { query } from '../lib/api.js';
import { formatMoney } from '../lib/format.js';

function ProvinceSelect({ value, onChange }) {
  const { provinceOptions } = useLookups();
  return (
    <Field label="Province">
      <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All provinces</option>
        {provinceOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Search({ label, value, onChange, placeholder }) {
  return (
    <Field label={label}>
      <input className="input" type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </Field>
  );
}

function Contact({ address, phone, children }) {
  return (
    <ul className="stack-sm muted small">
      {address && (
        <li className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <Icon name="pin" size={16} style={{ flex: 'none', marginTop: 2 }} />
          {address}
        </li>
      )}
      {children}
      {phone && (
        <li className="row" style={{ flexWrap: 'nowrap' }}>
          <Icon name="phone" size={16} style={{ flex: 'none' }} />
          <a className="link" href={`tel:${phone}`}>
            {phone}
          </a>
        </li>
      )}
    </ul>
  );
}

// Transport Office Information: offices by province, each with its warehouses.
export function Offices() {
  const [province, setProvince] = useState('');
  const [text, setText] = useState('');
  const state = useFetch(`/offices${query({ province_id: province, q: useDebounced(text) })}`);

  return (
    <Shell title="Transport Office Information" back="/">
      <div className="card form-grid">
        <ProvinceSelect value={province} onChange={setProvince} />
        <Search label="Search by name" value={text} onChange={setText} placeholder="Office or warehouse name" />
      </div>

      <Async state={state} empty="No transport office matches." emptyIcon="office">
        {(offices) => (
          <div className="cards">
            {offices.map((office) => (
              <article key={office.id} className="card stack">
                <div className="stack-sm">
                  <div className="row between">
                    <h2>{office.name}</h2>
                    <Badge>{office.province}</Badge>
                  </div>
                  <Contact address={office.address} phone={office.phone} />
                </div>
                <div className="stack-sm">
                  <h3 className="muted small">Warehouses ({office.warehouses.length})</h3>
                  {office.warehouses.length === 0 && <p className="muted small">No warehouse registered.</p>}
                  {office.warehouses.map((warehouse) => (
                    <div key={warehouse.id} className="notice" style={{ display: 'grid', gap: '0.25rem' }}>
                      <p className="strong" style={{ color: 'var(--text)' }}>
                        {warehouse.name}
                      </p>
                      <Contact address={warehouse.address} />
                      {warehouse.info && <p className="small">{warehouse.info}</p>}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </Async>
    </Shell>
  );
}

// Park Information: parks by province, each with the buses that use it.
export function Parks() {
  const { settings } = useAuth();
  const [province, setProvince] = useState('');
  const [text, setText] = useState('');
  const [route, setRoute] = useState('');
  const state = useFetch(`/parks${query({ province_id: province, q: useDebounced(text), route: useDebounced(route) })}`);

  const columns = [
    { key: 'route', label: 'Route' },
    { key: 'bus_number', label: 'Bus' },
    { key: 'fare', label: 'Fare', render: (bus) => formatMoney(bus.fare, settings.currency) },
    { key: 'departure_time', label: 'Departure', render: (bus) => bus.departure_time || '-' },
    { key: 'note', label: 'Note', render: (bus) => bus.note || '-' },
  ];

  return (
    <Shell title="Park Information" back="/">
      <div className="card form-grid">
        <ProvinceSelect value={province} onChange={setProvince} />
        <Search label="Park name" value={text} onChange={setText} placeholder="Search parks" />
        <Search label="Bus route" value={route} onChange={setRoute} placeholder="Search by route name" />
      </div>

      <Async state={state} empty="No park matches." emptyIcon="pin">
        {(parks) => (
          <div className="stack">
            {parks.map((park) => (
              <article key={park.id} className="card stack">
                <div className="stack-sm">
                  <div className="row between">
                    <h2>{park.name}</h2>
                    <Badge>{park.province}</Badge>
                  </div>
                  <Contact address={park.address} phone={park.phone}>
                    {park.working_time && (
                      <li className="row" style={{ flexWrap: 'nowrap' }}>
                        <Icon name="clock" size={16} style={{ flex: 'none' }} />
                        Working time: {park.working_time}
                      </li>
                    )}
                  </Contact>
                </div>
                {park.buses.length === 0 ? <p className="muted small">No bus uses this park yet.</p> : <DataTable columns={columns} rows={park.buses} />}
              </article>
            ))}
          </div>
        )}
      </Async>
    </Shell>
  );
}

// Park Side is not designed yet.
export function ParkSide() {
  return (
    <Shell title="Park Side" back="/">
      <div className="card muted" style={{ display: 'grid', justifyItems: 'center', gap: '0.75rem', padding: '3rem 1rem', textAlign: 'center' }}>
        <Icon name="park" size={40} />
        <h2 style={{ color: 'var(--text)' }}>In preparation</h2>
        <p>The Park Side is being prepared and will open later.</p>
      </div>
    </Shell>
  );
}
