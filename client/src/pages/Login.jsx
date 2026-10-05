import { Link, Navigate, useLocation } from 'react-router-dom';
import AutoForm from '../components/AutoForm.jsx';
import Shell from '../components/Shell.jsx';
import { useAuth } from '../context/Auth.jsx';
import { useSubmit } from '../context/Toast.jsx';

const PHONE = { name: 'phone', label: 'Phone number', type: 'tel' };

// One page for both logging in and creating an account (register = true).
export default function Login({ register = false }) {
  const auth = useAuth();
  const location = useLocation();
  const { busy, run } = useSubmit();

  // After a successful login the user state changes and this sends them back to where they wanted to go.
  if (auth.user) return <Navigate to={location.state?.from ?? '/'} replace />;

  const fields = register
    ? [{ name: 'name', label: 'Your name' }, PHONE, { name: 'password', label: 'Password', type: 'password', hint: 'At least 6 characters' }]
    : [PHONE, { name: 'password', label: 'Password', type: 'password' }];

  return (
    <Shell>
      <div className="card stack narrow">
        <h1>{register ? 'Create an account' : 'Log in'}</h1>
        <AutoForm
          key={register ? 'register' : 'login'}
          single
          fields={fields}
          busy={busy}
          submitLabel={register ? 'Create account' : 'Log in'}
          onSubmit={(values) => run(() => (register ? auth.register(values) : auth.login(values)))}
        />
        <p className="muted small">
          {register ? 'Already have an account? ' : 'No account yet? '}
          <Link className="link" to={register ? '/login' : '/register'} state={location.state}>
            {register ? 'Log in' : 'Create one'}
          </Link>
        </p>
      </div>
    </Shell>
  );
}
