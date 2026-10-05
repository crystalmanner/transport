import { lazy, Suspense } from 'react';
import { useFetch } from '../../hooks/useFetch.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { MOBILE_QUERY } from '../../lib/breakpoints.js';

// The home page is the one page with two separate layouts. Each is its own chunk,
// so a phone never downloads the desktop version and vice versa.
const HomeDesktop = lazy(() => import('./HomeDesktop.jsx'));
const HomeMobile = lazy(() => import('./HomeMobile.jsx'));

const loading = <p className="page-status">Loading…</p>;

export default function Home() {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  // Fetched here, not in the layouts, so both show the same data and
  // rotating or resizing across the breakpoint doesn't refetch.
  const home = useFetch('/home');

  if (home.error) {
    return (
      <p className="page-status" role="alert">
        Could not load the page. {home.error.message}
        <button type="button" className="btn" onClick={home.reload}>
          Try again
        </button>
      </p>
    );
  }
  if (!home.data) return loading;

  const Layout = isMobile ? HomeMobile : HomeDesktop;

  return (
    <Suspense fallback={loading}>
      <Layout home={home.data} />
    </Suspense>
  );
}
