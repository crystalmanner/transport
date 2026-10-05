import { useEffect, useState } from 'react';
import { Async, DataTable, Field, Notice, Status, Tabs } from '../../components/ui.jsx';
import { useSubmit } from '../../context/Toast.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useLookups } from '../../hooks/useLookups.js';
import { post } from '../../lib/api.js';
import { formatDateTime, inputDateTime } from '../../lib/format.js';

const STATUSES = [
  { id: 'preparing', label: 'Preparing' },
  { id: 'departed', label: 'Departed' },
  { id: 'arrived', label: 'Arrived' },
];

const DIRECTIONS = { outbound: 'Outbound', return: 'Return' };

function Select({ label, value, onChange, options, hint }) {
  return (
    <Field label={label} hint={hint}>
      <select className="input" value={value} onChange={(event) => onChange(event.target.value)} required>
        <option value="">Choose…</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function DateTime({ label, value, onChange }) {
  return (
    <Field label={label}>
      <input className="input" type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} required />
    </Field>
  );
}

/*
 * The form changes with the status the guard is reporting:
 *   preparing -> departure park, direction, departure date and time (opens the trip for reservations)
 *   departed  -> departure park, route, departure date and time
 *   arrived   -> arrival park, arrival date and time
 */
function StatusForm({ bus, trip, onSent }) {
  const lookups = useLookups();
  const { busy, run } = useSubmit();
  // The natural next step is preselected; the guard can still pick another.
  const [status, setStatus] = useState(trip?.status === 'preparing' ? 'departed' : trip?.status === 'departed' ? 'arrived' : 'preparing');
  const [form, setForm] = useState({
    route_id: String(trip?.route_id ?? bus.route_id ?? ''),
    direction: trip?.direction ?? 'outbound',
    departure_park_id: String(trip?.departure_park_id ?? ''),
    arrival_park_id: String(trip?.arrival_park_id ?? ''),
    at: inputDateTime(),
  });
  const set = (name) => (value) => setForm((prev) => ({ ...prev, [name]: value }));

  const route = lookups.routes.find((item) => String(item.id) === form.route_id);

  // Choosing the route or the direction fills in the park the bus leaves from; the guard can still change it.
  const fillPark = (routeId, direction) => {
    const picked = lookups.routes.find((item) => String(item.id) === String(routeId));
    setForm((prev) => ({
      ...prev,
      route_id: String(routeId),
      direction,
      departure_park_id: picked ? String(direction === 'return' ? picked.park_b_id : picked.park_a_id) : prev.departure_park_id,
    }));
  };
  useEffect(() => {
    if (lookups.ready && !trip && !form.departure_park_id && form.route_id) fillPark(form.route_id, form.direction);
  }, [lookups.ready]);

  const send = async (event) => {
    event.preventDefault();
    const body =
      status === 'preparing'
        ? { status, departure_park_id: form.departure_park_id, route_id: form.route_id, direction: form.direction, departure_at: form.at }
        : status === 'departed'
          ? { status, departure_park_id: form.departure_park_id, route_id: form.route_id, departure_at: form.at }
          : { status, arrival_park_id: form.arrival_park_id, arrived_at: form.at };
    if (await run(() => post('/guard/status', body), 'Information sent')) onSent();
  };

  return (
    <form className="card stack" onSubmit={send}>
      <div className="field">
        <span>Current status of the bus</span>
        <div className="segmented">
          {STATUSES.map((item) => (
            <button key={item.id} type="button" aria-pressed={status === item.id} onClick={() => setStatus(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-grid">
        {status !== 'arrived' && <Select label="Route name" value={form.route_id} onChange={(value) => fillPark(value, form.direction)} options={lookups.routeOptions} />}
        {status === 'preparing' && (
          <fieldset className="field">
            <legend>Direction</legend>
            <div className="segmented">
              {Object.entries(DIRECTIONS).map(([value, label]) => (
                <label key={value}>
                  <input type="radio" name="direction" checked={form.direction === value} onChange={() => fillPark(form.route_id, value)} />
                  {label}
                  {route && <span className="small muted">({value === 'outbound' ? `${route.park_a} → ${route.park_b}` : `${route.park_b} → ${route.park_a}`})</span>}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {status !== 'arrived' && <Select label="Departure park" value={form.departure_park_id} onChange={set('departure_park_id')} options={lookups.parkOptions} />}
        {status === 'arrived' && <Select label="Arrival park" value={form.arrival_park_id} onChange={set('arrival_park_id')} options={lookups.parkOptions} />}
        <DateTime label={status === 'arrived' ? 'Arrival date and time' : 'Departure date and time'} value={form.at} onChange={set('at')} />
      </div>

      <p className="muted small">
        {status === 'preparing' && 'Sending this opens the trip, and users can reserve seats until the bus departs.'}
        {status === 'departed' && 'Sending this closes reservations and starts the arrival forecast.'}
        {status === 'arrived' && 'Sending this finishes the trip. Passengers can then rate you.'}
      </p>
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Sending…' : 'Send information'}
        </button>
      </div>
    </form>
  );
}

function Current({ bus, trip }) {
  return (
    <section className="card stack">
      <div className="row between">
        <h3>
          Bus {bus.bus_number} {bus.model && <span className="muted small">{bus.model}</span>}
        </h3>
        <Status value={bus.status} />
      </div>
      {trip ? (
        <dl className="facts">
          <div>
            <dt>Route</dt>
            <dd>
              {trip.route} ({DIRECTIONS[trip.direction]})
            </dd>
          </div>
          <div>
            <dt>Parks</dt>
            <dd>
              {trip.departure_park} → {trip.arrival_park}
            </dd>
          </div>
          <div>
            <dt>{trip.departed_at ? 'Departed' : 'Planned departure'}</dt>
            <dd>{formatDateTime(trip.departed_at ?? trip.departure_at)}</dd>
          </div>
          <div>
            <dt>Forecast arrival</dt>
            <dd>{formatDateTime(trip.eta)}</dd>
          </div>
          <div>
            <dt>Seats taken</dt>
            <dd>
              {trip.taken} of {trip.seat_count}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="muted">No trip is open. Send "Preparing" to open the next trip for reservations.</p>
      )}
    </section>
  );
}

function History() {
  const state = useFetch('/guard/status/history');
  return (
    <Async state={state} empty="Nothing sent yet." emptyIcon="history">
      {(rows) => (
        <DataTable
          columns={[
            { key: 'created_at', label: 'Sent', render: (row) => formatDateTime(row.created_at) },
            { key: 'status', label: 'Status', render: (row) => <Status value={row.status} /> },
            { key: 'park', label: 'Park' },
            { key: 'route', label: 'Route' },
            { key: 'direction', label: 'Direction', render: (row) => DIRECTIONS[row.direction] ?? '-' },
            { key: 'reported_at', label: 'Date and time', render: (row) => formatDateTime(row.reported_at) },
          ]}
          rows={rows}
        />
      )}
    </Async>
  );
}

const TABS = [
  { id: 'send', label: 'Send information' },
  { id: 'history', label: 'History' },
];

export default function Operation() {
  const [tab, setTab] = useState('send');
  const state = useFetch('/guard/status');

  return (
    <>
      <h2>Route Operation Information</h2>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'history' ? (
        <History />
      ) : (
        <Async state={state}>
          {({ bus, trip }) => (
            <>
              <Current bus={bus} trip={trip} />
              {!bus.route_id && <Notice tone="warn">Your bus has no route yet. Set it under Status of Order, Bus information.</Notice>}
              {/* The key rebuilds the form with fresh defaults after every status change. */}
              <StatusForm key={`${trip?.id ?? 'none'}-${trip?.status ?? bus.status}`} bus={bus} trip={trip} onSent={state.reload} />
            </>
          )}
        </Async>
      )}
    </>
  );
}
