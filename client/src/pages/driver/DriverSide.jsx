import { useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import AutoForm from '../../components/AutoForm.jsx';
import { TimeAction } from '../../components/Freight.jsx';
import Gate from '../../components/Gate.jsx';
import Shell from '../../components/Shell.jsx';
import { Async, Badge, DataTable, Field, Notice, Status, Tabs } from '../../components/ui.jsx';
import { useSubmit } from '../../context/Toast.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { post, put } from '../../lib/api.js';
import { formatDate, formatDateTime, formatNumber, inputDate } from '../../lib/format.js';

const NAV = [
  { to: '/driver', label: 'Operating Status Information', icon: 'truck', end: true },
  { to: '/driver/report', label: 'Operate Daily Report', icon: 'list' },
  { to: '/driver/commands', label: 'Transport Commands', icon: 'box' },
];

const SEND_TABS = [
  { id: 'send', label: 'Send' },
  { id: 'history', label: 'History' },
];

const PREP_TYPES = { urban: 'Urban transport preparing', long: 'Long distance transport preparing' };

// ------------------------------------------------- operating status

const STATUSES = [
  { id: 'preparing', label: 'Preparing' },
  { id: 'working', label: 'Working' },
  { id: 'repairing', label: 'Repairing' },
  { id: 'downtime', label: 'Car downtime' },
];

function StatusForm({ truck, onSent }) {
  const { busy, run } = useSubmit();
  const [status, setStatus] = useState(truck.status);
  const [position, setPosition] = useState(truck.current_position);
  const [prepType, setPrepType] = useState(truck.prep_type ?? 'urban');

  const send = async (event) => {
    event.preventDefault();
    // Only "preparing" carries input; the other statuses are sent as they are.
    const body = status === 'preparing' ? { status, position, prep_type: prepType } : { status };
    if (await run(() => post('/driver/status', body), 'Status sent')) onSent();
  };

  return (
    <form className="card stack" onSubmit={send}>
      <div className="field">
        <span>Current status of the car</span>
        <div className="segmented">
          {STATUSES.map((item) => (
            <button key={item.id} type="button" aria-pressed={status === item.id} onClick={() => setStatus(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {status === 'preparing' ? (
        <div className="form-grid">
          <Field label="Current position" wide>
            <input className="input" value={position} onChange={(event) => setPosition(event.target.value)} required maxLength={255} placeholder="Where the truck is now" />
          </Field>
          <fieldset className="field wide">
            <legend>Preparing for</legend>
            <div className="segmented">
              {Object.entries(PREP_TYPES).map(([value, label]) => (
                <label key={value}>
                  <input type="radio" name="prep_type" checked={prepType === value} onChange={() => setPrepType(value)} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      ) : (
        <p className="muted small">Nothing else to enter for this status.</p>
      )}
      <div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Sending…' : 'Send status'}
        </button>
      </div>
    </form>
  );
}

function OperatingStatus({ truck, onChanged }) {
  const [tab, setTab] = useState('send');
  const history = useFetch(tab === 'history' ? '/driver/status/history' : null);

  return (
    <>
      <h2>Operating Status Information</h2>
      <Tabs tabs={SEND_TABS} value={tab} onChange={setTab} />
      {tab === 'send' ? (
        <>
          <section className="card stack">
            <div className="row between">
              <h3>
                Truck {truck.plate_number} {truck.model && <span className="muted small">{truck.model}</span>}
              </h3>
              <Status value={truck.status} />
            </div>
            <dl className="facts">
              <div>
                <dt>Capacity</dt>
                <dd>{formatNumber(truck.capacity_tons, 2)} tons</dd>
              </div>
              <div>
                <dt>Current position</dt>
                <dd>{truck.current_position || '-'}</dd>
              </div>
              {truck.status === 'preparing' && (
                <div>
                  <dt>Preparing for</dt>
                  <dd>{PREP_TYPES[truck.prep_type] ?? '-'}</dd>
                </div>
              )}
              <div>
                <dt>Last sent</dt>
                <dd>{formatDateTime(truck.status_at)}</dd>
              </div>
            </dl>
          </section>
          <StatusForm key={`${truck.status}-${truck.status_at}`} truck={truck} onSent={onChanged} />
        </>
      ) : (
        <Async state={history} empty="No status sent yet." emptyIcon="history">
          {(rows) => (
            <DataTable
              columns={[
                { key: 'created_at', label: 'Sent', render: (row) => formatDateTime(row.created_at) },
                { key: 'status', label: 'Status', render: (row) => <Status value={row.status} /> },
                { key: 'prep_type', label: 'Preparing for', render: (row) => PREP_TYPES[row.prep_type] ?? '-' },
                { key: 'position', label: 'Position', render: (row) => row.position || '-' },
              ]}
              rows={rows}
            />
          )}
        </Async>
      )}
    </>
  );
}

// ------------------------------------------------------ daily report

const REPORT_FIELDS = [
  { name: 'departure_position', label: 'Departure position information' },
  { name: 'arrival_position', label: 'Arrival position information' },
  { name: 'arrive_date', label: 'Arrival date', type: 'date' },
  { name: 'repeat_count', label: 'Repeat count (trips)', type: 'number', step: 1 },
  { name: 'go_amount', label: 'Go direction amount (tons)', type: 'number' },
  { name: 'come_amount', label: 'Come direction amount (tons)', type: 'number' },
  { name: 'current_position', label: 'Current position', wide: true },
];

function DailyReport({ truck, onChanged }) {
  const { busy, run } = useSubmit();
  const [tab, setTab] = useState('send');
  const history = useFetch(tab === 'history' ? '/driver/reports' : null);

  return (
    <>
      <h2>Operate Daily Report</h2>
      <Tabs tabs={SEND_TABS} value={tab} onChange={setTab} />
      {tab === 'send' ? (
        <div className="card">
          <AutoForm
            fields={REPORT_FIELDS}
            initial={{ arrive_date: inputDate(), repeat_count: 1, go_amount: 0, come_amount: 0, current_position: truck.current_position }}
            busy={busy}
            submitLabel="Send report"
            onSubmit={async (values) => {
              const ok = await run(() => post('/driver/reports', values), 'Daily report sent');
              if (ok) {
                onChanged();
                setTab('history');
              }
              return ok;
            }}
          />
        </div>
      ) : (
        <Async state={history} empty="No daily report sent yet." emptyIcon="history">
          {(rows) => (
            <DataTable
              columns={[
                { key: 'arrive_date', label: 'Arrival date', render: (row) => formatDate(row.arrive_date) },
                { key: 'departure_position', label: 'From' },
                { key: 'arrival_position', label: 'To' },
                { key: 'go_amount', label: 'Go (tons)', render: (row) => formatNumber(row.go_amount, 2) },
                { key: 'come_amount', label: 'Come (tons)', render: (row) => formatNumber(row.come_amount, 2) },
                { key: 'repeat_count', label: 'Trips' },
                { key: 'current_position', label: 'Position after' },
                { key: 'created_at', label: 'Sent', render: (row) => formatDateTime(row.created_at) },
              ]}
              rows={rows}
            />
          )}
        </Async>
      )}
    </>
  );
}

// ------------------------------------------------- transport commands

function Command({ command, onChanged }) {
  const { busy, run } = useSubmit();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const urban = command.type === 'urban';

  const respond = async (allow) => {
    const ok = await run(() => post(`/driver/commands/${command.id}/respond`, { allow, reason }), allow ? 'Command allowed' : 'Command not allowed');
    if (ok) onChanged();
  };
  const progress = async (action, at) => {
    const ok = await run(() => post(`/driver/commands/${command.id}/progress`, { action, at }), action === 'depart' ? 'Departure recorded' : 'Arrival recorded');
    if (ok) onChanged();
    return ok;
  };

  return (
    <article className="card stack">
      <div className="row between">
        <div className="row">
          <h3>Order #{command.order_id}</h3>
          <Badge tone="primary">{urban ? 'Urban' : 'Long distance'}</Badge>
          {Boolean(command.urgent) && <Badge tone="bad">Urgent</Badge>}
        </div>
        <Status value={command.status} />
      </div>
      {command.note && <Notice>From the manager: {command.note}</Notice>}
      <dl className="facts">
        <div>
          <dt>Pick up at</dt>
          <dd>
            {command.departure_address}
            {command.departure_features ? ` (${command.departure_features})` : ''}
          </dd>
        </div>
        <div>
          <dt>Be there at</dt>
          <dd>{formatDateTime(command.car_arrive_at)}</dd>
        </div>
        <div>
          <dt>Sender</dt>
          <dd>
            {command.sender_name}, <a className="link" href={`tel:${command.sender_phone}`}>{command.sender_phone}</a>
          </dd>
        </div>
        <div>
          <dt>Deliver to</dt>
          <dd>{command.destination_address}</dd>
        </div>
        <div>
          <dt>Receiver</dt>
          <dd>
            {command.receiver_name}, <a className="link" href={`tel:${command.receiver_phone}`}>{command.receiver_phone}</a>
          </dd>
        </div>
        <div>
          <dt>Order status</dt>
          <dd>
            <Status value={command.order_status} />
          </dd>
        </div>
      </dl>
      <ul className="small">
        {command.items.map((item, index) => (
          <li key={index}>
            {item.count} × {item.name}{' '}
            <span className="muted">
              ({formatNumber(item.height, 2)} × {formatNumber(item.width, 2)} cm, {formatNumber(item.weight, 2)} kg each)
            </span>
          </li>
        ))}
      </ul>
      {command.order_note && <p className="muted small pre-line">Note: {command.order_note}</p>}
      {command.status === 'declined' && command.decline_reason && <p className="muted small">Your reason: {command.decline_reason}</p>}

      {command.status === 'pending' &&
        (declining ? (
          <form
            className="row"
            style={{ alignItems: 'flex-end' }}
            onSubmit={(event) => {
              event.preventDefault();
              respond(false);
            }}
          >
            <div className="grow">
              <Field label="Reason (optional)">
                <input className="input" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={255} autoFocus />
              </Field>
            </div>
            <button type="submit" className="btn btn-danger" disabled={busy}>
              Do not allow
            </button>
            <button type="button" className="btn" onClick={() => setDeclining(false)}>
              Back
            </button>
          </form>
        ) : (
          <div className="row">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => respond(true)}>
              Allow
            </button>
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => setDeclining(true)}>
              Not allow
            </button>
          </div>
        ))}

      {command.status === 'allowed' && urban && command.order_status === 'accepted' && (
        <div className="row">
          <TimeAction label="Departed" busy={busy} onConfirm={(at) => progress('depart', at)} />
        </div>
      )}
      {command.status === 'allowed' && urban && command.order_status === 'departed' && (
        <div className="row">
          <TimeAction label="Arrived" busy={busy} onConfirm={(at) => progress('arrive', at)} />
        </div>
      )}
      {command.status === 'allowed' && !urban && <p className="muted small">The warehouses record the departure and the arrival of long distance freight.</p>}
    </article>
  );
}

const COMMAND_TABS = [
  { id: 'open', label: 'To do' },
  { id: 'history', label: 'History' },
];

function Commands({ onChanged }) {
  const [tab, setTab] = useState('open');
  const state = useFetch('/driver/commands');
  const changed = () => {
    state.reload();
    // Allowing a command sets the truck to "working".
    onChanged();
  };

  return (
    <>
      <h2>Transport Commands</h2>
      <Tabs tabs={COMMAND_TABS} value={tab} onChange={setTab} />
      <Async state={state} empty="The manager has not sent you a command yet." emptyIcon="box">
        {(commands) => {
          // "To do": waiting for an answer, or allowed and not yet delivered.
          const open = (command) => command.status === 'pending' || (command.status === 'allowed' && !['arrived', 'rejected', 'cancelled'].includes(command.order_status));
          const shown = commands.filter((command) => (tab === 'open' ? open(command) : !open(command)));
          if (shown.length === 0) return <Notice icon="box">{tab === 'open' ? 'No command is waiting for you.' : 'No finished command yet.'}</Notice>;
          return shown.map((command) => <Command key={command.id} command={command} onChanged={changed} />);
        }}
      </Async>
    </>
  );
}

// --------------------------------------------------------------- side

const TRUCK_FIELDS = [
  { name: 'plate_number', label: 'Truck plate number' },
  { name: 'model', label: 'Truck model', required: false },
  { name: 'capacity_tons', label: 'Capacity (tons)', type: 'number' },
];

function Pages() {
  const state = useFetch('/driver/truck');
  const { busy, run } = useSubmit();
  return (
    <Async state={state}>
      {({ truck }) =>
        truck ? (
          <Routes>
            <Route index element={<OperatingStatus truck={truck} onChanged={state.reload} />} />
            <Route path="report" element={<DailyReport truck={truck} onChanged={state.reload} />} />
            <Route path="commands" element={<Commands onChanged={state.reload} />} />
          </Routes>
        ) : (
          // A driver whose role was given directly by the admin has no truck yet and registers it here.
          <>
            <Notice>Register your truck to start.</Notice>
            <div className="card">
              <AutoForm
                fields={TRUCK_FIELDS}
                busy={busy}
                submitLabel="Save truck"
                onSubmit={async (values) => {
                  const ok = await run(() => put('/driver/truck', values), 'Truck saved');
                  if (ok) state.reload();
                  return ok;
                }}
              />
            </div>
          </>
        )
      }
    </Async>
  );
}

export default function DriverSide() {
  return (
    <Gate role="driver" subscription title="Truck Driver Side">
      <Shell title="Truck Driver Side" back="/" nav={NAV}>
        <Pages />
      </Shell>
    </Gate>
  );
}
