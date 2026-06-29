import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
import { hasToken } from '../api';

/**
 * Shared list-loading for screens: owns items + loading + refreshing, runs the
 * fetch, and DEFERS the initial load until after the screen-transition
 * animation finishes (keeps the slide buttery). Pass a fetcher that resolves to
 * the array (e.g. `() => apiFetch<{data:T[]}>('/x').then(r => r.data)` or a lib
 * fn like `listReminders`). The fetcher can be an inline closure — it's read
 * through a ref, so `load` stays stable.
 */
export function useFetchList<T>(fetcher: () => Promise<T[]>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!(await hasToken())) return;
    if (mode === 'initial') setLoading(true); else setRefreshing(true);
    try {
      setItems(await fetcherRef.current());
    } catch (err) {
      console.warn('[useFetchList] load failed', err);
    } finally {
      if (mode === 'initial') setLoading(false); else setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => { void load(); });
    return () => task.cancel();
  }, [load]);

  return { items, setItems, loading, refreshing, load };
}
