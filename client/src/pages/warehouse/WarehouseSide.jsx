import { useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import AutoForm from '../../components/AutoForm.jsx';
import { DecideAction, OrderCard, TimeAction } from '../../components/Freight.jsx';
import Gate from '../../components/Gate.jsx';
import Shell from '../../components/Shell.jsx';
import { Async, DataTable, Notice, Tabs } from '../../components/ui.jsx';
import { useAuth } from '../../context/Auth.jsx';
import { useSubmit } from '../../context/Toast.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { post } from '../../lib/api.js';
import { formatDate, formatDateTime, formatNumber, inputDate } from '../../lib/format.js';

const NAV = [
  { to: '/warehouse', label: 'Ordered Freight', icon: 'box', end: true },
  { to: '/warehouse/shipping', label: 'Sent and Arrived Status', icon: 'truck' },
  { to: '/warehouse/report', label: 'Daily Report', icon: 'list' },
];

// Runs one order action, then reloads the list it came from.
function useOrderAction(reload) {
  const { busy, run } = useSubmit();
  const act = async (path, body, message) => {
    const ok = await run(() => post(path, body), message);
    if (ok) reload();
    return ok;
  };
  return { busy, act };
}

function PaidCash({ order, busy, act }) {
  if (order.payment_status !== 'unpaid' || order.charge === null || !['accepted', 'departed', 'arrived'].includes(order.status)) return null;
  return (
    <button type="button" className="btn btn-sm" disabled={busy} onClick={() => window.confirm('Record that this order was paid in cash?') && act(`/warehouse/orders/${order.id}/paid-cash`, {}, 'Payment recorded')}>
      Paid in cash
    </button>
  );
}

function Refresh({ state }) {
  return (
    <div>
      <button type="button" className="btn btn-sm" onClick={state.reload} disabled={state.loading}>
        {state.loading ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  );
}

// ---------------------------------------------------- ordered freight

const ORDER_TABS = [
  { id: 'pending', label: 'Waiting for you' },
  { id: 'all', label: 'All orders' },
];

// Long-distance orders that start at this warehouse: the manager accepts or rejects them.
function OrderedFreight() {
  const [tab, setTab] = useState('pending');
  const state = useFetch('/warehouse/orders');
  const { busy, act } = useOrderAction(state.reload);

  return (
    <>
      <h2>Ordered Freight</h2>
      <Tabs tabs={ORDER_TABS} value={tab} onChange={setTab} />
      <Refresh state={state} />
      <Async state={state} empty="No freight has been ordered from this warehouse yet." emptyIcon="box">
        {(orders) => {
          const shown = tab === 'pending' ? orders.filter((order) => order.status === 'pending') : orders;
          if (shown.length === 0) return <Notice icon="check">No order is waiting for your decision.</Notice>;
          return shown.map((order) => (
            <OrderCard key={order.id} order={order}>
              {order.status === 'pending' && (
                <DecideAction busy={busy} onDecide={(body) => act(`/warehouse/orders/${order.id}/decide`, body, body.accept ? 'Order accepted' : 'Order rejected')} />
              )}
              <PaidCash order={order} busy={busy} act={act} />
            </OrderCard>
          ));
        }}
      </Async>
    </>
  );
}

// ------------------------------------------- sent and arrived status

const SHIPPING_TABS = [
  { id: 'outgoing', label: 'Leaving this warehouse' },
  { id: 'incoming', label: 'Coming to this warehouse' },
];

function Shipping() {
  const [tab, setTab] = useState('outgoing');
  const state = useFetch(`/warehouse/orders?scope=${tab}`);
  const { busy, act } = useOrderAction(state.reload);
  const outgoing = tab === 'outgoing';

  return (
    <>
      <h2>Sent and Arrived Status</h2>
      <p className="muted">Record the real departure time when freight leaves this warehouse, and the arrival when freight from another warehouse gets here.</p>
      <Tabs tabs={SHIPPING_TABS} value={tab} onChange={setTab} />
      <Refresh state={state} />
      <Async state={state} empty={outgoing ? 'No order leaves from this warehouse yet.' : 'No freight is on its way to this warehouse.'} emptyIcon="truck">
        {(orders) => {
          const shown = orders.filter((order) => ['accepted', 'departed', 'arrived'].includes(order.status));
          if (shown.length === 0) return <Notice icon="truck">Nothing to send or receive now.</Notice>;
          return shown.map((order) => (
            <OrderCard key={order.id} order={order}>
              {outgoing && order.status === 'accepted' && (
                <TimeAction label="Freight sent" busy={busy} onConfirm={(at) => act(`/warehouse/orders/${order.id}/sent`, { at }, 'Departure recorded')} />
              )}
              {!outgoing && order.status === 'departed' && (
                <TimeAction label="Freight arrived" busy={busy} onConfirm={(at) => act(`/warehouse/orders/${order.id}/arrived`, { at }, 'Arrival recorded')} />
              )}
              <PaidCash order={order} busy={busy} act={act} />
            </OrderCard>
          ));
        }}
      </Async>
    </>
  );
}

// ------------------------------------------------------- daily report

const REPORT_TABS = [
  { id: 'send', label: 'Send report' },
  { id: 'history', label: 'History' },
];

const REPORT_FIELDS = [
  { name: 'report_date', label: 'Date', type: 'date', wide: true },
  { name: 'in_count', label: 'Brought in: number of freights', type: 'number', step: 1 },
  { name: 'in_weight', label: 'Brought in: total weight (kg)', type: 'number' },
  { name: 'in_note', label: 'Brought in: what and from where', type: 'textarea', required: false },
  { name: 'out_count', label: 'Removed: number of freights', type: 'number', step: 1 },
  { name: 'out_weight', label: 'Removed: total weight (kg)', type: 'number' },
  { name: 'out_note', label: 'Removed: what and to where', type: 'textarea', required: false },
];

function DailyReport() {
  const { busy, run } = useSubmit();
  const [tab, setTab] = useState('send');
  const history = useFetch(tab === 'history' ? '/warehouse/reports' : null);

  return (
    <>
      <h2>Daily Report</h2>
      <p className="muted">Freight brought into the warehouse and freight removed from it today.</p>
      <Tabs tabs={REPORT_TABS} value={tab} onChange={setTab} />
      {tab === 'send' ? (
        <div className="card">
          <AutoForm
            fields={REPORT_FIELDS}
            initial={{ report_date: inputDate(), in_count: 0, in_weight: 0, out_count: 0, out_weight: 0 }}
            busy={busy}
            submitLabel="Send report"
            onSubmit={async (values) => {
              const ok = await run(() => post('/warehouse/reports', values), 'Daily report sent');
              if (ok) setTab('history');
              return ok;
            }}
          />
        </div>
      ) : (
        <Async state={history} empty="No daily report sent yet." emptyIcon="history">
          {(rows) => (
            <DataTable
              columns={[
                { key: 'report_date', label: 'Date', render: (row) => formatDate(row.report_date) },
                { key: 'in_count', label: 'Brought in' },
                { key: 'in_weight', label: 'In (kg)', render: (row) => formatNumber(row.in_weight, 2) },
                { key: 'in_note', label: 'In: details', render: (row) => row.in_note || '-' },
                { key: 'out_count', label: 'Removed' },
                { key: 'out_weight', label: 'Out (kg)', render: (row) => formatNumber(row.out_weight, 2) },
                { key: 'out_note', label: 'Out: details', render: (row) => row.out_note || '-' },
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

// --------------------------------------------------------------- side

function Pages() {
  const { user } = useAuth();
  const info = useFetch(user.warehouse_id ? '/warehouse/info' : null);

  if (!user.warehouse_id) {
    return <Notice tone="warn">No warehouse is assigned to your account yet. Please ask the admin to choose your warehouse.</Notice>;
  }
  return (
    <>
      {info.data && (
        <div className="card row">
          <span className="strong">{info.data.name}</span>
          <span className="muted small">
            {info.data.office}, {info.data.province}
          </span>
        </div>
      )}
      <Routes>
        <Route index element={<OrderedFreight />} />
        <Route path="shipping" element={<Shipping />} />
        <Route path="report" element={<DailyReport />} />
      </Routes>
    </>
  );
}

export default function WarehouseSide() {
  return (
    <Gate role="warehouse" title="Warehouse Manager Side">
      <Shell title="Warehouse Manager Side" back="/" nav={NAV}>
        <Pages />
      </Shell>
    </Gate>
  );
}
