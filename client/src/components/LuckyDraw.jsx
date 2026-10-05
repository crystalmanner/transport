import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/Auth.jsx';
import { useSubmit } from '../context/Toast.jsx';
import { post } from '../lib/api.js';
import { formatCountdown } from '../lib/format.js';
import Icon from './Icon.jsx';

// The hourly lucky draw: one press gives a random number of reward points.
export default function LuckyDraw() {
  const { user, settings, patchUser } = useAuth();
  const { busy, run } = useSubmit();
  const [won, setWon] = useState(null);
  const [now, setNow] = useState(Date.now());

  const waiting = (user?.draw_ready_at ?? 0) > now;
  useEffect(() => {
    if (!waiting) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [waiting]);

  if (!user) {
    return (
      <div className="stack-sm">
        <p className="muted">Log in to press the lucky draw once per hour and win reward points.</p>
        <Link to="/login" className="btn btn-primary">
          Log in
        </Link>
      </div>
    );
  }

  const draw = async () => {
    const result = await run(() => post('/points/draw'));
    if (!result) return;
    setWon(result.won);
    setNow(Date.now());
    patchUser({ points: result.points, draw_ready_at: Date.now() + result.wait_seconds * 1000 });
  };

  return (
    <div className="stack-sm">
      {won !== null && (
        <p className="strong" style={{ color: 'var(--good)' }} role="status">
          You won {won} point{won === 1 ? '' : 's'}!
        </p>
      )}
      <button type="button" className="btn btn-primary btn-block" onClick={draw} disabled={busy || waiting}>
        <Icon name="gift" />
        {waiting ? `Next draw in ${formatCountdown((user.draw_ready_at - now) / 1000)}` : 'Press the lucky draw'}
      </button>
      <p className="muted small">
        Once every {settings.draw_interval_minutes} minutes, {settings.draw_min} to {settings.draw_max} points.
      </p>
    </div>
  );
}
