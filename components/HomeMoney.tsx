import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Landmark, CreditCard, Wallet, Banknote } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { useAppData } from '../lib/appData';
import { apiFetch, hasToken } from '../lib/api';
import { fontBody, fontMono } from '../lib/fonts';
import { RCard, REyebrow, RAmount } from './ui';
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
    <RCard padding={16} style={{ marginHorizontal: 16, marginBottom: 12 }}>
      <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 14 }}>
        <Col label={ar ? 'صافي اليوم' : 'Today (net)'} value={todayNet} sign />
        <Col label={ar ? 'متوسط اليوم' : 'Per day'} value={-avg} />
        <Col label={ar ? 'إنفاق الشهر' : 'Month spent'} value={-data.current.expense.total} />
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
  if (!cards || cards.length === 0) return null;
  const top = [...cards].sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)).slice(0, 4);

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
