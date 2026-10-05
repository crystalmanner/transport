import { Link } from 'react-router-dom';
import { formatDate } from '../lib/format.js';
import { Badge } from './ui.jsx';

// The manager's news: newest first, pinned items on top. Each item opens the full text.
export default function NewsList({ news }) {
  if (news.length === 0) return <p className="muted">No news yet.</p>;
  return (
    <ul className="stack-sm">
      {news.map((item) => (
        <li key={item.id}>
          <Link to={`/news/${item.id}`} className="news-item">
            <span className="row" style={{ gap: '0.5rem' }}>
              <time className="muted small" dateTime={item.created_at.slice(0, 10)}>
                {formatDate(item.created_at)}
              </time>
              {Boolean(item.pinned) && <Badge tone="primary">Pinned</Badge>}
            </span>
            <span className="strong">{item.title}</span>
            <span className="muted small news-excerpt">{item.body}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
