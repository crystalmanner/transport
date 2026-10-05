import { useEffect, useState } from 'react';
import { useFetch } from './useFetch.js';

const EMPTY = { provinces: [], parks: [], routes: [], warehouses: [] };

// The master lists that fill dropdowns, already shaped as { value, label, group } options.
export function useLookups() {
  const { data } = useFetch('/lookups');
  const lists = data ?? EMPTY;
  return {
    ...lists,
    ready: Boolean(data),
    provinceOptions: lists.provinces.map((p) => ({ value: p.id, label: p.name })),
    parkOptions: lists.parks.map((p) => ({ value: p.id, label: p.name, group: p.province })),
    routeOptions: lists.routes.map((r) => ({ value: r.id, label: r.name })),
    warehouseOptions: lists.warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.office})`, group: w.province })),
  };
}

// Returns `value` after it has stopped changing for `delay` ms, so typing does not send a request per letter.
export function useDebounced(value, delay = 300) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}
