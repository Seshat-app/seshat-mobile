import { apiFetch } from './api';

export type CQuestion = {
  id: string; title: string; body: string; tag: string; lang: string; authorName: string; mine: boolean;
  votes: number; myVote: boolean; answers: number; accepted: boolean; status: string; createdAt: string;
};
export type CAnswer = {
  id: string; body: string; authorName: string; mine: boolean; votes: number; myVote: boolean; accepted: boolean; status: string; createdAt: string;
};

export const TAGS = ['budgeting', 'saving', 'gold', 'gam3ya', 'debts', 'zakat', 'investing', 'app', 'other'] as const;

const TAG_LABEL: Record<string, { en: string; ar: string }> = {
  budgeting: { en: 'Budgeting', ar: 'الميزانية' },
  saving: { en: 'Saving', ar: 'الادخار' },
  gold: { en: 'Gold', ar: 'الذهب' },
  gam3ya: { en: 'Gam3ya', ar: 'الجمعية' },
  debts: { en: 'Debts', ar: 'الديون' },
  zakat: { en: 'Zakat', ar: 'الزكاة' },
  investing: { en: 'Investing', ar: 'الاستثمار' },
  app: { en: 'Using Seshat', ar: 'استخدام سيشات' },
  other: { en: 'Other', ar: 'أخرى' },
};
export const tagLabel = (tag: string, ar: boolean) => (TAG_LABEL[tag] ?? TAG_LABEL.other)[ar ? 'ar' : 'en'];

/** "5 min ago", "3 days ago" (or the Arabic equivalent). */
export function timeAgo(iso: string, ar: boolean): string {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  const unit = (n: number, en: string, arOne: string, arMany: string) => ar ? `منذ ${n} ${n <= 10 ? arMany : arOne}` : `${n} ${en}${n === 1 ? '' : 's'} ago`;
  if (s < 60) return ar ? 'الآن' : 'just now';
  if (s < 3600) return unit(Math.round(s / 60), 'min', 'دقيقة', 'دقائق');
  if (s < 86400) return unit(Math.round(s / 3600), 'hour', 'ساعة', 'ساعات');
  if (s < 86400 * 30) return unit(Math.round(s / 86400), 'day', 'يوماً', 'أيام');
  return new Date(iso).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const communityState = () => apiFetch<{ data: { accepted: boolean; blocked: number } }>('/community/state').then((r) => r.data);
export const acceptGuidelines = () => apiFetch('/community/accept', { method: 'POST', body: '{}' });
export const reportPost = (type: 'question' | 'answer', id: string, reason: string) =>
  apiFetch('/community/report', { method: 'POST', body: JSON.stringify({ type, id, reason }) });
export const blockAuthorOf = (type: 'question' | 'answer', id: string) =>
  apiFetch('/community/block', { method: 'POST', body: JSON.stringify({ type, id }) });
