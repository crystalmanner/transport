import { useCallback, useEffect, useState } from 'react';
import { get } from '../lib/api.js';

// Loads `path` from the API. Pass null to skip. reload() fetches again and keeps the
// old data on screen meanwhile, so lists do not flash empty after every action.
export function useFetch(path) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path), path });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) {
      setState({ data: null, error: null, loading: false, path });
      return undefined;
    }
    const controller = new AbortController();
    setState((prev) => ({ data: prev.path === path ? prev.data : null, error: null, loading: true, path }));

    get(path, controller.signal)
      .then((data) => setState({ data, error: null, loading: false, path }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ data: null, error, loading: false, path });
      });

    return () => controller.abort();
  }, [path, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data: state.data, error: state.error, loading: state.loading, reload };
}
