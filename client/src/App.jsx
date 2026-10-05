import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Account from './pages/Account.jsx';
import Home from './pages/home/Home.jsx';
import { Offices, Parks, ParkSide } from './pages/Info.jsx';
import Login from './pages/Login.jsx';
import { NewsDetail, NewsIndex } from './pages/News.jsx';
import NotFound from './pages/NotFound.jsx';

// Each side is its own chunk: a passenger's phone never downloads the admin or guard screens.
const UserSide = lazy(() => import('./pages/user/UserSide.jsx'));
const GuardSide = lazy(() => import('./pages/guard/GuardSide.jsx'));
const DriverSide = lazy(() => import('./pages/driver/DriverSide.jsx'));
const WarehouseSide = lazy(() => import('./pages/warehouse/WarehouseSide.jsx'));
const AdminSide = lazy(() => import('./pages/admin/AdminSide.jsx'));

export default function App() {
  return (
    <Suspense fallback={<p className="page-status">Loading…</p>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Login register />} />
        <Route path="/account" element={<Account />} />
        <Route path="/news" element={<NewsIndex />} />
        <Route path="/news/:id" element={<NewsDetail />} />
        <Route path="/offices" element={<Offices />} />
        <Route path="/parks" element={<Parks />} />
        <Route path="/park" element={<ParkSide />} />
        <Route path="/user/*" element={<UserSide />} />
        <Route path="/guard/*" element={<GuardSide />} />
        <Route path="/driver/*" element={<DriverSide />} />
        <Route path="/warehouse/*" element={<WarehouseSide />} />
        <Route path="/admin/*" element={<AdminSide />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
