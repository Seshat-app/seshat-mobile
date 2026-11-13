import * as FileSystem from 'expo-file-system/legacy';
import { AppState } from 'react-native';
import { useEffect } from 'react';
import { apiFetch, getActiveLedger } from './api';
import { trackEvent } from './track';

/**
 * Entries typed while the phone has no connection are kept on the phone and sent when it is back. Each one carries its
 * own idempotency key, so an entry that did reach the server is never added twice if the send is repeated.
 */
type Item = { key: string; body: unknown; ledgerId: string | null; at: number };
const FILE = `${FileSystem.documentDirectory ?? ''}offline-queue.json`;

async function read(): Promise<Item[]> {
  try { const info = await FileSystem.getInfoAsync(FILE); if (!info.exists) return []; return JSON.parse(await FileSystem.readAsStringAsync(FILE)) as Item[]; } catch { return []; }
}
async function write(items: Item[]): Promise<void> {
  try { await FileSystem.writeAsStringAsync(FILE, JSON.stringify(items)); } catch { /* storage full: nothing more to do */ }
}

/** A failure to reach the server at all (no signal), as opposed to the server saying no. */
export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError || (err instanceof Error && /network request failed|network error|failed to fetch|timed out/i.test(err.message));
}

export async function enqueue(key: string, body: unknown): Promise<number> {
  const items = await read();
  items.push({ key, body, ledgerId: getActiveLedger(), at: Date.now() });
  await write(items);
  trackEvent('offline_saved');
  return items.length;
}

export async function pendingCount(): Promise<number> { return (await read()).length; }

let flushing = false;
/** Send what is waiting. Stops at the first connection failure; drops an entry the server refuses so it cannot block the rest. */
export async function flushQueue(): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let sent = 0;
  try {
    const items = await read();
    const left: Item[] = [];
    for (let i = 0; i < items.length; i++) {
      try {
        await apiFetch('/transactions', { method: 'POST', body: JSON.stringify(items[i].body), idempotencyKey: items[i].key, ledgerId: items[i].ledgerId ?? undefined });
        sent += 1;
      } catch (err) {
        if (isNetworkError(err)) { left.push(...items.slice(i)); break; }
        console.warn('[offline] the server refused a saved entry, dropping it:', err instanceof Error ? err.message : err);
      }
    }
    await write(left);
    if (sent > 0) trackEvent('offline_synced');
  } finally { flushing = false; }
  return sent;
}

/** Tries to send waiting entries when the app opens, comes back to the foreground, and every minute while some are waiting. */
export function useOfflineSync(onSynced: () => void): void {
  useEffect(() => {
    let alive = true;
    const run = async () => { if (!alive) return; if ((await pendingCount()) === 0) return; if ((await flushQueue()) > 0) onSynced(); };
    void run();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void run(); });
    const timer = setInterval(() => { void run(); }, 60_000);
    return () => { alive = false; sub.remove(); clearInterval(timer); };
  }, [onSynced]);
}
