// Maps backend Category nameEn → a stable design ID + icon key.
// The design uses 9 canonical category icons; backend seeds 11 categories.
// Unmapped categories fall back to 'other'.

export type CatId = 'food' | 'transport' | 'housing' | 'shopping' | 'health'
  | 'entertainment' | 'education' | 'savings' | 'debt' | 'income' | 'other';

const NAME_TO_ID: Record<string, CatId> = {
  'Food & Dining': 'food',
  'Transport': 'transport',
  'Housing & Rent': 'housing',
  'Shopping': 'shopping',
  'Health': 'health',
  'Entertainment': 'entertainment',
  'Education': 'education',
  'Savings': 'savings',
  'Debt & Loans': 'debt',
  'Income': 'income',
  'Other': 'other',
};

export function catIdFromName(nameEn: string | undefined | null): CatId {
  if (!nameEn) return 'other';
  return NAME_TO_ID[nameEn] ?? 'other';
}

// Resolve the icon key for a category record. New `icon` field wins (custom
// categories), then fall back to the legacy name-based mapping for any
// pre-existing records that don't have one stored.
export function iconKeyForCategory(
  cat: { icon?: string; nameEn?: string } | undefined | null,
): string {
  if (!cat) return 'other';
  if (cat.icon && cat.icon.trim()) return cat.icon.trim();
  return catIdFromName(cat.nameEn);
}

// Display label — Arabic falls back to the API's nameAr when present
export function catLabel(cat: { nameEn?: string; nameAr?: string } | undefined, lang: 'en' | 'ar'): string {
  if (!cat) return '—';
  if (lang === 'ar' && cat.nameAr) return cat.nameAr;
  return cat.nameEn ?? '—';
}
