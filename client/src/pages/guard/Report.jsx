import { useState } from 'react';
import AutoForm from '../../components/AutoForm.jsx';
import { Async, DataTable, Tabs } from '../../components/ui.jsx';
import { useSubmit } from '../../context/Toast.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { useLookups } from '../../hooks/useLookups.js';
import { post } from '../../lib/api.js';
import { formatDate, formatDateTime, inputDate } from '../../lib/format.js';

const DIRECTION_OPTIONS = [
  { value: 'outbound', label: 'Outbound' },
  { value: 'return', label: 'Return' },
];

const count = (name, label) => ({ name, label, type: 'number', step: 1 });

function ReportForm({ bus, onSent }) {
  const lookups = useLookups();
  const { busy, run } = useSubmit();

  const fields = [
    { name: 'route_id', label: 'Route name', type: 'select', options: lookups.routeOptions },
    { name: 'direction', label: 'Direction', type: 'radio', options: DIRECTION_OPTIONS },
    { name: 'departure_date', label: 'Departure date', type: 'date' },
    count('passengers_count', 'Passengers count'),
    count('repeat_time_count', 'Repeat time count (trips)'),
    count('repeat_date_count', 'Repeat date count (days)'),
    count('deferred_count', 'Fare: deferred payment count'),
    count('free_count', 'Fare: free of charge count'),
    count('count1', 'Fare: count 1'),
    count('count2', 'Fare: count 2'),
    count('count3', 'Fare: count 3'),
  ];

  // The form waits for the route list so the bus's own route can be preselected.
  if (!lookups.ready) return <p className="muted">Loading…</p>;
  return (
    <div className="card">
      <AutoForm
        fields={fields}
        initial={{ route_id: bus.route_id ?? '', direction: 'outbound', departure_date: inputDate(), passengers_count: 0, repeat_time_count: 1, repeat_date_count: 1, deferred_count: 0, free_count: 0, count1: 0, count2: 0, count3: 0 }}
        busy={busy}
        submitLabel="Send report"
        resetOnSuccess
        onSubmit={async (values) => {
          const ok = await run(() => post('/guard/reports', values), 'Daily report sent');
          if (ok) onSent();
          return ok;
        }}
      />
    </div>
  );
}

function History() {
  const state = useFetch('/guard/reports');
  return (
    <Async state={state} empty="No daily report sent yet." emptyIcon="history">
      {(rows) => (
        <DataTable
          columns={[
            { key: 'departure_date', label: 'Departure date', render: (row) => formatDate(row.departure_date) },
            { key: 'route', label: 'Route' },
            { key: 'direction', label: 'Direction', render: (row) => (row.direction === 'return' ? 'Return' : 'Outbound') },
            { key: 'passengers_count', label: 'Passengers' },
            { key: 'repeat_time_count', label: 'Trips' },
            { key: 'repeat_date_count', label: 'Days' },
            { key: 'deferred_count', label: 'Deferred' },
            { key: 'free_count', label: 'Free' },
            { key: 'count1', label: 'Count 1' },
            { key: 'count2', label: 'Count 2' },
            { key: 'count3', label: 'Count 3' },
            { key: 'created_at', label: 'Sent', render: (row) => formatDateTime(row.created_at) },
          ]}
          rows={rows}
        />
      )}
    </Async>
  );
}

const TABS = [
  { id: 'send', label: 'Send report' },
  { id: 'history', label: 'History' },
];

export default function Report({ bus }) {
  const [tab, setTab] = useState('send');
  return (
    <>
      <h2>Operate Daily Report</h2>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'send' ? <ReportForm bus={bus} onSent={() => setTab('history')} /> : <History />}
    </>
  );
}
