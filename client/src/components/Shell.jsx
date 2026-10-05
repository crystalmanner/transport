import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/Auth.jsx';
import { APP_NAME, tabLinks, topLinks } from '../lib/nav.js';
import Icon from './Icon.jsx';
import styles from './Shell.module.css';

export function Brand() {
  return (
    <Link to="/" className={styles.brand}>
      <span className={styles.logo}>
        <Icon name="route" size={18} />
      </span>
      {APP_NAME}
    </Link>
  );
}

// Points and account button, or "Log in" for a visitor.
export function AccountChip() {
  const { user } = useAuth();
  if (!user) {
    return (
      <div className={styles.account}>
        <Link to="/login" className="btn btn-primary btn-sm">
          Log in
        </Link>
      </div>
    );
  }
  return (
    <div className={styles.account}>
      <Link to="/account" className={styles.points} aria-label={`${user.points} reward points`}>
        <Icon name="coin" size={18} />
        {user.points}
      </Link>
      <Link to="/account" className={styles.avatar} aria-label="Account">
        {user.name.slice(0, 1).toUpperCase()}
      </Link>
    </div>
  );
}

// The bottom bar on phones. The mobile home page uses it too.
export function TabBar() {
  const { user } = useAuth();
  return (
    <nav className={styles.tabBar} aria-label="Main">
      {tabLinks(user).map((link) => (
        <NavLink key={link.to} to={link.to} end={link.end}>
          <Icon name={link.icon} size={22} />
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}

// The links of the desktop top bar. The desktop home page uses it too.
export function TopNav({ className }) {
  const { user } = useAuth();
  return (
    <nav className={className} aria-label="Main">
      {topLinks(user).map((link) => (
        <NavLink key={link.to} to={link.to} end={link.end}>
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}

/*
 * Frame of every page except the first page: top bar, page title, optional
 * sub-navigation (`nav`: [{ to, label, icon, end }]) and the phone's bottom bar.
 */
export default function Shell({ title, back, nav, children }) {
  return (
    <div className={styles.shell}>
      <header className={styles.top}>
        <div className={`container ${styles.topInner}`}>
          <Brand />
          <TopNav className={styles.mainNav} />
          <AccountChip />
        </div>
      </header>

      <main className={`container ${styles.main}`}>
        {title && (
          <div className={styles.heading}>
            {back && (
              <Link to={back} className={styles.back} aria-label="Back">
                <Icon name="left" />
              </Link>
            )}
            <h1>{title}</h1>
          </div>
        )}
        {nav ? (
          <div className={styles.section}>
            <nav className={styles.sideNav} aria-label={title}>
              {nav.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.end}>
                  <Icon name={link.icon} size={18} />
                  {link.label}
                </NavLink>
              ))}
            </nav>
            <div className="stack">{children}</div>
          </div>
        ) : (
          children
        )}
      </main>

      <TabBar />
    </div>
  );
}
