import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/Auth.jsx';
import { formatMoney } from '../lib/format.js';
import { ROLE_NAMES } from '../lib/nav.js';
import Shell from './Shell.jsx';
import { Notice } from './ui.jsx';

function SubscriptionText() {
  const { settings } = useAuth();
  return (
    <>
      The subscription costs {formatMoney(settings.subscription_price, settings.currency)} per month. Pay at the office; the admin then
      activates your account.
    </>
  );
}

/*
 * Wraps a page that needs a login, optionally a role and a paid subscription.
 * The server checks the same rules again; this only decides what the screen shows.
 */
export default function Gate({ role, subscription = false, title, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="page-status">Loading…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (role && user.role !== role) {
    return (
      <Shell title={title} back="/">
        <Notice tone="warn" icon="lock">
          <p className="strong">This area is only for the {ROLE_NAMES[role]}.</p>
          {user.role === 'user' && role !== 'admin' && (
            <p>
              You can apply for this role on your{' '}
              <Link className="link" to="/account">
                account page
              </Link>
              . The admin approves applications.
            </p>
          )}
        </Notice>
      </Shell>
    );
  }

  if (subscription && !user.subscribed) {
    return (
      <Shell title={title} back="/">
        <Notice tone="warn" icon="card">
          <p className="strong">Your monthly subscription is not active.</p>
          <p>
            <SubscriptionText />
          </p>
        </Notice>
      </Shell>
    );
  }

  return children;
}

// Hides one User Side function when the admin's permission table does not allow it for this account.
export function FeatureGate({ feature, children }) {
  const { features } = useAuth();
  if (features[feature] !== false) return children;
  return (
    <Notice tone="warn" icon="lock">
      <p className="strong">This function is for Special Users.</p>
      <p>
        <SubscriptionText />
      </p>
    </Notice>
  );
}
