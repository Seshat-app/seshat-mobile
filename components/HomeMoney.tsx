import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Landmark, CreditCard, Wallet, Banknote, Users } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { useAppData } from '../lib/appData';
import { apiFetch, hasToken } from '../lib/api';
import { fontBody, fontMono } from '../lib/fonts';
import { RCard, REyebrow, RAmount, RProgress, RButton } from './ui';
import { DailyBudgetSheet, type DailyBudgetInfo } from './MoneySheets';
import type { CardSummary } from '../lib/cards';
import type { DashboardData } from './dashboards';

const ICON = { card: CreditCard, account: Landmark, wallet: Wallet, cash: Banknote } as const;

/**
 * Today, per day and the month, in three numbers (like the lock-screen widget): what today netted, what a day
 * averages this month, and the month's total spending.
 */
export function TodayCard({ data, currency }: { data: DashboardData; currency: string }) {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const today = new Date().toISOString().slice(0, 10);
  const last = data.dailyNet?.[data.dailyNet.length - 1];
  const todayNet = last && last.date === today ? last.net : 0;
  const dayOfMonth = Math.max(1, new Date().getDate());
  const avg = data.current.expense.total / dayOfMonth;

  const Col = ({ label, value, sign }: { label: string; value: number; sign?: boolean }) => (
    <View style={{ flex: 1 }}>
      <REyebrow style={{ marginBottom: 6, textAlign: ar ? 'right' : 'left' }}>{label}</REyebrow>
      <RAmount value={value} currency={currency} size={17} decimals={0} sign={!!sign} />
    </View>
  );
  return (
    <RCard padding={16} style={{ marginHorizontal: 16, marginTop: 18, marginBottom: 12 }}>
      <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 14 }}>
        <Col label={ar ? 'صافي اليوم' : 'Today (net)'} value={todayNet} sign />
        <Col label={ar ? 'متوسط اليوم' : 'Per day'} value={-avg} />
      </View>
    </RCard>
  );
}

/** Where the money sits: total, and the top accounts with balances. Tap for the full Accounts screen. */
export function AccountsOverview({ currency }: { currency: string }) {
  const { tok, lang } = useI18n();
  const { dataVersion } = useAppData();
  const router = useRouter();
  const ar = lang === 'ar';
  const [cards, setCards] = useState<CardSummary[] | null>(null);

  useEffect(() => {
    let alive = true;
    hasToken().then((ok) => {
      if (!ok) return;
      apiFetch<{ data: CardSummary[] }>('/cards').then((r) => { if (alive) setCards(r.data); }).catch(() => {});
    });
    return () => { alive = false; };
  }, [dataVersion]);

  const total = useMemo(() => (cards ?? []).reduce((a, c) => a + (c.balance ?? 0), 0), [cards]);
  // Only the default Cash? Nothing to overview yet: the card appears once a real account exists.
  if (!cards || !cards.some((c) => c.kind !== 'cash')) return null;
  // Most used first (entries this month, then overall), then the biggest balance; five rows at most.
  const top = [...cards]
    .sort((a, b) => (b.month?.count ?? 0) - (a.month?.count ?? 0) || (b.total?.count ?? 0) - (a.total?.count ?? 0) || Math.abs(b.balance) - Math.abs(a.balance))
    .slice(0, 5);

  return (
    <Pressable onPress={() => router.push('/cards')} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      <RCard padding={16} style={{ marginHorizontal: 16, marginBottom: 12 }}>
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <REyebrow>{ar ? 'أين أموالك' : 'Where your money is'}</REyebrow>
          <ChevronRight size={16} color={tok.muted} style={{ transform: [{ scaleX: ar ? -1 : 1 }] }} />
        </View>
        <RAmount value={total} currency={currency} size={26} decimals={0} />
        <View style={{ marginTop: 12, gap: 10 }}>
          {top.map((c) => {
            const Icon = ICON[c.kind] ?? CreditCard;
            return (
              <View key={c.id} style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
                <Icon size={15} color={tok.gold} />
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: fontBody(lang), fontSize: 14, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{c.name}</Text>
                <RAmount value={c.balance ?? 0} currency={currency} size={14} decimals={0} />
              </View>
            );
          })}
        </View>
        {cards.length > top.length && (
          <Text style={{ marginTop: 10, fontFamily: fontMono('regular'), fontSize: 11, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>
            {ar ? `و${cards.length - top.length} أخرى` : `+${cards.length - top.length} more`}
          </Text>
        )}
      </RCard>
    </Pressable>
  );
}


type SavingsOv = { currency: string; value: number; gain: number; gainPct: number | null; holdings: Array<{ quantity: number }> };

/** What you have saved or invested, and how it is doing. Not shown until you have added something. */
export function SavingsCard() {
  const { tok, lang } = useI18n();
  const { dataVersion } = useAppData();
  const router = useRouter();
  const ar = lang === 'ar';
  const [ov, setOv] = useState<SavingsOv | null>(null);
  useEffect(() => {
    let alive = true;
    hasToken().then((ok) => {
      if (!ok) return;
      apiFetch<{ data: SavingsOv }>('/savings').then((r) => { if (alive) setOv(r.data); }).catch(() => {});
    });
    return () => { alive = false; };
  }, [dataVersion]);
  if (!ov || !ov.holdings.some((h) => h.quantity > 0)) return null;
  const up = ov.gain >= 0;
  return (
    <Pressable onPress={() => router.push('/savings' as never)} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      <RCard padding={16} style={{ marginHorizontal: 16, marginBottom: 12 }}>
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <REyebrow>{ar ? 'مدخراتك واستثماراتك' : 'Your savings & investments'}</REyebrow>
          <ChevronRight size={16} color={tok.muted} style={{ transform: [{ scaleX: ar ? -1 : 1 }] }} />
        </View>
        <RAmount value={ov.value} currency={ov.currency} size={26} decimals={0} />
        <Text style={{ marginTop: 6, fontFamily: fontMono('regular'), fontSize: 12, color: up ? '#6FCF97' : tok.alertText, textAlign: ar ? 'right' : 'left' }}>
          {up ? (ar ? 'مكسب ' : 'Gain ') : (ar ? 'خسارة ' : 'Loss ')}{up ? '+' : '−'}{Math.round(Math.abs(ov.gain)).toLocaleString('en-US')}{ov.gainPct !== null ? `  (${up ? '+' : '−'}${Math.abs(ov.gainPct)}%)` : ''}
        </Text>
      </RCard>
    </Pressable>
  );
}

type TodayRow = { id: string; kind: string; title: string; body: string; screen: 'gam3ya' | 'reminders' | 'debts' | 'review' | 'goals' | 'savings' | 'home'; refId?: string };

/**
 * The few things that need you today, from one list the server builds (a gam3ya payment or payout, a bill coming up, a
 * debt falling due, questions Seshat has, being over today's budget). Not shown at all when nothing needs you.
 */
export type NeedsExtra = { id: string; title: string; body: string; onPress: () => void };

export function TodayNeeds({ extra = [] }: { extra?: NeedsExtra[] } = {}) {
  const { tok, lang } = useI18n();
  const { dataVersion } = useAppData();
  const router = useRouter();
  const ar = lang === 'ar';
  const [rows, setRows] = useState<TodayRow[]>([]);
  useEffect(() => {
    let alive = true;
    hasToken().then((ok) => {
      if (!ok) return;
      apiFetch<{ data: TodayRow[] }>('/me/today').then((r) => { if (alive) setRows(r.data); }).catch(() => {});
    });
    return () => { alive = false; };
  }, [dataVersion]);
  if (rows.length === 0 && extra.length === 0) return null;
  const go = (r: TodayRow) => {
    if (r.screen === 'gam3ya') router.push(`/gam3ya/${r.refId}` as never);
    else if (r.screen === 'reminders') router.push('/reminders' as never);
    else if (r.screen === 'debts') router.push('/debts' as never);
    else if (r.screen === 'review') router.push('/review' as never);
    else if (r.screen === 'goals') router.push('/goals' as never);
  };
  // The one-time question about savings: "Yes" opens the form to add them, "No" ends it. Either way it is not asked again.
  const answerAsk = (kind: 'ask_savings' | 'ask_goals', answer: 'yes' | 'no') => {
    setRows((rs) => rs.filter((x) => x.kind !== kind));
    apiFetch(kind === 'ask_savings' ? '/me/savings-asked' : '/me/goals-asked', { method: 'POST', body: JSON.stringify({ answer }) }).catch(() => {});
    if (answer === 'yes') router.push((kind === 'ask_savings' ? '/savings/new' : '/goals?new=1') as never);
    // The next question (goals after savings) appears once this one is settled.
    else setTimeout(() => apiFetch<{ data: TodayRow[] }>('/me/today').then((r) => setRows(r.data)).catch(() => {}), 400);
  };
  return (
    <RCard accent padding={16} style={{ marginHorizontal: 16, marginTop: 6, marginBottom: 12 }}>
      <REyebrow style={{ marginBottom: 10, textAlign: ar ? 'right' : 'left' }}>{ar ? 'يحتاجك اليوم' : 'Needs you today'}</REyebrow>
      <View style={{ gap: 12 }}>
        {extra.map((x, i) => (
          <Pressable key={x.id} onPress={x.onPress}
            style={{ gap: 2, paddingTop: i === 0 ? 0 : 12, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: tok.border }}>
            <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ flex: 1, fontFamily: fontBody(lang, 'semibold'), fontSize: 14, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{x.title}</Text>
              <ChevronRight size={15} color={tok.muted} style={{ transform: [{ scaleX: ar ? -1 : 1 }] }} />
            </View>
            <Text style={{ fontFamily: fontBody(lang), fontSize: 12.5, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>{x.body}</Text>
          </Pressable>
        ))}
        {rows.map((r, i0) => { const i = i0 + extra.length; return r.kind === 'ask_savings' || r.kind === 'ask_goals' ? (
          <View key={r.id} style={{ gap: 8, paddingTop: i === 0 ? 0 : 12, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: tok.border }}>
            <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 14, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{r.title}</Text>
            <Text style={{ fontFamily: fontBody(lang), fontSize: 12.5, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>{r.body}</Text>
            <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 10, marginTop: 4 }}>
              <View style={{ flex: 1 }}><RButton full onPress={() => answerAsk(r.kind as 'ask_savings' | 'ask_goals', 'yes')}>{r.kind === 'ask_goals' ? (ar ? 'نعم، أضفه' : 'Yes, add it') : (ar ? 'نعم، أضفها' : 'Yes, add them')}</RButton></View>
              <View style={{ flex: 1 }}><RButton full variant="ghost" onPress={() => answerAsk(r.kind as 'ask_savings' | 'ask_goals', 'no')}>{ar ? 'لا' : 'No'}</RButton></View>
            </View>
          </View>
        ) : (
          <Pressable key={r.id} onPress={() => go(r)} disabled={r.screen === 'home'}
            style={{ gap: 2, paddingTop: i === 0 ? 0 : 12, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: tok.border }}>
            <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ flex: 1, fontFamily: fontBody(lang, 'semibold'), fontSize: 14, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{r.title}</Text>
              {r.screen !== 'home' ? <ChevronRight size={15} color={tok.muted} style={{ transform: [{ scaleX: ar ? -1 : 1 }] }} /> : null}
            </View>
            <Text style={{ fontFamily: fontBody(lang), fontSize: 12.5, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>{r.body}</Text>
          </Pressable>
        ); })}
      </View>
    </RCard>
  );
}

type CircleRow = {
  id: string; name: string; frequency: 'monthly' | 'weekly'; currency: string; archived?: boolean; paymentPerPeriod: number;
  paidCount: number; members: number; overdue: number; finished: boolean; nextDue: { due: string } | null;
};

/** The user's gam3yas at a glance: progress and what is due. Not shown at all when there are none. */
export function Gam3yaOverview() {
  const { tok, lang } = useI18n();
  const { dataVersion } = useAppData();
  const router = useRouter();
  const ar = lang === 'ar';
  const [rows, setRows] = useState<CircleRow[]>([]);
  useEffect(() => {
    let alive = true;
    hasToken().then((ok) => {
      if (!ok) return;
      apiFetch<{ data: CircleRow[] }>('/gam3ya').then((r) => { if (alive) setRows(r.data.filter((g) => !g.archived)); }).catch(() => {});
    });
    return () => { alive = false; };
  }, [dataVersion]);
  if (rows.length === 0) return null;
  const list = [...rows].sort((a, b) => b.overdue - a.overdue).slice(0, 5);
  return (
    <RCard padding={16} style={{ marginHorizontal: 16, marginBottom: 12 }}>
      <Pressable onPress={() => router.push('/gam3ya' as never)} style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <REyebrow>{ar ? 'جمعياتك' : 'Your gam3yas'}</REyebrow>
        <ChevronRight size={16} color={tok.muted} style={{ transform: [{ scaleX: ar ? -1 : 1 }] }} />
      </Pressable>
      <View style={{ gap: 14 }}>
        {list.map((g) => (
          <Pressable key={g.id} onPress={() => router.push(`/gam3ya/${g.id}` as never)} style={{ gap: 6 }}>
            <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
              <Users size={15} color={tok.gold} />
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: fontBody(lang), fontSize: 14, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{g.name}</Text>
              <Text style={{ fontFamily: fontMono('regular'), fontSize: 12, color: g.overdue > 0 ? tok.alertText : tok.muted }}>
                {g.overdue > 0 ? (ar ? `${g.overdue} مستحق` : `${g.overdue} due`) : g.finished ? (ar ? 'انتهت' : 'Finished') : g.nextDue ? g.nextDue.due.slice(5, 10) : ''}
              </Text>
            </View>
            <RProgress value={g.paidCount} max={g.members} color={tok.gold} height={3} />
            <Text style={{ fontFamily: fontMono('regular'), fontSize: 11, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>
              {g.paidCount}/{g.members} · {Math.round(g.paymentPerPeriod).toLocaleString('en-US')} {g.currency} / {g.frequency === 'weekly' ? (ar ? 'أسبوع' : 'week') : (ar ? 'شهر' : 'month')}
            </Text>
          </Pressable>
        ))}
      </View>
    </RCard>
  );
}

/**
 * Today's budget on Home, worked out by Seshat from income, spending and goals: how much is left to spend today to
 * keep the saving target, and why. Nothing to type; tap for the working and the saving rate.
 */
export function DailyBudgetCard() {
  const { tok, lang } = useI18n();
  const { dataVersion } = useAppData();
  const ar = lang === 'ar';
  const [info, setInfo] = useState<DailyBudgetInfo | null>(null);
  const [open, setOpen] = useState(false);

  const load = () => {
    hasToken().then((ok) => {
      if (!ok) return;
      apiFetch<{ data: DailyBudgetInfo }>('/me/daily-budget').then((r) => setInfo(r.data)).catch(() => {});
    });
  };
  useEffect(load, [dataVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!info) return null;
  const cur = info.currency;
  const n = (v: number) => Math.round(v).toLocaleString('en-US');
  const over = info.ready && (info.leftToday ?? 0) < 0;
  const reason = info.ready
    ? info.overIncome
      ? ''
      : info.relaxed
        ? (ar ? 'أنفقت أكثر من خطتك هذا الشهر، فلن يكتمل ادخارك بالكامل.' : 'You have spent more than planned this month, so your saving will fall short.')
        : info.goalsCapped
          ? (ar ? 'أهدافك تطلب أكثر مما يتحمّله دخلك، فحسب سيشات جزءاً معقولاً منه.' : 'Your goals ask for more than your income can carry, so Seshat counted a realistic share.')
          : info.saveReason === 'goals' && (info.goals ?? []).length > 0
        ? (ar ? `لتصل إلى ${(info.goals ?? []).map((g) => g.nameAr).join(' و')}.` : `To reach ${(info.goals ?? []).map((g) => g.name).join(' and ')}.`)
        : (ar ? `هذا ${Math.round(info.savingRate * 100)}٪ من دخلك.` : `That is ${Math.round(info.savingRate * 100)}% of your income.`)
    : '';
  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
        <RCard padding={16} style={{ marginHorizontal: 16, marginBottom: 12 }}>
          {info.ready ? (
            <>
              <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <REyebrow>{ar ? 'ميزانية اليوم' : "Today's budget"}</REyebrow>
                <Text style={{ fontFamily: fontMono('regular'), fontSize: 11, color: tok.muted }}>
                  {ar ? `${info.daysLeft} يوم متبقٍّ` : `${info.daysLeft} days left`}
                </Text>
              </View>
              <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'baseline', gap: 8 }}>
                <RAmount value={Math.abs(info.leftToday ?? 0)} currency={cur} size={26} decimals={0} color={over ? tok.alertText : undefined} />
                <Text style={{ fontFamily: fontBody(lang), fontSize: 13, color: over ? tok.alertText : tok.muted }}>
                  {over ? (ar ? 'فوق ميزانية اليوم' : 'over today’s budget') : (ar ? 'متبقٍّ لك اليوم' : 'left to spend today')}
                </Text>
              </View>
              <View style={{ marginTop: 10 }}>
                <RProgress value={info.spentToday ?? 0} max={Math.max(1, info.dailyBudget ?? 1)} color={over ? tok.alertText : tok.gold} height={6} />
              </View>
              <Text style={{ marginTop: 10, fontFamily: fontBody(lang), fontSize: 13, lineHeight: 19, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>
                {info.overIncome
                  ? (ar ? 'أنفقت دخل هذا الشهر. اكتفِ بالضروريات حتى يبدأ الشهر الجديد.' : 'This month’s income is spent. Stick to essentials until the new month.')
                  : info.relaxed
                    ? (ar ? `أنفق حتى ${n(info.dailyBudget ?? 0)} ${cur} اليوم لتبقى ضمن دخلك.` : `Spend up to ${n(info.dailyBudget ?? 0)} ${cur} today to stay within your income.`)
                    : ar
                      ? `أنفق حتى ${n(info.dailyBudget ?? 0)} ${cur} اليوم لتحتفظ بـ ${n(info.saveTarget ?? 0)} ${cur} بنهاية الشهر.`
                      : `Spend up to ${n(info.dailyBudget ?? 0)} ${cur} today to keep ${n(info.saveTarget ?? 0)} ${cur} by the end of the month.`}
              </Text>
              <Text style={{ marginTop: 4, fontFamily: fontMono('regular'), fontSize: 11, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>{reason}</Text>
            </>
          ) : (
            <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <REyebrow style={{ marginBottom: 4, textAlign: ar ? 'right' : 'left' }}>{ar ? 'ميزانية اليوم' : "Today's budget"}</REyebrow>
                <Text style={{ fontFamily: fontBody(lang), fontSize: 14, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>
                  {ar ? 'أخبر سيشات بدخلك الشهري لتعرف كم تنفق كل يوم.' : 'Tell Seshat your monthly income to see what to spend each day.'}
                </Text>
              </View>
              <ChevronRight size={16} color={tok.muted} style={{ transform: [{ scaleX: ar ? -1 : 1 }] }} />
            </View>
          )}
        </RCard>
      </Pressable>
      <DailyBudgetSheet visible={open} onClose={() => setOpen(false)} info={info} onDone={load} />
    </>
  );
}

type NetWorthInfo = { currency: string; total: number; parts: { accounts: number; savings: number; gam3ya: number; debts: number }; approximate: boolean; personalOnly?: boolean };

/**
 * All the money in one card: what the person owns as one number, split into accounts and cash, savings, gam3yas and
 * debts, each line opening its own screen. (Replaces separate cards that showed overlapping totals.)
 */
export function NetWorthCard() {
  const { tok, lang } = useI18n();
  const { dataVersion } = useAppData();
  const router = useRouter();
  const ar = lang === 'ar';
  const [nw, setNw] = useState<NetWorthInfo | null>(null);
  const [gain, setGain] = useState<{ gain: number; gainPct: number | null } | null>(null);
  useEffect(() => {
    let alive = true;
    hasToken().then((ok) => {
      if (!ok) return;
      apiFetch<{ data: NetWorthInfo }>('/me/net-worth').then((r) => { if (alive) setNw(r.data); }).catch(() => {});
      apiFetch<{ data: SavingsOv }>('/savings').then((r) => { if (alive && r.data.holdings.some((h) => h.quantity > 0)) setGain({ gain: r.data.gain, gainPct: r.data.gainPct }); }).catch(() => {});
    });
    return () => { alive = false; };
  }, [dataVersion]);
  if (!nw || nw.personalOnly) return null;
  const n = (v: number) => `${v < 0 ? '−' : ''}${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
  const rows: Array<{ key: string; label: string; value: number; to: string; sub?: string; subColor?: string }> = [
    { key: 'accounts', label: ar ? 'الحسابات والكاش' : 'Accounts and cash', value: nw.parts.accounts, to: '/cards' },
    ...(nw.parts.savings !== 0 ? [{
      key: 'savings', label: ar ? 'المدخرات والاستثمارات' : 'Savings and investments', value: nw.parts.savings, to: '/savings',
      sub: gain ? `${gain.gain >= 0 ? '+' : '−'}${Math.abs(Math.round(gain.gain)).toLocaleString('en-US')}${gain.gainPct !== null ? ` (${gain.gain >= 0 ? '+' : '−'}${Math.abs(gain.gainPct)}%)` : ''}` : undefined,
      subColor: gain && gain.gain < 0 ? tok.alertText : '#6FCF97',
    }] : []),
    ...(nw.parts.gam3ya !== 0 ? [{ key: 'gam3ya', label: ar ? 'في الجمعيات (المدفوع)' : 'In gam3yas (paid in)', value: nw.parts.gam3ya, to: '/gam3ya' }] : []),
    ...(nw.parts.debts !== 0 ? [{ key: 'debts', label: ar ? 'ديون عليك' : 'Debts you owe', value: nw.parts.debts, to: '/debts' }] : []),
  ];
  return (
    <RCard padding={16} style={{ marginHorizontal: 16, marginBottom: 12 }}>
      <REyebrow style={{ marginBottom: 8, textAlign: ar ? 'right' : 'left' }}>{ar ? 'ما أملكه' : 'What I own'}</REyebrow>
      <RAmount value={nw.total} currency={nw.currency} size={26} decimals={0} />
      <View style={{ marginTop: 6 }}>
        {rows.map((r, i) => (
          <Pressable
            key={r.key}
            onPress={() => router.push(r.to as never)}
            style={({ pressed }) => ({
              flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, paddingVertical: 11,
              borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: tok.border, opacity: pressed ? 0.8 : 1,
            })}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fontBody(lang), fontSize: 14, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{r.label}</Text>
              {r.sub ? <Text style={{ marginTop: 2, fontFamily: fontMono('regular'), fontSize: 11, color: r.subColor, textAlign: ar ? 'right' : 'left' }}>{r.sub}</Text> : null}
            </View>
            <Text style={{ fontFamily: fontMono('regular'), fontSize: 14, color: r.value < 0 ? tok.alertText : tok.bone }}>{n(r.value)}</Text>
            <ChevronRight size={15} color={tok.muted} style={{ transform: [{ scaleX: ar ? -1 : 1 }] }} />
          </Pressable>
        ))}
      </View>
      {nw.approximate ? <Text style={{ marginTop: 4, fontFamily: fontBody(lang), fontSize: 11.5, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>{ar ? 'بعض المدخرات بلا سعر الآن، فتُحسب بما دفعته.' : 'Some savings have no price right now, so they are counted at what you paid.'}</Text> : null}
    </RCard>
  );
}
