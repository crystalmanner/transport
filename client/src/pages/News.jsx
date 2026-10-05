import { useParams } from 'react-router-dom';
import NewsList from '../components/NewsList.jsx';
import Shell from '../components/Shell.jsx';
import { Async, Badge } from '../components/ui.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { formatDateTime } from '../lib/format.js';

export function NewsIndex() {
  const state = useFetch('/news');
  return (
    <Shell title="Manager news" back="/">
      <Async state={state} empty="No news yet." emptyIcon="news">
        {(news) => <NewsList news={news} />}
      </Async>
    </Shell>
  );
}

export function NewsDetail() {
  const { id } = useParams();
  const state = useFetch(`/news/${id}`);
  return (
    <Shell title="Manager news" back="/news">
      <Async state={state}>
        {(item) => (
          <article className="card stack">
            <div className="stack-sm">
              <h2 style={{ fontSize: '1.3rem' }}>{item.title}</h2>
              <p className="row muted small">
                <time>{formatDateTime(item.created_at)}</time>
                {item.author && <span>by {item.author}</span>}
                {Boolean(item.pinned) && <Badge tone="primary">Pinned</Badge>}
              </p>
            </div>
            <p className="pre-line">{item.body}</p>
          </article>
        )}
      </Async>
    </Shell>
  );
}
