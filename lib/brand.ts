/**
 * Mirror of seshat-web/src/lib/brand.ts. Same shape, same source of truth.
 * Every place that says the product name in the mobile app - app icon
 * caption, animated splash wordmark, navbar, sign-in screen, profile,
 * monthly report header, share text - imports BRAND from here.
 *
 * When the name changes, edit BRAND.name + BRAND.nameAr here AND in the
 * web mirror. Two-file commit, zero hunting through screens.
 *
 * Product: "Seshat" (Arabic: "سيشات"). The AI assistant inside Seshat is
 * "Maat" (Arabic: "ماعت"), read it from BRAND.aiName. The crosshair mark +
 * gold accent carry the identity; the wordmark + copy reference this file.
 */

export type BrandConfig = {
  name: string;
  nameAr: string;
  // AI assistant name (distinct from the product).
  aiName: string;
  aiNameAr: string;
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
  // report header all read this. The AI assistant is "Maat" (BRAND.aiName).
  name: 'Seshat',
  nameAr: 'سيشات',
  aiName: 'Maat',
  aiNameAr: 'ماعت',
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
