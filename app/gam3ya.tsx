import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
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
import type { Suggestion } from '../components/Gam3yaForm';
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
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const cur = (g: Gam) => g.currency;

  return (
    <PlanScreen
      title={ar ? 'الجمعيات' : 'Gam3yas'}
      subtitle={ar ? 'ما تدفعه وموعد دورك' : 'What you pay and when you collect'}
      onAdd={items !== null && items.length === 0 ? undefined : () => router.push('/gam3ya/new' as never)}
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
                  {s.extendsDeadline
                    ? (ar ? `جمعية يتحمّلها دخلك لهدف «${s.goalNameAr}»` : `A gam3ya your income can carry for “${s.goalName}”`)
                    : (ar ? `جمعية تناسب هدفك «${s.goalNameAr}»` : `A gam3ya that fits your goal “${s.goalName}”`)}
                </Text>
                <Text style={{ marginTop: 4, fontFamily: fontBody(lang), fontSize: 13, lineHeight: 19, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>
                  {ar
                    ? `${s.members} شهراً × ${n0(s.amount)} شهرياً، ودورك في الشهر ${s.turn}، فيصلك ${n0(s.pot)}.${s.extendsDeadline ? ` تنتهي نحو ${new Date(s.endsOn ?? '').toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}، أي بعد موعد هدفك، فأجّل موعد الهدف ليناسبها.` : ' يصلك قبل الموعد.'}`
                    : `${s.members} months at ${n0(s.amount)} a month, your turn in month ${s.turn}: ${n0(s.pot)}.${s.extendsDeadline ? ` It ends around ${new Date(s.endsOn ?? '').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}, after your goal's deadline, so move the goal's deadline to match.` : ' It lands before the deadline.'}`}
                </Text>
                <Pressable onPress={() => router.push({ pathname: '/gam3ya/new', params: { goal: s.goalName, goalAr: s.goalNameAr, amount: String(s.amount), members: String(s.members), turn: String(s.turn) } } as never)} style={{ marginTop: 8 }}>
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
            <View style={{ marginTop: 14, alignSelf: 'center' }}><RButton onPress={() => router.push('/gam3ya/new' as never)}>{ar ? 'أضف جمعية' : 'Add a gam3ya'}</RButton></View>
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

    </PlanScreen>
  );
}
