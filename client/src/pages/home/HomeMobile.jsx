import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import LuckyDraw from '../../components/LuckyDraw.jsx';
import NewsList from '../../components/NewsList.jsx';
import { AccountChip, Brand, TabBar } from '../../components/Shell.jsx';
import { useAuth } from '../../context/Auth.jsx';
import { ADMIN, INFO, SIDES } from '../../lib/nav.js';
import styles from './HomeMobile.module.css';

export default function HomeMobile({ home }) {
  const { user } = useAuth();
  const tiles = [...SIDES, ...INFO, ...(user?.role === 'admin' ? [ADMIN] : [])];

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <div className={`container ${styles.topBarInner}`}>
          <Brand />
          <AccountChip />
        </div>
      </header>

      <main className={`container ${styles.main}`}>
        <section className={styles.welcome}>
          <div>
            <p className={styles.hello}>{user ? `Hello, ${user.name}` : 'Welcome'}</p>
            {user ? (
              <p className={styles.points}>
                <span className="num">{user.points}</span> reward points
              </p>
            ) : (
              <p className="muted small">Buses, freight and reward points in one place.</p>
            )}
          </div>
          <LuckyDraw />
          {!user && (
            <Link to="/register" className="btn btn-block">
              Create an account
            </Link>
          )}
        </section>

        <section className="stack-sm">
          <h2>Choose your side</h2>
          <ul className={styles.tiles}>
            {tiles.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className={styles.tile}>
                  <span className={styles.tileIcon}>
                    <Icon name={item.icon} size={24} />
                  </span>
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="stack-sm">
          <div className="row between">
            <h2>Manager news</h2>
            <Link to="/news" className="link small">
              All news
            </Link>
          </div>
          <NewsList news={home.news.slice(0, 5)} />
        </section>
      </main>

      <TabBar />
    </div>
  );
}
