import { useState } from 'react';
import AutoForm from '../../components/AutoForm.jsx';
import SeatDesigner from '../../components/SeatDesigner.jsx';
import SeatMap, { SeatLegend } from '../../components/SeatMap.jsx';
import { Async, Badge, DataTable, Field, Modal, Notice, Stars, Status, Tabs } from '../../components/ui.jsx';
import { useSubmit } from '../../context/Toast.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useLookups } from '../../hooks/useLookups.js';
import { post, put } from '../../lib/api.js';
import { formatDateTime } from '../../lib/format.js';

// ------------------------------------------------------------ seat status

// What the guard can do with the seat that was tapped.
function SeatAction({ tripId, seat, info, onClose, onDone }) {
  const { busy, run } = useSubmit();
  const [phone, setPhone] = useState('');

  const act = async (action, message) => {
    const body = { seat, action, ...(action === 'occupy' && !info && phone ? { phone } : {}) };
    if (await run(() => post(`/guard/trips/${tripId}/seats`, body), message)) onDone();
  };

  return (
    <Modal title={`Seat ${seat}`} onClose={onClose}>
      <div className="stack">
        {info ? (
          <dl className="facts">
            <div>
              <dt>Status</dt>
              <dd>
                <Status value={info.status} />
              </dd>
            </div>
            <div>
              <dt>Passenger</dt>
              <dd>{info.name ?? 'Seated by the guard'}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{info.phone ? <a className="link" href={`tel:${info.phone}`}>{info.phone}</a> : '-'}</dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>{info.paid_with_points ? 'Paid with reward points' : 'Pays the guard'}</dd>
            </div>
          </dl>
        ) : (
          <>
            <p className="muted">This seat is free. Mark it as in use when a passenger without a reservation sits here.</p>
            <Field label="Passenger phone number (optional)">
              <input className="input" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </Field>
          </>
        )}
        <div className="row">
          {info?.status !== 'occupied' && (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act('occupy', `Seat ${seat} is in use`)}>
              {info ? 'Passenger is on the bus' : 'Mark as in use'}
            </button>
          )}
          {info && (
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => act('free', `Seat ${seat} is free again`)}>
              {info.status === 'reserved' ? 'Cancel the reservation' : 'Free the seat'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function TripSeats({ tripId }) {
  const state = useFetch(`/guard/trips/${tripId}`);
  const [seat, setSeat] = useState(null);

  return (
    <Async state={state}>
      {(trip) => {
        const held = Object.entries(trip.seats).map(([number, info]) => ({ number, ...info }));
        const reserved = held.filter((item) => item.status === 'reserved').length;
        const open = ['preparing', 'departed'].includes(trip.status);
        return (
          <div className="stack">
            <div className="row">
              <Badge tone="good">Free: {trip.seat_count - held.length}</Badge>
              <Badge tone="warn">Reserved: {reserved}</Badge>
              <Badge>In use: {held.length - reserved}</Badge>
              <button type="button" className="btn btn-sm" onClick={state.reload} disabled={state.loading}>
                {state.loading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
            <div className="card stack">
              <SeatLegend />
              <SeatMap layout={trip.layout} seats={trip.seats} onSeat={open ? setSeat : undefined} />
              <p className="muted small" style={{ textAlign: 'center' }}>
                {open ? 'Tap a seat to see the passenger or change the seat.' : 'This trip is finished; the seats can no longer be changed.'}
              </p>
            </div>
            {held.length > 0 && (
              <DataTable
                rowKey="number"
                columns={[
                  { key: 'number', label: 'Seat' },
                  { key: 'name', label: 'Passenger', render: (row) => row.name ?? 'Seated by the guard' },
                  { key: 'phone', label: 'Phone', render: (row) => row.phone || '-' },
                  { key: 'status', label: 'Status', render: (row) => <Status value={row.status} /> },
                  { key: 'paid', label: 'Payment', render: (row) => (row.paid_with_points ? 'Reward points' : 'To the guard') },
                ]}
                rows={held.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))}
              />
            )}
            {seat && (
              <SeatAction
                tripId={tripId}
                seat={seat}
                info={trip.seats[seat]}
                onClose={() => setSeat(null)}
                onDone={() => {
                  setSeat(null);
                  state.reload();
                }}
              />
            )}
          </div>
        );
      }}
    </Async>
  );
}

function SeatStatus() {
  const trips = useFetch('/guard/trips');
  const [picked, setPicked] = useState('');

  return (
    <Async state={trips} empty='No trip yet. Send "Preparing" on Route Operation Information to open one.' emptyIcon="bus">
      {(list) => {
        // The newest trip is the one the guard is working on.
        const tripId = picked || String(list[0].id);
        return (
          <>
            <Field label="Trip">
              <select className="input" value={tripId} onChange={(event) => setPicked(event.target.value)}>
                {list.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {formatDateTime(trip.departed_at ?? trip.departure_at)} · {trip.departure_park} → {trip.arrival_park} · {trip.status}
                  </option>
                ))}
              </select>
            </Field>
            <TripSeats key={tripId} tripId={tripId} />
          </>
        );
      }}
    </Async>
  );
}

// ------------------------------------------------------------ seat design

function SeatDesign({ bus, onSaved }) {
  const { busy, run } = useSubmit();
  const [kept, setKept] = useState(false);

  const save = async (layout) => {
    const result = await run(() => put('/guard/bus/layout', { layout }), 'Seat design saved');
    if (!result) return;
    setKept(!result.applied_to_open_trip);
    onSaved();
  };

  return (
    <div className="stack">
      <p className="muted">
        Draw your bus as it really is, so passengers choose the right seat. Buses differ, so every square of the floor can be a seat, the driver, a door, a WC,
        stairs or empty.
      </p>
      {kept && (
        <Notice>
          Saved. A trip that is already open with reserved seats keeps its old design; the new design is used from the next trip you prepare.
        </Notice>
      )}
      <SeatDesigner initial={bus.layout} busy={busy} onSave={save} />
    </div>
  );
}

// -------------------------------------------------------- bus information

export function BusInfoForm({ bus, onSaved }) {
  const lookups = useLookups();
  const { busy, run } = useSubmit();
  if (!lookups.ready) return <p className="muted">Loading…</p>;
  return (
    <AutoForm
      fields={[
        { name: 'bus_number', label: 'Bus number' },
        { name: 'model', label: 'Bus model', required: false },
        { name: 'route_id', label: 'Route', type: 'select', options: lookups.routeOptions },
        { name: 'fare', label: 'Fare', type: 'number' },
        { name: 'departure_time', label: 'Usual departure', required: false, placeholder: 'For example 07:30 every day' },
        { name: 'note', label: 'Note', required: false },
      ]}
      initial={bus ?? {}}
      busy={busy}
      submitLabel="Save bus information"
      onSubmit={async (values) => {
        const ok = await run(() => put('/guard/bus', values), 'Bus information saved');
        if (ok) onSaved();
        return ok;
      }}
    />
  );
}

function BusInfo({ bus, onSaved }) {
  const feedback = useFetch('/guard/feedback');
  return (
    <div className="stack">
      <div className="card stack">
        <p className="muted small">This is what users see in Park Information and in the searches.</p>
        <BusInfoForm bus={bus} onSaved={onSaved} />
      </div>
      <h3>Your rating</h3>
      <Async state={feedback}>
        {(data) => (
          <>
            <div className="card row">
              <Stars value={data.rating} />
              <span className="strong num">{Number(data.rating).toFixed(1)}</span>
              <span className="muted">from {data.ratings} rating{data.ratings === 1 ? '' : 's'}</span>
            </div>
            {data.list.length > 0 && (
              <DataTable
                columns={[
                  { key: 'created_at', label: 'Date', render: (row) => formatDateTime(row.created_at) },
                  { key: 'stars', label: 'Rating', render: (row) => <Stars value={row.stars} size={16} /> },
                  { key: 'comment', label: 'Comment', render: (row) => row.comment || '-' },
                ]}
                rows={data.list}
              />
            )}
          </>
        )}
      </Async>
    </div>
  );
}

const TABS = [
  { id: 'status', label: 'Seat status' },
  { id: 'design', label: 'Seat design' },
  { id: 'bus', label: 'Bus information' },
];

export default function Seats({ bus, onBusChanged }) {
  const [tab, setTab] = useState('status');
  return (
    <>
      <h2>Status of Order</h2>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'status' && <SeatStatus />}
      {tab === 'design' && <SeatDesign bus={bus} onSaved={onBusChanged} />}
      {tab === 'bus' && <BusInfo bus={bus} onSaved={onBusChanged} />}
    </>
  );
}
