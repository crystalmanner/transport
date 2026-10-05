import { useState } from 'react';
import { FreightForm, OrderCard } from '../../components/Freight.jsx';
import { FeatureGate } from '../../components/Gate.jsx';
import { Async, Notice, Tabs } from '../../components/ui.jsx';
import { useAuth } from '../../context/Auth.jsx';
import { useSubmit } from '../../context/Toast.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { post, query } from '../../lib/api.js';

// The user's freight orders as cards, with the two things a user can do: cancel and pay with points.
function Orders({ type, party, empty }) {
  const { features, refresh } = useAuth();
  const { busy, run } = useSubmit();
  const state = useFetch(`/user/freight${query({ type })}`);

  const act = async (path, message) => {
    if (await run(() => post(path), message)) {
      state.reload();
      refresh();
    }
  };

  return (
    <div className="stack">
      <div>
        <button type="button" className="btn btn-sm" onClick={state.reload} disabled={state.loading}>
          {state.loading ? 'Refreshing…' : 'Refresh status'}
        </button>
      </div>
      <Async state={state}>
        {(all) => {
          const orders = party ? all.filter((order) => order.party === party) : all;
          if (orders.length === 0) return <Notice icon="box">{empty}</Notice>;
          return orders.map((order) => {
            const payable = order.payment_status === 'unpaid' && order.charge !== null && ['accepted', 'departed', 'arrived'].includes(order.status);
            return (
              <OrderCard key={order.id} order={order}>
                {order.party === 'sender' && order.status === 'pending' && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={busy}
                    onClick={() => window.confirm('Cancel this order?') && act(`/user/freight/${order.id}/cancel`, 'Order cancelled')}
                  >
                    Cancel order
                  </button>
                )}
                {payable && features.pay_with_points !== false && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy}
                    onClick={() => window.confirm(`Pay this order with ${order.point_cost} reward points?`) && act(`/user/freight/${order.id}/pay-points`, 'Paid with reward points')}
                  >
                    Pay with {order.point_cost} points
                  </button>
                )}
              </OrderCard>
            );
          });
        }}
      </Async>
    </div>
  );
}

const FORM_TABS = [
  { id: 'new', label: 'New order' },
  { id: 'history', label: 'History' },
];

// Order Urban Freight Transport and Long Distance Freight Transport share this page.
export function FreightOrder({ type }) {
  const { settings } = useAuth();
  const { busy, run } = useSubmit();
  const [tab, setTab] = useState('new');
  const long = type === 'long';

  const submit = async (values) => {
    const ok = await run(() => post('/user/freight', values), 'Order sent. You can follow it under History.');
    if (ok) setTab('history');
    return ok;
  };

  return (
    <>
      <h2>{long ? 'Long Distance Freight Transport' : 'Order Urban Freight Transport'}</h2>
      <Tabs tabs={FORM_TABS} value={tab} onChange={setTab} />
      {tab === 'new' ? (
        <FeatureGate feature={long ? 'long_freight' : 'urban_freight'}>
          <Notice>
            {long
              ? 'The manager of the departure warehouse accepts the order and sets the charge.'
              : 'The manager accepts the order, sets the charge and sends a truck to the departure position.'}{' '}
            You get {settings.points_per_freight_order} reward points when the order is accepted.
          </Notice>
          <FreightForm key={type} type={type} busy={busy} onSubmit={submit} />
        </FeatureGate>
      ) : (
        <Orders type={type} party="sender" empty="You have not sent an order of this kind yet." />
      )}
    </>
  );
}

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'sender', label: 'I send' },
  { id: 'receiver', label: 'I receive' },
];

// Status of Order: everything this account sends or receives.
export function OrderStatus() {
  const [tab, setTab] = useState('all');
  return (
    <>
      <h2>Status of Order</h2>
      <p className="muted">Accepted, rejected or still pending, the real departure time, and whether the freight has arrived. The receiver sees the same status.</p>
      <Tabs tabs={STATUS_TABS} value={tab} onChange={setTab} />
      <Orders key={tab} party={tab === 'all' ? null : tab} empty="No freight order here yet." />
    </>
  );
}
