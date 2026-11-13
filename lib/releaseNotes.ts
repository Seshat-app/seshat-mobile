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
    id: '2026-11-v1.1.4',
    version: '1.1.4',
    date: '2026-11-13',
    title: { en: "More of your money, in one place", ar: "مزيد من مالك في مكان واحد" },
    items: [
      { en: "Net worth: one number for everything you hold, your accounts and savings minus what you owe, on Home.", ar: "صافي الثروة: رقم واحد لكل ما تملكه، حساباتك ومدخراتك مطروحاً منها ما عليك، في الرئيسية." },
      { en: "Price targets: Seshat tells you when gold, the dollar or a stock reaches the price you choose.", ar: "أهداف السعر: ينبّهك سيشات عندما يصل الذهب أو الدولار أو سهم إلى السعر الذي تختاره." },
      { en: "A zakat estimate for what you hold in savings, with how it is worked out.", ar: "تقدير للزكاة على ما تملكه في المدخرات، مع شرح كيف حُسب." },
      { en: "Export your transactions as a CSV file from your profile.", ar: "صدّر معاملاتك كملف CSV من ملفك الشخصي." },
      { en: "The phone app keeps what you log without a connection and sends it when you are back online.", ar: "التطبيق على الهاتف يحفظ ما تسجله بلا اتصال ويرسله عند عودة الإنترنت." },
      { en: "Share how a goal is going from the goals screen.", ar: "شارك تقدّم هدفك من شاشة الأهداف." },
      { en: "Usage statistics: Seshat counts which features are used, never your amounts or notes, and you can switch it off in your profile.", ar: "إحصاءات الاستخدام: يعدّ سيشات الميزات المستخدمة فقط، دون مبالغك أو ملاحظاتك، ويمكنك إيقافها من ملفك الشخصي." },
      { en: "Every screen header now has the same back, workspace and add buttons.", ar: "كل ترويسات الشاشات صارت بنفس أزرار الرجوع ومساحة العمل والإضافة." },
    ],
  },
  {
    id: '2026-11-v1.1.3',
    version: '1.1.3',
    date: '2026-11-12',
    title: { en: "Calmer and clearer", ar: "أهدأ وأوضح" },
    items: [
      { en: "Pick dates from a calendar instead of typing them, and fields stay in view above the keyboard.", ar: "اختر التواريخ من تقويم بدل كتابتها، وتبقى الحقول ظاهرة فوق لوحة المفاتيح." },
      { en: "Savings: chart ranges from 1 month to all time, a chart for each holding, gold with its masna3ya, and a way to add what you already own.", ar: "المدخرات: رسم بياني بفترات من شهر إلى الكل، ورسم لكل أصل، والذهب مع المصنعية، وإمكانية إضافة ما تملكه من قبل." },
      { en: "Today's budget no longer drops to zero when a goal is out of reach, and gam3ya suggestions stay within what your income can carry.", ar: "ميزانية اليوم لا تنهار إلى صفر عندما يكون هدف بعيد المنال، واقتراحات الجمعيات تبقى في حدود دخلك." },
      { en: "Gam3yas, savings and the daily budget belong to your personal profile only, so organizations no longer show them.", ar: "الجمعيات والمدخرات وميزانية اليوم للملف الشخصي فقط، فلا تظهر في المنظمات." },
      { en: "Terms of Use and Privacy Policy are accepted when you sign up, and shown once to existing accounts.", ar: "شروط الاستخدام وسياسة الخصوصية تُقبل عند التسجيل، وتظهر مرة واحدة للحسابات الحالية." },
      { en: "New accounts say what they already have (savings, a gam3ya, a debt), and Android asks for notification access during setup. Existing accounts are asked once about savings.", ar: "الحسابات الجديدة تحدد ما لديها (مدخرات أو جمعية أو دين)، وأندرويد يطلب الوصول إلى الإشعارات أثناء الإعداد. والحسابات الحالية تُسأل مرة واحدة عن المدخرات." },
      { en: "Forgot your current password? Reset it by email straight from Change password.", ar: "نسيت كلمة السر الحالية؟ أعد تعيينها بالبريد مباشرة من تغيير كلمة السر." },
    ],
  },
  {
    id: '2026-11-v1.1.2',
    version: '1.1.2',
    date: '2026-11-11',
    title: { en: "Everything connected", ar: "كل شيء مترابط" },
    items: [
      { en: "Today's budget: Seshat works out how much you can spend today from your income, goals, bills, debts and gam3yas, and tells you why. There is no number to type.", ar: "ميزانية اليوم: يحسب سيشات كم يمكنك أن تنفق اليوم من دخلك وأهدافك وفواتيرك وديونك وجمعياتك، ويشرح لك السبب. لا يوجد رقم تكتبه." },
      { en: "One “Needs you today” card replaces the stack of banners: a gam3ya payment, a bill, a debt, a question from Seshat, a budget close to its cap.", ar: "بطاقة «يحتاجك اليوم» واحدة بدل تكدّس التنبيهات: قسط جمعية، فاتورة، دين، سؤال من سيشات، أو ميزانية قاربت حدّها." },
      { en: "Gam3yas, monthly or weekly: track what you pay and when you collect. Reminders come back until you answer, and you can answer from the notification.", ar: "الجمعيات، شهرية أو أسبوعية: تابع ما تدفعه وموعد قبضك. التذكير يتكرر حتى تردّ، ويمكنك الرد من الإشعار نفسه." },
      { en: "Savings & investments: gold, dollars, crypto and anything else you bought, valued from live prices with what you gained or lost over time. Buying moves money out of an account without counting as spending.", ar: "المدخرات والاستثمارات: ذهب ودولار وكريبتو وأي شيء اشتريته، بقيمته من الأسعار الحية ومكسبك أو خسارتك مع الوقت. الشراء يخصم من حسابك دون أن يُحسب مصروفاً." },
      { en: "Goals have deadlines and count the savings you link to them.", ar: "للأهداف مواعيد، وتحتسب المدخرات التي تربطها بها." },
      { en: "Already own gold or dollars? Add them with the date you bought them and no account is touched. For gold you can enter the masna3ya, and Seshat shows how much of what you paid it was.", ar: "تملك ذهباً أو دولاراً من قبل؟ أضفه بتاريخ شرائه دون أن يتأثر أي حساب. وللذهب يمكنك إدخال المصنعية ليُظهر سيشات كم منها ضمن ما دفعت." },
      { en: "The Add sheet uses your phone's own keyboard, and the note is a small icon beside the amount.", ar: "شاشة الإضافة تستخدم لوحة مفاتيح هاتفك، والملاحظة أيقونة صغيرة بجانب المبلغ." },
      { en: "Cards from bank notifications are found more reliably (Arabic digits, bank names), and ATM withdrawals are recognised from real bank messages.", ar: "بطاقات إشعارات البنوك تُلتقط بدقة أكبر (أرقام عربية، أسماء البنوك)، وسحب الصراف يُعرَف من رسائل البنوك الحقيقية." },
      { en: "Home shows one banner at a time, and the accounts and gam3ya cards appear only when there is something to show.", ar: "الرئيسية تعرض تنبيهاً واحداً في كل مرة، وبطاقتا الحسابات والجمعيات تظهران فقط عند وجود ما يُعرض." },
    ],
  },
  {
    id: '2026-11-v1.1.1',
    version: '1.1.1',
    date: '2026-11-07',
    title: { en: 'Smarter entries, clearer accounts', ar: 'إدخال أذكى وحسابات أوضح' },
    items: [
      { en: 'Add sheet: Cash is picked for you, other currencies are converted at the live rate (5 USD becomes EGP on the spot), and you can create a missing category right there.', ar: 'لوحة الإضافة: الكاش مختار تلقائياً، والعملات الأخرى تُحوَّل بسعر الصرف الحي (٥ دولار تصبح جنيهاً فوراً)، ويمكنك إنشاء فئة ناقصة من نفس المكان.' },
      { en: 'The note box now reads your sentence properly: in “fuel 92, 5 liters, 22.25 per liter” the amount is 111.25, and 92 is just the fuel grade.', ar: 'خانة الملاحظة تفهم جملتك: في «بنزين ٩٢، ٥ لتر، ٢٢٫٢٥ للتر» المبلغ ١١١٫٢٥ و٩٢ مجرد نوع البنزين.' },
      { en: 'Accounts: merge two numbers of the same account, line a balance up with what your bank message says, and Vodafone Cash sends now come off your wallet.', ar: 'الحسابات: ادمج رقمين لنفس الحساب، وطابق الرصيد مع ما تقوله رسالة البنك، وتحويلات فودافون كاش تُخصم الآن من محفظتك.' },
      { en: 'Home: a Today / per day / month card, a quick look at where your money is, and a redesigned radar: tap a dot to see the category.', ar: 'الرئيسية: بطاقة اليوم والمتوسط والشهر، ونظرة سريعة على أين أموالك، ورادار جديد: اضغط على نقطة لترى الفئة.' },
      { en: 'Tap your balance to hide every amount (no more eye button).', ar: 'اضغط على رصيدك لإخفاء كل المبالغ (لا زر عين بعد الآن).' },
      { en: 'Reports now list every finished month since you joined. Invite friends with your referral link from Profile.', ar: 'التقارير تعرض كل شهر منتهٍ منذ انضمامك. ادعُ أصدقاءك برابط الإحالة من الملف الشخصي.' },
      { en: 'Reminders and bills now arrive in one dedicated Seshat chat instead of an old conversation.', ar: 'التذكيرات والفواتير تصل الآن في محادثة سيشات مخصصة بدلاً من محادثة قديمة.' },
    ],
  },
  {
    id: '2026-11-v1.1.0',
    version: '1.1.0',
    date: '2026-11-06',
    title: { en: 'Your money, in every place it lives', ar: 'أموالك في كل مكان تعيش فيه' },
    items: [
      { en: 'Accounts: add your bank account, wallet and cash, see each balance, and move money between them. An ATM withdrawal becomes cash automatically, not spending.', ar: 'الحسابات: أضف حسابك البنكي ومحفظتك والكاش، وشاهد رصيد كل واحد، وانقل المال بينها. سحب الماكينة يصبح كاش تلقائياً لا مصروفاً.' },
      { en: 'Seshat asks when it is unsure about a captured transaction, with quick answers right in the notification.', ar: 'سيشات تسألك عندما لا تتأكد من معاملة مرصودة، مع إجابات سريعة داخل الإشعار.' },
      { en: 'Home-screen widgets on iPhone and Android: Month at a glance, Budgets and cards, Maat’s verdict and Quick add.', ar: 'ودجتس للشاشة الرئيسية على آيفون وأندرويد: شهرك بنظرة، الميزانيات والبطاقات، حكم ماعت، وإضافة سريعة.' },
      { en: 'Hide numbers: tap your balance to show every amount as ••••, and tap again to bring them back.', ar: 'إخفاء الأرقام: اضغط على رصيدك لتظهر كل المبالغ ••••، واضغط مرة أخرى لإعادتها.' },
      { en: 'App lock with Face ID or your fingerprint.', ar: 'قفل التطبيق بـ Face ID أو بصمتك.' },
      { en: 'A gentle daily reminder to log (1 PM and 8 PM). Turn it off in Habits.', ar: 'تذكير يومي لطيف بالتسجيل (١ ظهراً و٨ مساءً). يمكنك إيقافه من العادات.' },
      { en: 'iPhone Shortcuts and Siri: “Quick add” logs an amount and a few words without opening the app.', ar: 'اختصارات آيفون وسيري: «إضافة سريعة» تسجّل مبلغاً وكلمات دون فتح التطبيق.' },
      { en: 'Debts: amounts change only through entries (payment or add to debt), and old debts are archived instead of deleted.', ar: 'الديون: المبالغ تتغير فقط عبر القيود (سداد أو زيادة)، والديون القديمة تُؤرشف بدل أن تُحذف.' },
      { en: 'Fixes: profile photo upload, the keyboard covering the note field, organization categories, and voice errors.', ar: 'إصلاحات: رفع صورة الملف، تغطية لوحة المفاتيح لحقل الملاحظة، فئات المنظمات، وأخطاء الصوت.' },
    ],
  },
];

export const LATEST_RELEASE_ID = RELEASE_NOTES[0].id;
