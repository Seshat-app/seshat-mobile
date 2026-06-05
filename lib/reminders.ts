// Thin client for /api/v1/me/reminders/*. The server scopes results to the
// active ledger via X-Ledger-Id (set by apiFetch).
import { apiFetch } from './api';

export type Reminder = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  dayOfMonth: number;
  leadDays: number;
  status: 'active' | 'suggested' | 'off' | 'dismissed';
};

export async function listReminders(): Promise<Reminder[]> {
  const r = await apiFetch<{ data: Reminder[] }>('/me/reminders');
  return r.data ?? [];
}

export async function updateReminder(
  id: string,
  body: { status?: string; leadDays?: number },
): Promise<void> {
  await apiFetch(`/me/reminders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
