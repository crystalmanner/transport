import { useEffect, useRef, useState } from 'react';
import { FeatureGate } from '../../components/Gate.jsx';
import SeatMap, { SeatLegend } from '../../components/SeatMap.jsx';
import { Async, DataTable, Field, Modal, Notice, Status, Tabs } from '../../components/ui.jsx';
import { useAuth } from '../../context/Auth.jsx';
import { useSubmit } from '../../context/Toast.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useDebounced } from '../../hooks/useLookups.js';
import { post, query } from '../../lib/api.js';
import { formatDateTime, formatMoney } from '../../lib/format.js';

// The bus drawing: tap a free seat, enter the passenger's phone number, reserve.
function SeatOrder({ tripId, onClose }) {
  const { user, settings, features, refresh } = useAuth();
  const { busy, run } = useSubmit();
  const state = useFetch(`/user/trips/${tripId}`);
  const [seat, setSeat] = useState(null);
  const [phone, setPhone] = useState(user.phone);
  const [usePoints, setUsePoints] = useState(false);

  // On a phone the form is below the bus drawing, so it is brought into view when a seat is tapped.
  const panel = useRef(null);
  useEffect(() => {
    if (seat) panel.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [seat]);

  const reserve = async (event) => {
    event.preventDefault();
    const ok = await run(() => post(`/user/trips/${tripId}/reserve`, { seat, phone, use_points: usePoints }), `Seat ${seat} is reserved`);
    // Reloaded even after a failure: "seat just taken" means the picture on screen is out of date.
    state.reload();
    if (ok) {
      setSeat(null);
      refresh();
    }
  };

  return (
    <Modal title="Choose a seat" onClose={onClose} wide>
      <Async state={state}>
        {(trip) => (
          <div className="stack">
            <dl className="facts">
              <div>
                <dt>Bus</dt>
                <dd>
                  {trip.bus_number} {trip.model && <span className="muted">({trip.model})</span>}
                </dd>
              </div>
              <div>
                <dt>Route</dt>
                <dd>
                  {trip.departure_park} → {trip.arrival_park}
                </dd>
              </div>
              <div>
                <dt>Departure</dt>
                <dd>{formatDateTime(trip.departure_at)}</dd>
              </div>
              <div>
                <dt>Fare</dt>
                <dd>{formatMoney(trip.fare, settings.currency)}</dd>
              </div>
            </dl>

            <div className="split">
              <div className="stack">
                <SeatLegend mine />
                <SeatMap layout={trip.layout} seats={trip.seats} selected={seat} onSeat={setSeat} canPick={(number, info) => !info && trip.status === 'preparing'} />
              </div>
              <div ref={panel}>
                {trip.status !== 'preparing' ? (
                  <Notice tone="warn">This bus is no longer taking reservations.</Notice>
                ) : seat ? (
                  <form className="stack" onSubmit={reserve}>
                    <h3>Reserve seat {seat}</h3>
                    <Field label="Passenger phone number" hint="The guard uses it to find the passenger">
                      <input className="input" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required />
                    </Field>
                    {features.pay_with_points !== false && (
                      <label className="check">
                        <input type="checkbox" checked={usePoints} onChange={(event) => setUsePoints(event.target.checked)} />
                        <span>
                          Pay with reward points: {trip.point_cost} points <span className="muted">(you have {user.points})</span>
                        </span>
                      </label>
                    )}
                    <p className="muted small">
                      {usePoints
                        ? 'The fare is paid with your points.'
                        : `Pay the fare to the guard on the bus. You get ${settings.points_per_seat_order} reward points for this order.`}
                    </p>
                    <button type="submit" className="btn btn-primary" disabled={busy}>
                      {busy ? 'Reserving…' : `Reserve seat ${seat}`}
                    </button>
                  </form>
                ) : (
                  <p className="muted">Tap a free seat to reserve it.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Async>
    </Modal>
  );
}

function FindBus() {
  const { settings } = useAuth();
  const [text, setText] = useState('');
  const [tripId, setTripId] = useState(null);
  const state = useFetch(`/user/trips${query({ route: useDebounced(text) })}`);

  return (
    <>
      <Field label="Search by route">
        <input className="input" type="search" value={text} onChange={(event) => setText(event.target.value)} placeholder="Route name, for example Northgate" />
      </Field>
      <Async state={state} empty="No bus is taking reservations on this route now." emptyIcon="bus">
        {(trips) => (
          <DataTable
            columns={[
              { key: 'bus_number', label: 'Bus number' },
              { key: 'route', label: 'Route' },
              { key: 'departure_park', label: 'Departure park' },
              { key: 'departure_at', label: 'Departure time', render: (trip) => formatDateTime(trip.departure_at) },
              { key: 'seats', label: 'Free seats', render: (trip) => `${trip.seat_count - trip.taken} of ${trip.seat_count}` },
              { key: 'fare', label: 'Fare', render: (trip) => formatMoney(trip.fare, settings.currency) },
            ]}
            rows={trips}
            actions={(trip) => (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setTripId(trip.id)}>
                Order
              </button>
            )}
          />
        )}
      </Async>
      {tripId && (
        <SeatOrder
          tripId={tripId}
          onClose={() => {
            setTripId(null);
            state.reload();
          }}
        />
      )}
    </>
  );
}

function History() {
  const { refresh } = useAuth();
  const { busy, run } = useSubmit();
  const state = useFetch('/user/reservations');

  const cancel = async (row) => {
    if (!window.confirm(`Cancel the reservation of seat ${row.seat}?`)) return;
    if (await run(() => post(`/user/reservations/${row.id}/cancel`), 'Reservation cancelled')) {
      state.reload();
      refresh();
    }
  };

  return (
    <Async state={state} empty="You have not reserved a seat yet." emptyIcon="history">
      {(rows) => (
        <DataTable
          columns={[
            { key: 'departure_at', label: 'Departure', render: (row) => formatDateTime(row.departure_at) },
            { key: 'bus_number', label: 'Bus' },
            { key: 'route', label: 'Route', render: (row) => `${row.departure_park} → ${row.arrival_park}` },
            { key: 'seat', label: 'Seat' },
            { key: 'phone', label: 'Phone' },
            { key: 'status', label: 'Seat status', render: (row) => <Status value={row.status} /> },
            { key: 'trip_status', label: 'Bus status', render: (row) => <Status value={row.trip_status} /> },
            { key: 'paid', label: 'Payment', render: (row) => (row.points_used ? `${row.points_used} points` : 'To the guard') },
          ]}
          rows={rows}
          actions={(row) =>
            row.status === 'reserved' && row.trip_status === 'preparing' ? (
              <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => cancel(row)}>
                Cancel
              </button>
            ) : null
          }
        />
      )}
    </Async>
  );
}

const TABS = [
  { id: 'find', label: 'Find a bus' },
  { id: 'history', label: 'History' },
];

export default function BusSeat() {
  const [tab, setTab] = useState('find');
  return (
    <>
      <h2>Order Bus Seat</h2>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'find' ? (
        <FeatureGate feature="bus_seat_order">
          <FindBus />
        </FeatureGate>
      ) : (
        <History />
      )}
    </>
  );
}
