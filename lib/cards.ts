export type Totals = { income: number; expense: number; net: number; count: number };

export type CardSummary = {
  id: string;
  bank: string | null;
  last4: string;
  label: string | null;
  kind: 'card' | 'account' | 'wallet' | 'cash';
  /** Display name: the user's label, else "CIB ••4821". */
  name: string;
  total: Totals;
  month: Totals;
  lastUsedAt: string | null;
  /** What the source holds now: opening balance + income - expense + transfers in - transfers out. */
  balance: number;
  openingBalance: number;
  /** The balance the bank's last message printed (and when), offered to the user: never applied by itself. */
  reportedBalance?: number | null;
  reportedAt?: string | null;
  /** 'private': only its owner sees it (shared workspaces). */
  visibility?: 'shared' | 'private';
  /** True when the signed-in person owns it. */
  mine?: boolean;
};

export type CardDetail = Omit<CardSummary, 'lastUsedAt'> & {
  topCategories: Array<{ categoryId: string; nameEn: string; nameAr?: string; icon?: string; total: number; count: number }>;
};

/** Short name for a populated card reference on a transaction row. */
export function cardChipName(c?: { bank?: string | null; last4?: string; label?: string | null; kind?: string } | null): string | null {
  if (!c || !c.last4) return null;
  return c.label || `${c.bank ?? ''} ••${c.last4}`.trim();
}
