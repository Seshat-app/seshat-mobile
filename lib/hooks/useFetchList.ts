import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
import { hasToken } from '../api';
import { useAppData } from '../appData';

/**
 * Shared list-loading for screens: owns items + loading + refreshing, runs the
 * fetch, and DEFERS the initial load until after the screen-transition
 * animation finishes (keeps the slide buttery). Pass a fetcher that resolves to
 * the array (e.g. `() => apiFetch<{data:T[]}>('/x').then(r => r.data)` or a lib
 * fn like `listReminders`). The fetcher can be an inline closure — it's read
 * through a ref, so `load` stays stable.
 *
 * It also reloads quietly (no spinner) whenever the app signals that data changed
 * (`bumpVersion`), e.g. after the chat recorded something, so lists never go stale.
 */
export function useFetchList<T>(fetcher: () => Promise<T[]>) {
  const { dataVersion } = useAppData();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
    if (!(await hasToken())) return;
    if (mode === 'initial') setLoading(true); else if (mode === 'refresh') setRefreshing(true);
    try {
      setItems(await fetcherRef.current());
    } catch (err) {
      console.warn('[useFetchList] load failed', err);
    } finally {
      if (mode === 'initial') setLoading(false); else if (mode === 'refresh') setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => { void load(); });
    return () => task.cancel();
  }, [load]);

  // Data changed elsewhere (chat, capture, another screen): reload without a spinner.
  const seenVersion = useRef(dataVersion);
  useEffect(() => {
    if (seenVersion.current === dataVersion) return;
    seenVersion.current = dataVersion;
    void load('silent');
  }, [dataVersion, load]);

  return { items, setItems, loading, refreshing, load };
}
