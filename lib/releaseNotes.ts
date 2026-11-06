/**
 * Release notes shown in the "What's new" panel. Newest first. To announce a release, add an entry at the TOP
 * with a new `id`: every signed-in user sees the panel once on their next launch, and can reopen all of them
 * from Profile → What's new.
 */
export type ReleaseNote = {
  id: string;
  version: string;
  date: string; // YYYY-MM-DD
  title: { en: string; ar: string };
  items: Array<{ en: string; ar: string }>;
};

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    id: '2026-11-v1.1.0',
    version: '1.1.0',
    date: '2026-11-06',
    title: { en: 'Your money, in every place it lives', ar: 'أموالك في كل مكان تعيش فيه' },
    items: [
      { en: 'Accounts: add your bank account, wallet and cash, see each balance, and move money between them. An ATM withdrawal becomes cash automatically, not spending.', ar: 'الحسابات: أضف حسابك البنكي ومحفظتك والكاش، وشاهد رصيد كل واحد، وانقل المال بينها. سحب الماكينة يصبح كاش تلقائياً لا مصروفاً.' },
      { en: 'Seshat asks when it is unsure about a captured transaction, with quick answers right in the notification.', ar: 'سيشات تسألك عندما لا تتأكد من معاملة مرصودة، مع إجابات سريعة داخل الإشعار.' },
      { en: 'Home-screen widgets on iPhone and Android: Month at a glance, Budgets and cards, Maat’s verdict and Quick add.', ar: 'ودجتس للشاشة الرئيسية على آيفون وأندرويد: شهرك بنظرة، الميزانيات والبطاقات، حكم ماعت، وإضافة سريعة.' },
      { en: 'Hide numbers: tap the eye beside your balance to show amounts as ••••.', ar: 'إخفاء الأرقام: اضغط على العين بجانب رصيدك لتظهر المبالغ ••••.' },
      { en: 'App lock with Face ID or your fingerprint.', ar: 'قفل التطبيق بـ Face ID أو بصمتك.' },
      { en: 'A gentle daily reminder to log (1 PM and 8 PM). Turn it off in Habits.', ar: 'تذكير يومي لطيف بالتسجيل (١ ظهراً و٨ مساءً). يمكنك إيقافه من العادات.' },
      { en: 'iPhone Shortcuts and Siri: “Quick add” logs an amount and a few words without opening the app.', ar: 'اختصارات آيفون وسيري: «إضافة سريعة» تسجّل مبلغاً وكلمات دون فتح التطبيق.' },
      { en: 'Debts: amounts change only through entries (payment or add to debt), and old debts are archived instead of deleted.', ar: 'الديون: المبالغ تتغير فقط عبر القيود (سداد أو زيادة)، والديون القديمة تُؤرشف بدل أن تُحذف.' },
      { en: 'Fixes: profile photo upload, the keyboard covering the note field, organization categories, and voice errors.', ar: 'إصلاحات: رفع صورة الملف، تغطية لوحة المفاتيح لحقل الملاحظة، فئات المنظمات، وأخطاء الصوت.' },
    ],
  },
];

export const LATEST_RELEASE_ID = RELEASE_NOTES[0].id;
