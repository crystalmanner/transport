import { Link, Route, Routes } from 'react-router-dom';
import Gate from '../../components/Gate.jsx';
import Icon from '../../components/Icon.jsx';
import Shell from '../../components/Shell.jsx';
import { useAuth } from '../../context/Auth.jsx';
import BusSeat from './BusSeat.jsx';
import Feedback from './Feedback.jsx';
import { BusSearch, RouteSearch } from './Searches.jsx';
import { FreightOrder, OrderStatus } from './UserFreight.jsx';

// `feature` is the row of the admin's permission table that can lock the function.
const PAGES = [
  { to: '/user/bus-seat', label: 'Order Bus Seat', icon: 'bus', feature: 'bus_seat_order', text: 'Find a bus by route and reserve a seat on its seat map' },
  { to: '/user/urban', label: 'Urban Freight Transport', icon: 'box', feature: 'urban_freight', text: 'Order a truck for freight inside the city' },
  { to: '/user/long', label: 'Long Distance Freight', icon: 'truck', feature: 'long_freight', text: 'Send freight between provinces through the warehouses' },
  { to: '/user/orders', label: 'Status of Order', icon: 'list', text: 'Follow the freight you send and the freight coming to you' },
  { to: '/user/route-search', label: 'Route Search', icon: 'route', feature: 'route_search', text: 'Buses of a route, best-rated guard first' },
  { to: '/user/bus-search', label: 'Bus Search', icon: 'search', feature: 'bus_search', text: 'Where a bus is now and when it arrives' },
  { to: '/user/feedback', label: 'Guard Feedback', icon: 'star', feature: 'guard_feedback', text: 'Rate the guard of a bus you rode' },
];

const NAV = [{ to: '/user', label: 'Overview', icon: 'home', end: true }, ...PAGES];

function Overview() {
  const { user, features, settings } = useAuth();
  return (
    <>
      <div className="card row between">
        <div>
          <p className="muted small">Your reward points</p>
          <p className="num" style={{ fontSize: '1.8rem', fontWeight: 750, color: 'var(--warn)', lineHeight: 1.1 }}>
            {user.points}
          </p>
        </div>
        <p className="muted small grow">
          A bus seat order gives {settings.points_per_seat_order} points and a freight order {settings.points_per_freight_order}. Points can pay for seats and
          freight.
        </p>
        <Link to="/account" className="btn btn-sm">
          <Icon name="gift" size={16} />
          Lucky draw
        </Link>
      </div>
      <ul className="cards">
        {PAGES.map((page) => {
          const locked = page.feature && features[page.feature] === false;
          return (
            <li key={page.to}>
              <Link to={page.to} className="card row" style={{ flexWrap: 'nowrap', height: '100%' }}>
                <span style={{ display: 'grid', placeItems: 'center', flex: 'none', width: '2.75rem', height: '2.75rem', borderRadius: 12, background: 'var(--primary-soft)', color: 'var(--primary-strong)' }}>
                  <Icon name={page.icon} size={22} />
                </span>
                <span className="stack-sm" style={{ gap: '0.1rem' }}>
                  <span className="strong row" style={{ gap: '0.4rem' }}>
                    {page.label}
                    {locked && <span className="badge warn">Special Users</span>}
                  </span>
                  <span className="muted small">{page.text}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default function UserSide() {
  return (
    <Gate title="User Side">
      <Shell title="User Side" back="/" nav={NAV}>
        <Routes>
          <Route index element={<Overview />} />
          <Route path="bus-seat" element={<BusSeat />} />
          <Route path="urban" element={<FreightOrder key="urban" type="urban" />} />
          <Route path="long" element={<FreightOrder key="long" type="long" />} />
          <Route path="orders" element={<OrderStatus />} />
          <Route path="route-search" element={<RouteSearch />} />
          <Route path="bus-search" element={<BusSearch />} />
          <Route path="feedback" element={<Feedback />} />
        </Routes>
      </Shell>
    </Gate>
  );
}
