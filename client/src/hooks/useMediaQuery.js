import { useCallback, useSyncExternalStore } from 'react';

// Re-renders when the query starts or stops matching (resize, rotation, zoom).
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query]
  );

  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}
