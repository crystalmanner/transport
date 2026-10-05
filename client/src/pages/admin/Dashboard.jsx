import { useEffect } from 'react';
import { BarList, ColumnChart, LineChart, StatTiles, TableView } from '../../components/charts.jsx';
import { Async } from '../../components/ui.jsx';
import { useAuth } from '../../context/Auth.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { formatDay, formatMoney, formatMonth, formatNumber, humanize } from '../../lib/format.js';
import { ROLE_NAMES } from '../../lib/nav.js';

const FREIGHT_ORDER = ['pending', 'accepted', 'departed', 'arrived', 'rejected', 'cancelled'];
const BUS_STATUS = { idle: 'Not running', preparing: 'Preparing', departed: 'Departed', arrived: 'Arrived' };
const TRUCK_STATUS = { preparing: 'Preparing', working: 'Working', repairing: 'Repairing', downtime: 'Downtime' };

function ChartCard({ title, note, children }) {
  return (
    <section className="card">
      <div style={{ marginBottom: '0.75rem' }}>
        <h3>{title}</h3>
        {note && <p className="muted small">{note}</p>}
      </div>
      {children}
    </section>
  );
}

// Rows for a bar list from the server's [{ label, value }], in a fixed order with readable names.
const bars = (rows, names) =>
  Object.entries(names).map(([key, label]) => ({ label, value: Number(rows.find((row) => row.label === key)?.value ?? 0) }));

export default function Dashboard() {
  const { settings } = useAuth();
  const state = useFetch('/admin/stats');

  // "Using the system now" should stay current without the admin pressing anything.
  const reload = state.reload;
  useEffect(() => {
    const timer = setInterval(reload, 30000);
    return () => clearInterval(timer);
  }, [reload]);

  return (
    <>
      <h2>Statistics</h2>
      <Async state={state}>
        {(stats) => {
          const days = stats.daily.days.map(formatDay);
          const months = stats.revenue.months.map(formatMonth);
          const orders = [
            { name: 'Bus seats', values: stats.daily.seats },
            { name: 'Urban freight', values: stats.daily.urban },
            { name: 'Long distance freight', values: stats.daily.long },
          ];
          const roles = bars(stats.roles, ROLE_NAMES);
          const freight = bars(stats.freight, Object.fromEntries(FREIGHT_ORDER.map((status) => [status, humanize(status)])));

          return (
            <>
              <StatTiles
                tiles={[
                  { label: 'Total users', value: formatNumber(stats.users.total), hero: true },
                  { label: 'Using the system now', value: formatNumber(stats.users.online) },
                  { label: 'New users today', value: formatNumber(stats.users.new_today) },
                  { label: 'Subscribed users', value: formatNumber(stats.users.subscribed) },
                  { label: 'Buses', value: formatNumber(stats.counts.buses) },
                  { label: 'Cars', value: formatNumber(stats.counts.trucks) },
                  { label: 'Open bus trips', value: formatNumber(stats.counts.open_trips) },
                  { label: 'Seats ordered today', value: formatNumber(stats.counts.seats_today) },
                  { label: 'Freight orders pending', value: formatNumber(stats.counts.freight_pending) },
                  { label: 'Role applications pending', value: formatNumber(stats.counts.applications_pending) },
                  { label: 'Subscription income this month', value: formatMoney(stats.counts.revenue_month, settings.currency) },
                ]}
              />

              <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 24rem), 1fr))' }}>
                <ChartCard title="New users per day" note="Last 14 days">
                  <LineChart label="New users per day, last 14 days" labels={days} series={[{ name: 'New users', values: stats.daily.users }]} />
                  <TableView columns={['Day', 'New users']} rows={days.map((day, i) => [day, stats.daily.users[i]])} />
                </ChartCard>

                <ChartCard title="Orders per day" note="Last 14 days">
                  <LineChart label="Orders per day by kind, last 14 days" labels={days} series={orders} />
                  <TableView columns={['Day', ...orders.map((s) => s.name)]} rows={days.map((day, i) => [day, ...orders.map((s) => s.values[i])])} />
                </ChartCard>

                <ChartCard title="Subscription income per month" note={`Last 6 months${settings.currency ? `, in ${settings.currency}` : ''}`}>
                  <ColumnChart label="Subscription income per month, last 6 months" labels={months} values={stats.revenue.totals} name="Income" />
                  <TableView columns={['Month', 'Income']} rows={months.map((month, i) => [month, formatMoney(stats.revenue.totals[i], settings.currency)])} />
                </ChartCard>

                <ChartCard title="Users by role">
                  <BarList rows={roles} />
                </ChartCard>

                <ChartCard title="Freight orders by status">
                  <BarList rows={freight} />
                </ChartCard>

                <ChartCard title="Buses by status">
                  <BarList rows={bars(stats.buses, BUS_STATUS)} />
                </ChartCard>

                <ChartCard title="Cars by status">
                  <BarList rows={bars(stats.trucks, TRUCK_STATUS)} />
                </ChartCard>
              </div>
            </>
          );
        }}
      </Async>
    </>
  );
}
