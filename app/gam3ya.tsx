import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, Pressable, Alert, RefreshControl } from 'react-native';
import { ScrollView as ScreenScroll } from '../components/Scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Users, Lightbulb } from 'lucide-react-native';
import { apiFetch } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { fontBody, fontMono } from '../lib/fonts';
import { RCard, REyebrow, RButton, RField, RPill, RProgress } from '../components/ui';
import { PlanScreen } from '../components/PlanShell';
import { Sheet } from '../components/MoneySheets';
import { emitDataChanged } from '../lib/dataEvents';

type Period = {
  period: number; due: string; state: 'paid' | 'due' | 'upcoming'; paidAt: string | null;
  isTurn: boolean; received: boolean; payoutPending: boolean;
};
type Gam = {
  id: string; name: string; frequency: 'monthly' | 'weekly'; amount: number; members: number; turns: number[]; payDay: number;
  currency: string; archived: boolean; paymentPerPeriod: number; pot: number; totalToPay: number; paidCount: number; paidTotal: number;
  remainingToPay: number; overdue: number; nextDue: Period | null; nextTurn: Period | null; finished: boolean; schedule: Period[];
};
type Suggestion = { goalName: string; goalNameAr: string; remaining: number; members: number; amount: number; turn: number; pot: number; fits: boolean | null };
type Acct = { id: string; name: string; kind: string };
type GoalRow = { _id: string; nameEn: string; nameAr: string; savedAmount: number; targetAmount: number };

const n0 = (v: number) => Math.round(v).toLocaleString('en-US');

export default function Gam3yaScreen() {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<Gam[] | null>(null);
  const [tips, setTips] = useState<Suggestion[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState<Partial<Suggestion> | boolean>(false);

  const load = useCallback(async (mode?: 'refresh') => {
    if (mode === 'refresh') setRefreshing(true);
    try {
      const [g, s] = await Promise.all([
        apiFetch<{ data: Gam[] }>('/gam3ya'),
        apiFetch<{ data: Suggestion[] }>('/gam3ya/suggestions').catch(() => ({ data: [] as Suggestion[] })),
      ]);
      setItems(g.data); setTips(s.data);
    } catch { setItems((v) => v ?? []); }
    finally { setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const cur = (g: Gam) => g.currency;

  return (
    <PlanScreen
      title={ar ? 'الجمعيات' : 'Gam3yas'}
      subtitle={ar ? 'ما تدفعه وموعد دورك' : 'What you pay and when you collect'}
      onAdd={() => setCreating(true)}
      refreshing={refreshing}
    >
      <ScreenScroll
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 96, paddingTop: 8, gap: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={tok.gold} colors={[tok.gold]} progressBackgroundColor={tok.surface} />}
      >
        {tips.map((s) => (
          <RCard key={s.goalName} accent padding={14}>
            <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-start' }}>
              <Lightbulb size={18} color={tok.gold} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 14, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>
                  {ar ? `جمعية تناسب هدفك «${s.goalNameAr}»` : `A gam3ya that fits your goal “${s.goalName}”`}
                </Text>
                <Text style={{ marginTop: 4, fontFamily: fontBody(lang), fontSize: 13, lineHeight: 19, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>
                  {ar
                    ? `${s.members} شهور × ${n0(s.amount)} شهرياً، ودورك في الشهر ${s.turn}، فيصلك ${n0(s.pot)} قبل الموعد.${s.fits === false ? ' القسط مرتفع على دخلك.' : ''}`
                    : `${s.members} months at ${n0(s.amount)} a month, your turn in month ${s.turn}: ${n0(s.pot)} lands before the deadline.${s.fits === false ? ' That is a big share of your income.' : ''}`}
                </Text>
                <Pressable onPress={() => setCreating(s)} style={{ marginTop: 8 }}>
                  <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 13, color: tok.gold, textAlign: ar ? 'right' : 'left' }}>{ar ? 'أنشئها كما هي (اقتراح فقط)' : 'Start from this (a suggestion only)'}</Text>
                </Pressable>
              </View>
            </View>
          </RCard>
        ))}

        {items === null ? null : items.length === 0 ? (
          <View style={{ paddingTop: 40, alignItems: 'center', gap: 8 }}>
            <Users size={28} color={tok.muted} />
            <Text style={{ color: tok.bone, fontFamily: fontBody(lang, 'medium'), fontSize: 16 }}>{ar ? 'لا جمعيات بعد.' : 'No gam3yas yet.'}</Text>
            <Text style={{ color: tok.muted, fontFamily: fontBody(lang), fontSize: 13, textAlign: 'center', maxWidth: 280, lineHeight: 19 }}>
              {ar ? 'أضف جمعيتك ليذكّرك سيشات بالقسط ويحسب ما دفعته وما تبقّى.' : 'Add yours and Seshat reminds you each payment and keeps count of what you paid and what is left.'}
            </Text>
            <RButton onPress={() => setCreating(true)}>{ar ? 'أضف جمعية' : 'Add a gam3ya'}</RButton>
          </View>
        ) : items.map((g) => {
          const label = g.overdue > 0
            ? (ar ? `${g.overdue} متأخر` : `${g.overdue} due`)
            : g.finished ? (ar ? 'انتهت' : 'Finished')
            : g.nextDue ? (ar ? `القسط القادم ${g.nextDue.due.slice(0, 10)}` : `Next ${g.nextDue.due.slice(0, 10)}`) : '';
          return (
            <Pressable key={g.id} onPress={() => router.push(`/gam3ya/${g.id}` as never)} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
              <RCard padding={16}>
                <View style={{ flexDirection: ar ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Text style={{ flex: 1, color: tok.bone, fontFamily: fontBody(lang, 'medium'), fontSize: 15, textAlign: ar ? 'right' : 'left' }}>{g.name}</Text>
                  <Text style={{ color: g.overdue > 0 ? tok.alertText : tok.gold, fontFamily: fontMono('regular'), fontSize: 12 }}>{label}</Text>
                </View>
                <Text style={{ marginTop: 4, color: tok.muted, fontFamily: fontMono('regular'), fontSize: 11, textAlign: ar ? 'right' : 'left' }}>
                  {n0(g.paymentPerPeriod)} {cur(g)} / {g.frequency === 'weekly' ? (ar ? 'أسبوع' : 'week') : (ar ? 'شهر' : 'month')} · {ar ? 'القبض' : 'pot'} {n0(g.pot)} {cur(g)}
                </Text>
                <View style={{ marginTop: 10 }}><RProgress value={g.paidCount} max={g.members} color={tok.gold} height={4} /></View>
                <Text style={{ marginTop: 6, color: tok.muted, fontFamily: fontMono('regular'), fontSize: 11, textAlign: ar ? 'right' : 'left' }}>
                  {ar ? `دفعت ${g.paidCount} من ${g.members} · متبقٍّ ${n0(g.remainingToPay)} ${cur(g)}` : `Paid ${g.paidCount} of ${g.members} · ${n0(g.remainingToPay)} ${cur(g)} left to pay`}
                </Text>
              </RCard>
            </Pressable>
          );
        })}
      </ScreenScroll>

      <CreateSheet visible={!!creating} seed={typeof creating === 'object' ? creating : undefined} onClose={() => setCreating(false)} onDone={() => { setCreating(false); void load(); }} />
    </PlanScreen>
  );
}

function CreateSheet({ visible, seed, onClose, onDone }: { visible: boolean; seed?: Partial<Suggestion>; onClose: () => void; onDone: () => void }) {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const [name, setName] = useState('');
  const [freq, setFreq] = useState<'monthly' | 'weekly'>('monthly');
  const [amount, setAmount] = useState('');
  const [members, setMembers] = useState('');
  const [turns, setTurns] = useState('');
  const [payDay, setPayDay] = useState('1');
  const [weekday, setWeekday] = useState(5);
  const [start, setStart] = useState<'this' | 'next'>('this');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setName(seed?.goalName ? (ar ? `جمعية ${seed.goalNameAr ?? ''}` : `${seed.goalName} gam3ya`) : '');
    setFreq('monthly'); setAmount(seed?.amount ? String(seed.amount) : ''); setMembers(seed?.members ? String(seed.members) : '');
    setTurns(seed?.turn ? String(seed.turn) : ''); setPayDay('1'); setWeekday(5); setStart('this');
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const a = parseFloat(amount) || 0;
  const m = Math.trunc(parseFloat(members) || 0);
  const turnList = useMemo(() => Array.from(new Set(turns.split(/[,\s،]+/).map((x) => Math.trunc(Number(x))).filter((x) => x >= 1 && x <= (m || 0)))), [turns, m]);
  const day = Math.trunc(parseFloat(payDay) || 0);
  const ok = !!name.trim() && a > 0 && m >= 2 && turnList.length > 0 && (freq === 'weekly' || (day >= 1 && day <= 31));
  const per = a * Math.max(1, turnList.length);
  const dayNames = ar ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const save = async () => {
    if (!ok) return;
    setBusy(true);
    try {
      const d = new Date();
      if (freq === 'monthly') { d.setUTCDate(1); if (start === 'next') d.setUTCMonth(d.getUTCMonth() + 1); }
      else if (start === 'next') d.setUTCDate(d.getUTCDate() + 7);
      await apiFetch('/gam3ya', { method: 'POST', body: JSON.stringify({ name: name.trim(), frequency: freq, amount: a, members: m, turns: turnList, payDay: freq === 'weekly' ? weekday : day, startDate: d.toISOString().slice(0, 10) }) });
      emitDataChanged(); onDone();
    } catch (err) { Alert.alert(ar ? 'تعذّر الحفظ' : 'Could not save', err instanceof Error ? err.message : undefined); }
    finally { setBusy(false); }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={ar ? 'جمعية جديدة' : 'New gam3ya'}
      hint={ar ? 'أدخل شروط جمعيتك، ويحسب سيشات الباقي.' : 'Enter the terms of yours and Seshat works out the rest.'}>
      <RField label={ar ? 'الاسم' : 'Name'} value={name} onChange={setName} placeholder={ar ? 'مثلاً: جمعية الشغل' : 'e.g. Work gam3ya'} />
      <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 8 }}>
        <RPill active={freq === 'monthly'} onPress={() => setFreq('monthly')}>{ar ? 'شهرية' : 'Monthly'}</RPill>
        <RPill active={freq === 'weekly'} onPress={() => setFreq('weekly')}>{ar ? 'أسبوعية' : 'Weekly'}</RPill>
      </View>
      <RField label={ar ? (freq === 'weekly' ? 'القسط الأسبوعي لكل حصة' : 'القسط الشهري لكل حصة') : `${freq === 'weekly' ? 'Weekly' : 'Monthly'} amount per share`} value={amount} onChange={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" mono />
      <RField label={ar ? 'عدد الأعضاء (الحصص)' : 'Members (shares)'} value={members} onChange={(v) => setMembers(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" mono />
      <RField label={ar ? `دورك (رقم ${freq === 'weekly' ? 'الأسبوع' : 'الشهر'}، أو أكثر مفصولة بفاصلة)` : `Your turn (${freq === 'weekly' ? 'week' : 'month'} number, or several separated by commas)`} value={turns} onChange={(v) => setTurns(v.replace(/[^0-9, ]/g, ''))} keyboardType="numeric" mono />
      {freq === 'monthly' ? (
        <RField label={ar ? 'يوم الدفع من الشهر' : 'Payment day of the month'} value={payDay} onChange={(v) => setPayDay(v.replace(/[^0-9]/g, '').slice(0, 2))} keyboardType="number-pad" mono />
      ) : (
        <View style={{ gap: 8 }}>
          <REyebrow>{ar ? 'يوم الدفع' : 'Payment day'}</REyebrow>
          <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
            {dayNames.map((d, i) => <RPill key={d} active={weekday === i} onPress={() => setWeekday(i)}>{d}</RPill>)}
          </View>
        </View>
      )}
      <View style={{ gap: 8 }}>
        <REyebrow>{ar ? 'بداية الجمعية' : 'Starts'}</REyebrow>
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 8 }}>
          <RPill active={start === 'this'} onPress={() => setStart('this')}>{freq === 'monthly' ? (ar ? 'هذا الشهر' : 'This month') : (ar ? 'هذا الأسبوع' : 'This week')}</RPill>
          <RPill active={start === 'next'} onPress={() => setStart('next')}>{freq === 'monthly' ? (ar ? 'الشهر القادم' : 'Next month') : (ar ? 'الأسبوع القادم' : 'Next week')}</RPill>
        </View>
      </View>
      {ok ? (
        <RCard padding={14}>
          <Text style={{ fontFamily: fontBody(lang), fontSize: 13.5, lineHeight: 20, color: '#E8E6DD', textAlign: ar ? 'right' : 'left' }}>
            {ar
              ? `تدفع ${n0(per)} في كل ${freq === 'weekly' ? 'أسبوع' : 'شهر'}، وتقبض ${n0(a * m)} في دورك. إجمالي ما تدفعه ${n0(per * m)}.`
              : `You pay ${n0(per)} each ${freq === 'weekly' ? 'week' : 'month'} and collect ${n0(a * m)} in your turn. Over the whole circle you pay ${n0(per * m)}.`}
          </Text>
        </RCard>
      ) : null}
      <RButton full onPress={save} disabled={!ok} loading={busy}>{ar ? 'احفظ' : 'Save'}</RButton>
    </Sheet>
  );
}
