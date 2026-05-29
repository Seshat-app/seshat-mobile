import { apiFetch } from './api';

export type MonthlyReport = {
  period: { year: number; month: number; label: string };
  ledgerId: string;
  currency: string;
  totals: {
    income: number;
    expense: number;
    net: number;
    savingsRate: number;
    transactionCount: number;
  };
  comparison: {
    incomeDelta: number;
    expenseDelta: number;
    incomeDeltaPercent: number;
    expenseDeltaPercent: number;
  };
  byCategory: {
    categoryId: string;
    nameEn: string;
    nameAr: string;
    emoji?: string;
    total: number;
    percentOfExpense: number;
    countTx: number;
    deltaVsPrev: number;
  }[];
  topVendors: { description: string; total: number; count: number }[];
  dailyTrend: { date: string; income: number; expense: number }[];
  budgetAdherence: {
    categoryId: string;
    nameEn: string;
    nameAr: string;
    cap: number;
    spent: number;
    percent: number;
    status: 'under' | 'near' | 'over';
  }[];
  goalsSnapshot: {
    goalId: string;
    name: string;
    target: number;
    saved: number;
    percent: number;
  }[];
  byProject: {
    projectId: string | null;
    name: string;
    color?: string;
    budget: number | null;
    income: number;
    expense: number;
    net: number;
    budgetPct: number | null;
    countTx: number;
  }[];
  narrative?: {
    en: ReportInsight;
    ar: ReportInsight;
  };
};

export type ReportInsight = {
  headline: string;
  whatChanged: string;
  hiddenPattern: string;
  doThis: string;
};

export type ReportAvailability =
  | { available: true }
  | {
      available: false;
      reason: 'too-new' | 'too-few-transactions';
      daysSinceJoined: number;
      transactionCount: number;
      daysUntilUnlock: number;
      transactionsUntilUnlock: number;
    };

export async function getReportAvailability(): Promise<ReportAvailability> {
  const r = await apiFetch<{ data: ReportAvailability }>('/reports/monthly/availability');
  return r.data;
}

export async function getMonthlyReport(year?: number, month?: number): Promise<MonthlyReport> {
  const qs = new URLSearchParams();
  if (year) qs.set('year', String(year));
  if (month) qs.set('month', String(month));
  const path = `/reports/monthly${qs.toString() ? `?${qs}` : ''}`;
  const r = await apiFetch<{ data: MonthlyReport }>(path);
  return r.data;
}

/** Returns the API URL for the printable HTML view (with auth carried via fetch).
 *  Pass print=true to get the light/cream variant that produces shareable PDFs. */
export function monthlyReportHtmlPath(
  year: number,
  month: number,
  lang: 'en' | 'ar',
  print = false,
): string {
  return `/reports/monthly/html?year=${year}&month=${month}&lang=${lang}${print ? '&print=true' : ''}`;
}
