// Thin client for /api/v1/notifications/* plus a useNotifications() hook that
// backs both the header bell (unread badge) and the notifications screen.
//
// The server returns raw Notification docs (see seshat-api models/Notification),
// so the identifier is `_id` and `type` buckets the source. `meta` is an opaque
// deep-link payload the surface interprets on tap (meta.kind + meta.sessionId /
// meta.persona for chat replies, budget threshold routes to /budgets).
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { apiFetch } from './api';

export type NotificationType = 'ai' | 'bill' | 'budget' | 'system' | 'proactive';

export interface AppNotification {
  _id: string;
  type: NotificationType;
  title: string;
  body: string;
  icon?: string;
  read: boolean;
  meta?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

// ── Typed helpers over apiFetch ──────────────────────────────────────────────

export async function list(): Promise<AppNotification[]> {
  const r = await apiFetch<{ data: AppNotification[] }>('/notifications');
  return r.data ?? [];
}

export async function unreadCount(): Promise<number> {
  const r = await apiFetch<{ data: { count: number } }>('/notifications/unread-count');
  return r.data?.count ?? 0;
}

export async function markRead(id: string): Promise<void> {
  await apiFetch(`/notifications/${id}/read`, { method: 'POST' });
}

export async function markAllRead(): Promise<void> {
  await apiFetch('/notifications/read-all', { method: 'POST' });
}

export async function remove(id: string): Promise<void> {
  await apiFetch(`/notifications/${id}`, { method: 'DELETE' });
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface UseNotificationsReturn {
  items: AppNotification[];
  unreadCount: number;
  loading: boolean;
  /** Mark one notification read (optimistic; reverts on failure). */
  markRead: (id: string) => Promise<void>;
  /** Mark every unread notification read (optimistic; reverts on failure). */
  markAllRead: () => Promise<void>;
  /** Delete one notification (optimistic; reverts on failure). */
  remove: (id: string) => Promise<void>;
  /** Re-fetch the list from the server. */
  refresh: () => Promise<void>;
}

const POLL_MS = 45_000;

/**
 * Loads the current user's notifications (GET /notifications, newest first,
 * capped 100 by the API) and exposes the mutations the bell + screen need.
 * `unreadCount` is derived from the live list so a mark-read / delete updates
 * the badge without a round-trip. Every mutation is optimistic and rolls back
 * the local list if the request throws.
 *
 * Near-real-time after the initial load: polls every ~45s (skipped while the
 * app is backgrounded, via AppState), refetches when the app returns to the
 * foreground, and refetches whenever the hosting screen regains focus. None of
 * those toggle `loading`, so background updates never flash a skeleton.
 */
export function useNotifications(): UseNotificationsReturn {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  // Latest list without re-subscribing the optimistic mutators on every render.
  const itemsRef = useRef<AppNotification[]>([]);
  itemsRef.current = items;

  const refresh = useCallback(async () => {
    try {
      const data = await list();
      setItems(data);
    } catch {
      // Offline / unauthenticated — keep whatever we had, surface nothing.
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load (this one owns the `loading` skeleton).
  useEffect(() => {
    let alive = true;
    setLoading(true);
    list()
      .then((d) => { if (alive) setItems(d); })
      .catch(() => { /* offline / unauthenticated */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // Poll while active; refetch on return to the foreground.
  useEffect(() => {
    const interval = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      void refresh();
    }, POLL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [refresh]);

  // Refetch whenever the screen mounting this hook regains focus.
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const markReadFn = useCallback(async (id: string) => {
    const prev = itemsRef.current;
    const target = prev.find((n) => n._id === id);
    if (!target || target.read) return; // nothing to do
    setItems((cur) => cur.map((n) => (n._id === id ? { ...n, read: true } : n)));
    try {
      await markRead(id);
    } catch {
      setItems(prev); // revert
    }
  }, []);

  const markAllReadFn = useCallback(async () => {
    const prev = itemsRef.current;
    if (!prev.some((n) => !n.read)) return;
    setItems((cur) => cur.map((n) => (n.read ? n : { ...n, read: true })));
    try {
      await markAllRead();
    } catch {
      setItems(prev); // revert
    }
  }, []);

  const removeFn = useCallback(async (id: string) => {
    const prev = itemsRef.current;
    setItems((cur) => cur.filter((n) => n._id !== id));
    try {
      await remove(id);
    } catch {
      setItems(prev); // revert
    }
  }, []);

  const unread = items.reduce((n, item) => (item.read ? n : n + 1), 0);

  return {
    items,
    unreadCount: unread,
    loading,
    markRead: markReadFn,
    markAllRead: markAllReadFn,
    remove: removeFn,
    refresh,
  };
}
