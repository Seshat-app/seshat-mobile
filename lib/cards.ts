export type Totals = { income: number; expense: number; net: number; count: number };

export type CardSummary = {
  id: string;
  bank: string | null;
  last4: string;
  label: string | null;
  kind: 'card' | 'account' | 'wallet';
  /** Display name: the user's label, else "CIB ••4821". */
  name: string;
  total: Totals;
  month: Totals;
  lastUsedAt: string | null;
};

export type CardDetail = Omit<CardSummary, 'lastUsedAt'> & {
  topCategories: Array<{ categoryId: string; nameEn: string; nameAr?: string; icon?: string; total: number; count: number }>;
};

/** Short name for a populated card reference on a transaction row. */
export function cardChipName(c?: { bank?: string | null; last4?: string; label?: string | null; kind?: string } | null): string | null {
  if (!c || !c.last4) return null;
  return c.label || `${c.bank ?? ''} ••${c.last4}`.trim();
}
