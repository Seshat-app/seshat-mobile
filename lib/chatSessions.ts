import { apiFetch } from './api';
import type { Persona } from './persona';

/**
 * Chat session-list API helpers + grouping. Follows the per-domain lib/*.ts
 * pattern (reminders.ts, reports.ts) so api.ts stays lean.
 *
 * The backend returns sessions pinned-first then most-recent; we keep that
 * order and only bucket them for display. See groupSessions below.
 */

export type SessionSummary = {
  id: string;
  title: string;
  lastMessageAt: string;
  createdAt: string;
  messageCount: number;
  unreadCount: number;
  pinned?: boolean;
};

/** GET /chat/sessions?persona=&q= — server-side filters + orders. */
export async function listSessions(persona: Persona, q?: string): Promise<SessionSummary[]> {
  const params = new URLSearchParams({ persona });
  const query = q?.trim();
  if (query) params.set('q', query);
  const r = await apiFetch<{ data: SessionSummary[] }>(`/chat/sessions?${params.toString()}`);
  return r.data ?? [];
}

/** PATCH /chat/sessions/:id { title } — rename a thread. */
export async function renameSession(id: string, title: string): Promise<void> {
  await apiFetch(`/chat/sessions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
}

/** PATCH /chat/sessions/:id { pinned } — pin/unpin a thread. */
export async function setSessionPinned(id: string, pinned: boolean): Promise<void> {
  await apiFetch(`/chat/sessions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ pinned }),
  });
}

/** DELETE /chat/sessions/:id — remove a thread. */
export async function deleteSession(id: string): Promise<void> {
  await apiFetch(`/chat/sessions/${id}`, { method: 'DELETE' });
}

// Group the (already pinned-first, recency-sorted) rows into a "Pinned"
// bucket plus Today / Previous 7 days / Older time buckets, computed from
// lastMessageAt (falling back to createdAt). Empty buckets are dropped.
export type SessionGroupKey = 'pinned' | 'today' | 'week' | 'older';

export function groupSessions(list: SessionSummary[]): { key: SessionGroupKey; items: SessionSummary[] }[] {
  const buckets: Record<SessionGroupKey, SessionSummary[]> = { pinned: [], today: [], week: [], older: [] };
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const weekAgoMs = Date.now() - 7 * 86_400_000;
  for (const s of list) {
    if (s.pinned) {
      buckets.pinned.push(s);
      continue;
    }
    const ts = new Date(s.lastMessageAt ?? s.createdAt ?? 0).getTime();
    if (ts >= todayMs) buckets.today.push(s);
    else if (ts >= weekAgoMs) buckets.week.push(s);
    else buckets.older.push(s);
  }
  return (['pinned', 'today', 'week', 'older'] as SessionGroupKey[])
    .map((key) => ({ key, items: buckets[key] }))
    .filter((g) => g.items.length > 0);
}
