import { Route, Routes } from 'react-router-dom';
import Gate from '../../components/Gate.jsx';
import Shell from '../../components/Shell.jsx';
import { MasterData, NewsAdmin } from './Crud.jsx';
import Dashboard from './Dashboard.jsx';
import { Buses, Cars, FreightOrders, Histories, Payments, Settings } from './Operations.jsx';
import { Permissions, Users } from './Users.jsx';

const NAV = [
  { to: '/admin', label: 'Statistics', icon: 'chart', end: true },
  { to: '/admin/users', label: 'Users', icon: 'users' },
  { to: '/admin/permissions', label: 'Permissions', icon: 'lock' },
  { to: '/admin/news', label: 'News', icon: 'news' },
  { to: '/admin/buses', label: 'Buses', icon: 'bus' },
  { to: '/admin/cars', label: 'Cars', icon: 'truck' },
  { to: '/admin/freight', label: 'Freight Orders', icon: 'box' },
  { to: '/admin/payments', label: 'Payments', icon: 'card' },
  { to: '/admin/histories', label: 'Histories', icon: 'history' },
  { to: '/admin/master', label: 'Places and Routes', icon: 'pin' },
  { to: '/admin/settings', label: 'Settings', icon: 'settings' },
];

export default function AdminSide() {
  return (
    <Gate role="admin" title="Admin">
      <Shell title="Admin" back="/" nav={NAV}>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="permissions" element={<Permissions />} />
          <Route path="news" element={<NewsAdmin />} />
          <Route path="buses" element={<Buses />} />
          <Route path="cars" element={<Cars />} />
          <Route path="freight" element={<FreightOrders />} />
          <Route path="payments" element={<Payments />} />
          <Route path="histories" element={<Histories />} />
          <Route path="master" element={<MasterData />} />
          <Route path="settings" element={<Settings />} />
        </Routes>
      </Shell>
    </Gate>
  );
}
