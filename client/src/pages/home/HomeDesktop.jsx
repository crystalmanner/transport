import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import LuckyDraw from '../../components/LuckyDraw.jsx';
import NewsList from '../../components/NewsList.jsx';
import { AccountChip, Brand, TopNav } from '../../components/Shell.jsx';
import { useAuth } from '../../context/Auth.jsx';
import { formatNumber } from '../../lib/format.js';
import { ADMIN, APP_NAME, INFO, SIDES } from '../../lib/nav.js';
import styles from './HomeDesktop.module.css';

const COUNTS = [
  ['open_trips', 'Buses taking reservations'],
  ['buses', 'Buses'],
  ['parks', 'Parks'],
  ['offices', 'Transport offices'],
];

function Tile({ item }) {
  return (
    <li>
      <Link to={item.to} className={styles.tile}>
        <span className={styles.tileIcon}>
          <Icon name={item.icon} size={24} />
        </span>
        <span className={styles.tileText}>
          <span className="strong">{item.label}</span>
          <span className="muted small">{item.text}</span>
        </span>
        <Icon name="right" size={18} className={styles.tileArrow} />
      </Link>
    </li>
  );
}

export default function HomeDesktop({ home }) {
  const { user } = useAuth();
  const info = user?.role === 'admin' ? [...INFO, ADMIN] : INFO;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={`container ${styles.headerInner}`}>
          <Brand />
          <TopNav className={styles.nav} />
          <AccountChip />
        </div>
      </header>

      <main className={`container ${styles.main}`}>
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>Passenger buses and freight transport</p>
            <h1>{user ? `Welcome back, ${user.name}` : 'Reserve a seat. Send freight. Follow every order.'}</h1>
            <p className="muted">
              Choose a side below to start. Every order earns reward points, and the lucky draw gives more every hour.
            </p>
            {!user && (
              <div className="row">
                <Link to="/register" className="btn btn-primary">
                  Create an account
                </Link>
                <Link to="/login" className="btn">
                  Log in
                </Link>
              </div>
            )}
          </div>
          <dl className={styles.counts}>
            {COUNTS.map(([key, label]) => (
              <div key={key}>
                <dd className="num">{formatNumber(home.counts[key])}</dd>
                <dt>{label}</dt>
              </div>
            ))}
          </dl>
        </section>

        <div className={styles.columns}>
          <div className="stack">
            <section className="stack-sm">
              <h2>Choose your side</h2>
              <ul className={styles.tiles}>
                {SIDES.map((item) => (
                  <Tile key={item.to} item={item} />
                ))}
              </ul>
            </section>
            <section className="stack-sm">
              <h2>Information</h2>
              <ul className={styles.tiles}>
                {info.map((item) => (
                  <Tile key={item.to} item={item} />
                ))}
              </ul>
            </section>
          </div>

          <aside className="stack">
            <section className="card">
              <div className="card-title">
                <h2>Lucky draw</h2>
                <Icon name="gift" style={{ color: 'var(--warn)' }} />
              </div>
              <LuckyDraw />
            </section>
            <section className="card">
              <div className="card-title">
                <h2>Manager news</h2>
                <Link to="/news" className="link small">
                  All news
                </Link>
              </div>
              <NewsList news={home.news} />
            </section>
          </aside>
        </div>
      </main>

      <footer className={styles.footer}>
        <div className="container">{APP_NAME}</div>
      </footer>
    </div>
  );
}
