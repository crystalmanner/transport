import { Route, Routes } from 'react-router-dom';
import Gate from '../../components/Gate.jsx';
import Shell from '../../components/Shell.jsx';
import { Async, Notice } from '../../components/ui.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import Operation from './Operation.jsx';
import Report from './Report.jsx';
import Seats, { BusInfoForm } from './Seats.jsx';

const NAV = [
  { to: '/guard', label: 'Route Operation Information', icon: 'route', end: true },
  { to: '/guard/report', label: 'Operate Daily Report', icon: 'list' },
  { to: '/guard/seats', label: 'Status of Order', icon: 'bus' },
];

function Pages() {
  const state = useFetch('/guard/bus');
  return (
    <Async state={state}>
      {({ bus }) =>
        bus ? (
          <Routes>
            <Route index element={<Operation />} />
            <Route path="report" element={<Report bus={bus} />} />
            <Route path="seats" element={<Seats bus={bus} onBusChanged={state.reload} />} />
          </Routes>
        ) : (
          // A guard whose role was given directly by the admin has no bus yet and registers it here.
          <>
            <Notice>Register your bus to start. You can draw its seats afterwards under Status of Order.</Notice>
            <div className="card">
              <BusInfoForm bus={null} onSaved={state.reload} />
            </div>
          </>
        )
      }
    </Async>
  );
}

export default function GuardSide() {
  return (
    <Gate role="guard" subscription title="Guard Side">
      <Shell title="Guard Side" back="/" nav={NAV}>
        <Pages />
      </Shell>
    </Gate>
  );
}
