// Thin client for /api/v1/me/habits/*. The server scopes results to the
// active ledger via X-Ledger-Id (set by apiFetch).
import { apiFetch } from './api';

export type Habit = {
  id: string;
  categoryId: string;
  categoryNameEn?: string;
  categoryNameAr?: string;
  emoji?: string;
  hour: number;
  occurrences: number;
  lastSeenAt: string;
  mutedUntil?: string;
};

export async function listHabits(): Promise<Habit[]> {
  const r = await apiFetch<{ data: Habit[] }>('/me/habits');
  return r.data ?? [];
}

/** Mute for `days` days. Pass 0 to mute "forever" (until 2099). */
export async function muteHabit(id: string, days = 7): Promise<void> {
  await apiFetch(`/me/habits/${id}/mute`, {
    method: 'POST',
    body: JSON.stringify({ days }),
  });
}

export async function unmuteHabit(id: string): Promise<void> {
  await apiFetch(`/me/habits/${id}/unmute`, { method: 'POST' });
}
