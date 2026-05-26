import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nManager } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Mode, tokens, Tokens } from './theme';

export type Lang = 'en' | 'ar';

type Strings = Record<string, string>;

const EN: Strings = {
  appName: 'Radar',
  seshat: 'Seshat',
  greetingMorning: 'Good morning',
  greetingAfternoon: 'Good afternoon',
  greetingEvening: 'Good evening',
  monthYear: '',
  netBalance: 'Net this month',
  income: 'Income',
  expenses: 'Expenses',
  spendByCategory: 'Spend by category',
  recentActivity: 'Recent activity',
  seeAll: 'See all',
  budgetProgress: 'Budget progress',
  addTransaction: 'Add transaction',
  amount: 'Amount',
  description: 'Description',
  category: 'Category',
  date: 'Date',
  today: 'Today',
  yesterday: 'Yesterday',
  expense: 'Expense',
  earned: 'Income',
  save: 'Save',
  cancel: 'Cancel',
  home: 'Home',
  transactions: 'Records',
  profile: 'Profile',
  overBudget: 'over',
  left: 'left',
  of: 'of',
  talkToSeshat: 'Talk to Seshat',
  detected: 'detected',
  onTrack: 'on track',
  near: 'near limit',
  over: 'over budget',
  deficit: 'deficit',
  topCategory: 'Top category',
  records: 'records',
  search: 'Search',
  all: 'All',
  loading: 'loading...',
  noRecords: 'Nothing recorded yet.',
  noRecordsSub: "Add your first transaction and Seshat starts watching.",
  signOut: 'Sign out',
  saveChanges: 'Save changes',
  saved: 'saved',
  saving: 'saving',
  defaultCurrency: 'Default currency',
  language: 'Language',
  english: 'English',
  arabic: 'العربية',
  theme: 'Theme',
  dark: 'Dark',
  light: 'Light',
  mayShort: 'May',
  // Auth
  authVersion: 'Radar · v1.0',
  loginTitle: 'Welcome back.',
  loginSub: 'Nothing flies under.',
  registerTitle: "Let's start watching.",
  registerSub: 'Three fields. Then Seshat takes over.',
  forgotTitle: "What's your email?",
  forgotSub: 'Reset link in your inbox in seconds.',
  forgotSentTitle: 'Sent.',
  forgotSentSub: 'Check your inbox. Link expires in 15 minutes.',
  email: 'Email',
  emailOrUsername: 'Email or username',
  password: 'Password',
  fullName: 'Full name',
  signIn: 'Sign in',
  createAccount: 'Create account',
  sendResetLink: 'Send reset link',
  forgotIt: 'Forgot it?',
  backToSignIn: 'Back to sign in',
  noAccount: "Don't have an account?",
  haveAccount: 'Already on Radar?',
  signUp: 'Sign up',
  or: 'or',
  emailPlaceholder: 'name@radar.app',
  namePlaceholder: 'Your name',
  passwordPlaceholder: '8+ characters',
  termsCopy: 'By continuing you accept the Terms and Privacy Policy.',
  verifyTitle: 'Check your email.',
  verifySub: 'We sent a code to',
  verifyCode: 'Verification code',
  verifyAction: 'Verify',
  almostThere: 'Almost there.',
  username: 'Username',
  confirmPassword: 'Confirm password',
  pleaseWait: 'Please wait...',
  // Seshat
  seshatPrompt: 'Tell me what you spent.',
  seshatExample: '"spent 200 on food"',
  seshatPlaceholder: 'Tell me what you spent...',
  seshatTabIntro: "I'm Seshat. Ask me about your spending.",
  seshatAvailable: 'available',
  message: 'Message...',
  // Empty / errors
  somethingWrong: 'Something went wrong. Try again.',
  signInFirst: 'Please sign in first.',
  notEnoughData: 'Not enough data yet.',
  notEnoughDataSub: 'Add a few transactions and the radar activates.',
};

const AR: Strings = {
  appName: 'رادار',
  seshat: 'سيشات',
  greetingMorning: 'صباح الخير',
  greetingAfternoon: 'مساء الخير',
  greetingEvening: 'مساء الخير',
  monthYear: '',
  netBalance: 'الصافي هذا الشهر',
  income: 'الدخل',
  expenses: 'المصروفات',
  spendByCategory: 'الإنفاق حسب الفئة',
  recentActivity: 'النشاط الأخير',
  seeAll: 'الكل',
  budgetProgress: 'الميزانية',
  addTransaction: 'إضافة معاملة',
  amount: 'المبلغ',
  description: 'الوصف',
  category: 'الفئة',
  date: 'التاريخ',
  today: 'اليوم',
  yesterday: 'أمس',
  expense: 'مصروف',
  earned: 'دخل',
  save: 'حفظ',
  cancel: 'إلغاء',
  home: 'الرئيسية',
  transactions: 'المعاملات',
  profile: 'الحساب',
  overBudget: 'فوق',
  left: 'متبقي',
  of: 'من',
  talkToSeshat: 'تحدث مع سيشات',
  detected: 'تم رصده',
  onTrack: 'في المسار',
  near: 'قرب الحد',
  over: 'تجاوز الحد',
  deficit: 'عجز',
  topCategory: 'الفئة الأعلى',
  records: 'سجل',
  search: 'بحث',
  all: 'الكل',
  loading: 'جارٍ التحميل...',
  noRecords: 'لا شيء مسجَّل بعد.',
  noRecordsSub: 'أضف أول معاملة وسيبدأ سيشات في المراقبة.',
  signOut: 'تسجيل الخروج',
  saveChanges: 'حفظ التغييرات',
  saved: 'تم الحفظ',
  saving: 'جارٍ الحفظ',
  defaultCurrency: 'العملة الافتراضية',
  language: 'اللغة',
  english: 'English',
  arabic: 'العربية',
  theme: 'المظهر',
  dark: 'داكن',
  light: 'فاتح',
  mayShort: 'مايو',
  // Auth
  authVersion: 'رادار · إصدار ١٫٠',
  loginTitle: 'أهلاً بعودتك.',
  loginSub: 'لا شيء يفوت الرادار.',
  registerTitle: 'لنبدأ المراقبة.',
  registerSub: 'ثلاثة حقول. ثم تتولّى سيشات.',
  forgotTitle: 'ما بريدكِ الإلكتروني؟',
  forgotSub: 'رابط الإعادة في بريدكِ خلال ثوانٍ.',
  forgotSentTitle: 'تمّ الإرسال.',
  forgotSentSub: 'راجعي بريدكِ. الرابط ينتهي خلال ١٥ دقيقة.',
  email: 'البريد',
  emailOrUsername: 'البريد أو اسم المستخدم',
  password: 'كلمة السر',
  fullName: 'الاسم الكامل',
  signIn: 'دخول',
  createAccount: 'إنشاء حساب',
  sendResetLink: 'إرسال رابط الإعادة',
  forgotIt: 'نسيتِها؟',
  backToSignIn: 'العودة للدخول',
  noAccount: 'ليس لديكِ حساب؟',
  haveAccount: 'لديكِ حساب بالفعل؟',
  signUp: 'إنشاء',
  or: 'أو',
  emailPlaceholder: 'name@radar.app',
  namePlaceholder: 'اسمك',
  passwordPlaceholder: '٨+ أحرف',
  termsCopy: 'بالمتابعة أنتِ توافقين على الشروط وسياسة الخصوصية.',
  verifyTitle: 'راجعي بريدكِ.',
  verifySub: 'أرسلنا رمزاً إلى',
  verifyCode: 'رمز التحقق',
  verifyAction: 'تحقق',
  almostThere: 'اقتربنا.',
  username: 'اسم المستخدم',
  confirmPassword: 'تأكيد كلمة السر',
  pleaseWait: 'لحظة...',
  // Seshat
  seshatPrompt: 'أخبريني ماذا صرفتِ.',
  seshatExample: '«صرفت ٢٠٠ على أكل»',
  seshatPlaceholder: 'أخبريني ماذا صرفتِ...',
  seshatTabIntro: 'أنا سيشات. اسأليني عن مصروفاتكِ.',
  seshatAvailable: 'متاحة',
  message: 'رسالة...',
  // Empty / errors
  somethingWrong: 'حدث خطأ. حاولي مرة أخرى.',
  signInFirst: 'يجب تسجيل الدخول أولاً.',
  notEnoughData: 'لا توجد بيانات كافية بعد.',
  notEnoughDataSub: 'أضف بعض المعاملات ليبدأ الرادار.',
};

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  t: (key: keyof typeof EN) => string;
  dir: 'rtl' | 'ltr';
  tok: Tokens;
};

const I18nContext = createContext<Ctx | null>(null);

const LANG_KEY = 'radar.lang';
const MODE_KEY = 'radar.mode';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  const [mode, setModeState] = useState<Mode>('dark');

  useEffect(() => {
    SecureStore.getItemAsync(LANG_KEY).then((v) => { if (v === 'en' || v === 'ar') setLangState(v); });
    SecureStore.getItemAsync(MODE_KEY).then((v) => { if (v === 'dark' || v === 'light') setModeState(v); });
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    SecureStore.setItemAsync(LANG_KEY, l).catch(() => {});
    // RN's I18nManager.forceRTL changes the entire app's flex direction.
    // Calling it during runtime requires an app reload to take full effect; we
    // achieve the same visual effect via `writingDirection` and per-element
    // direction props in our components.
  };
  const setMode = (m: Mode) => {
    setModeState(m);
    SecureStore.setItemAsync(MODE_KEY, m).catch(() => {});
  };

  const value = useMemo<Ctx>(() => {
    const strings = lang === 'ar' ? AR : EN;
    return {
      lang,
      setLang,
      mode,
      setMode,
      t: (key) => strings[key as string] ?? EN[key as string] ?? String(key),
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      tok: tokens(mode),
    };
  }, [lang, mode]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

// Number formatting — always LTR-ish, Western Arabic numerals are fine
// because the design brief makes that configurable; we keep numbers in
// Latin digits with thousand separators to match the prototype default.
export function formatAmount(value: number, opts: { decimals?: number; sign?: boolean; short?: boolean } = {}): string {
  const { decimals = 2, sign = false, short = false } = opts;
  const abs = Math.abs(value);
  let str: string;
  if (short && abs >= 1000) {
    str = (abs / 1000).toFixed(abs >= 10000 ? 0 : 1) + 'k';
  } else {
    str = abs.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  const prefix = sign ? (value > 0 ? '+ ' : value < 0 ? '− ' : '') : (value < 0 ? '− ' : '');
  return `${prefix}${str}`;
}

export function currencyLabel(cur: string, lang: Lang): string {
  if (lang === 'ar') {
    if (cur === 'EGP') return 'ج.م';
    if (cur === 'SAR') return 'ر.س';
    if (cur === 'AED') return 'د.إ';
  }
  return cur;
}

export function monthYear(lang: Lang, date = new Date()): string {
  if (lang === 'ar') {
    const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  }
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function greeting(lang: Lang, name: string): string {
  const h = new Date().getHours();
  const key = h < 12 ? 'greetingMorning' : h < 18 ? 'greetingAfternoon' : 'greetingEvening';
  const greet = (lang === 'ar' ? AR : EN)[key];
  return name ? `${greet}, ${name}` : greet;
}
