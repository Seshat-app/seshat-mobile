import { type CatId } from './categoryMap';

// Per-category keyword map. Shared between the single-entry live preview
// and the multi-entry batch parser. English + Egyptian Arabic.
const CAT_KEYWORDS: Array<{ id: CatId; kw: string[] }> = [
  { id: 'food',          kw: ['food', 'lunch', 'dinner', 'meal', 'zooba', 'shawarma', 'pizza', 'koshary', 'cilantro', 'coffee', 'café', 'cafe', 'pepsi', 'cola', 'water', 'juice', 'snack', 'breakfast', 'أكل', 'غدا', 'عشاء', 'طعام', 'قهوة', 'كوفي', 'بيبسي', 'كولا', 'مياه', 'عصير'] },
  { id: 'transport',     kw: ['uber', 'taxi', 'careem', 'transport', 'metro', 'gas', 'fuel', 'petrol', 'car', 'bus', 'train', 'أوبر', 'تاكسي', 'كريم', 'مواصلات', 'بنزين', 'سيارة', 'عربية', 'أتوبيس'] },
  { id: 'shopping',      kw: ['shopping', 'amazon', 'souq', 'noon', 'clothes', 'shirt', 'shoes', 'تسوق', 'سوق', 'نون', 'ملابس', 'هدوم', 'حذاء'] },
  { id: 'entertainment', kw: ['netflix', 'spotify', 'subscription', 'anghami', 'cinema', 'movie', 'game', 'اشتراك', 'نتفليكس', 'سينما', 'فيلم', 'لعبة'] },
  { id: 'housing',       kw: ['rent', 'wifi', 'electric', 'electricity', 'إيجار', 'كهرباء', 'مياه', 'إنترنت'] },
  { id: 'health',        kw: ['pharmacy', 'doctor', 'medicine', 'hospital', 'صيدلية', 'دكتور', 'دواء', 'مستشفى'] },
];

function classifyKeyword(snippet: string): CatId {
  const lower = snippet.toLowerCase();
  const hit = CAT_KEYWORDS.find((c) => c.kw.some((k) => lower.includes(k.toLowerCase())));
  return hit?.id ?? 'other';
}

function normalizeDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[٫،]/g, '.');
}

// Single-entry parser - takes the FIRST amount + a category guessed from
// the whole text. Used by the live preview as the user types.
export function parseNL(text: string): { amount: number; catHint: CatId } | null {
  if (!text?.trim()) return null;
  const m = normalizeDigits(text).match(/\d+(\.\d+)?/);
  if (!m) return null;
  return { amount: parseFloat(m[0]), catHint: classifyKeyword(text) };
}

/**
 * Multi-entry parser. Scans for ALL amounts in the text and pairs each
 * with a ~60-char window for keyword classification. Critical for voice
 * transcripts like "I bought food for 200, Pepsi for 50, coffee for 50,
 * car for 1000" - the old parser only caught the first number.
 *
 * Each detected entry: amount + per-snippet category guess. The sheet
 * shows a "Found N entries" banner when this returns >1 results and lets
 * the user review + confirm before any save.
 */
export type NLEntry = { amount: number; catHint: CatId; snippet: string };

export function parseNLMany(text: string): NLEntry[] {
  if (!text?.trim()) return [];
  const norm = normalizeDigits(text);
  const matches = Array.from(norm.matchAll(/\d+(?:\.\d+)?/g));
  if (matches.length === 0) return [];

  const entries: NLEntry[] = [];
  for (const m of matches) {
    if (m.index === undefined) continue;
    const amount = parseFloat(m[0]);
    if (amount <= 0) continue;
    // 30 chars on each side - wide enough to catch "bought coffee for 50
    // pounds" patterns, narrow enough that distant nouns from other
    // entries don't bleed in.
    const start = Math.max(0, m.index - 30);
    const end = Math.min(norm.length, m.index + m[0].length + 30);
    const snippet = norm.slice(start, end).trim();
    entries.push({ amount, catHint: classifyKeyword(snippet), snippet });
  }
  return entries;
}
