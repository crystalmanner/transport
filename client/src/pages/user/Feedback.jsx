import { useState } from 'react';
import { FeatureGate } from '../../components/Gate.jsx';
import { Async, DataTable, Field, Modal, Stars, Tabs } from '../../components/ui.jsx';
import { useSubmit } from '../../context/Toast.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { post } from '../../lib/api.js';
import { formatDateTime } from '../../lib/format.js';

function RateGuard({ trip, onClose, onSent }) {
  const { busy, run } = useSubmit();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');

  const send = async (event) => {
    event.preventDefault();
    if (await run(() => post('/user/feedback', { trip_id: trip.trip_id, stars, comment }), 'Thank you for your feedback')) onSent();
  };

  return (
    <Modal title={`Rate ${trip.guard_name}`} onClose={onClose}>
      <form className="stack" onSubmit={send}>
        <p className="muted">
          Bus {trip.bus_number}, {trip.route}, {formatDateTime(trip.departure_at)}
        </p>
        <div className="field">
          <span>How was the guard?</span>
          <Stars value={stars} onChange={setStars} />
        </div>
        <Field label="Comment (optional)">
          <textarea className="input" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} />
        </Field>
        <button type="submit" className="btn btn-primary" disabled={busy || stars === 0}>
          {stars === 0 ? 'Choose 1 to 5 stars' : 'Send feedback'}
        </button>
      </form>
    </Modal>
  );
}

function ToRate() {
  const state = useFetch('/user/feedback/pending');
  const [trip, setTrip] = useState(null);

  return (
    <>
      <Async state={state} empty="No trip is waiting for your rating. You can rate a guard after riding the bus." emptyIcon="star">
        {(trips) => (
          <DataTable
            rowKey="trip_id"
            columns={[
              { key: 'departure_at', label: 'Trip', render: (row) => formatDateTime(row.departure_at) },
              { key: 'bus_number', label: 'Bus' },
              { key: 'route', label: 'Route' },
              { key: 'guard_name', label: 'Guard' },
            ]}
            rows={trips}
            actions={(row) => (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setTrip(row)}>
                Rate the guard
              </button>
            )}
          />
        )}
      </Async>
      {trip && (
        <RateGuard
          trip={trip}
          onClose={() => setTrip(null)}
          onSent={() => {
            setTrip(null);
            state.reload();
          }}
        />
      )}
    </>
  );
}

function History() {
  const state = useFetch('/user/feedback');
  return (
    <Async state={state} empty="You have not rated a guard yet." emptyIcon="history">
      {(rows) => (
        <DataTable
          columns={[
            { key: 'created_at', label: 'Sent', render: (row) => formatDateTime(row.created_at) },
            { key: 'guard_name', label: 'Guard' },
            { key: 'bus_number', label: 'Bus' },
            { key: 'route', label: 'Route' },
            { key: 'stars', label: 'Rating', render: (row) => <Stars value={row.stars} size={16} /> },
            { key: 'comment', label: 'Comment', render: (row) => row.comment || '-' },
          ]}
          rows={rows}
        />
      )}
    </Async>
  );
}

const TABS = [
  { id: 'rate', label: 'Trips to rate' },
  { id: 'history', label: 'History' },
];

export default function Feedback() {
  const [tab, setTab] = useState('rate');
  return (
    <>
      <h2>Feedback about the Guard</h2>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'rate' ? (
        <FeatureGate feature="guard_feedback">
          <ToRate />
        </FeatureGate>
      ) : (
        <History />
      )}
    </>
  );
}
