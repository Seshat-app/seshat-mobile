/**
 * Mirror of seshat-web/src/lib/brand.ts. Same shape, same source of truth.
 * Every place that says the product name in the mobile app - app icon
 * caption, animated splash wordmark, navbar, sign-in screen, profile,
 * monthly report header, share text - imports BRAND from here.
 *
 * When the name changes, edit BRAND.name + BRAND.nameAr here AND in the
 * web mirror. Two-file commit, zero hunting through screens.
 *
 * Product: "Seshat" (Arabic: "سيشات"). Two voices live inside it:
 *   • Seshat — the everyday scribe you chat with (logs, answers, captures).
 *     Read from BRAND.aiName; it shares the product name on purpose ("ask
 *     Seshat"), because the app IS the scribe.
 *   • Maat — goddess of truth, reserved for the monthly report + insights +
 *     the verdict ("the weighing of your month"). Read from BRAND.truthName.
 * Seshat records; Maat weighs. The crosshair mark + gold accent carry the
 * identity; the wordmark + copy reference this file.
 */

export type BrandConfig = {
  name: string;
  nameAr: string;
  // The everyday scribe assistant you chat with. Shares the product name
  // (you "ask Seshat"). Distinct from the truth voice below.
  aiName: string;
  aiNameAr: string;
  // The truth/weighing voice — Maat. ONLY the monthly report + insights +
  // the verdict. Never the daily chat. Seshat records; Maat weighs.
  truthName: string;
  truthNameAr: string;
  tagline: string;
  taglineAr: string;
  domain: string;
  supportEmail: string;
  legalName: string;
  founderName: string;
  social: {
    instagram: string;
    x: string;
    tiktok: string;
    linkedin: string;
    youtube: string;
    github: string;
  };
};

export const BRAND: BrandConfig = {
  // Product name. The mobile splash, navbar, profile screen, monthly
  // report header all read this.
  name: 'Seshat',
  nameAr: 'سيشات',
  // The daily scribe — shares the product name on purpose ("ask Seshat").
  aiName: 'Seshat',
  aiNameAr: 'سيشات',
  // The weighing voice — surfaces only in the monthly report + verdict.
  truthName: 'Maat',
  truthNameAr: 'ماعت',
  tagline: '',
  taglineAr: '',
  domain: 'seshat.site',
  supportEmail: 'hello@seshat.site',
  legalName: 'Seshat',
  founderName: "Mo'men Khaled",
  social: {
    instagram: '',
    x: '',
    tiktok: '',
    linkedin: '',
    youtube: '',
    github: '',
  },
};

/**
 * Resolves the brand name for the current language. Use this anywhere
 * you'd otherwise write `lang === 'ar' ? BRAND.nameAr : BRAND.name`.
 */
export function brandName(lang: 'en' | 'ar'): string {
  return lang === 'ar' ? BRAND.nameAr : BRAND.name;
}

export function brandTagline(lang: 'en' | 'ar'): string {
  return lang === 'ar' ? BRAND.taglineAr : BRAND.tagline;
}
