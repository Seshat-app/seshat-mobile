import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { ScrollView as ScreenScroll } from '../components/Scroll';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CreditCard, Landmark, Wallet, ChevronRight } from 'lucide-react-native';
import { PlanScreen } from '../components/PlanShell';
import { RCard, REyebrow, RAmount } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { useAppData } from '../lib/appData';
import { apiFetch, hasToken } from '../lib/api';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { S } from '../lib/theme';
import type { CardSummary } from '../lib/cards';

/**
 * /cards - every card / account Seshat has seen in captured bank messages (or that
 * was added by hand), with what went out and came in this month and overall.
 */
const ICON = { card: CreditCard, account: Landmark, wallet: Wallet } as const;

export default function CardsScreen() {
  const { tok, lang } = useI18n();
  const { profile, dataVersion } = useAppData();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const ar = lang === 'ar';
  const currency = profile?.currency ?? 'EGP';
  const [cards, setCards] = useState<CardSummary[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!(await hasToken())) return;
    try {
      const r = await apiFetch<{ data: CardSummary[] }>('/cards');
      setCards(r.data);
    } catch (err) {
      console.warn('cards fetch failed', err);
      setCards((c) => c ?? []);
    }
  }, []);
  useEffect(() => { void load(); }, [load, dataVersion]);

  const monthSpent = (cards ?? []).reduce((a, c) => a + c.month.expense, 0);
  const monthIncome = (cards ?? []).reduce((a, c) => a + c.month.income, 0);

  return (
    <PlanScreen
      title={ar ? 'البطاقات' : 'Cards'}
      subtitle={ar ? 'كل بطاقة وحساب على حدة' : 'Each card and account on its own'}
      refreshing={refreshing}
    >
      <ScreenScroll
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + S[6], paddingTop: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
            tintColor={tok.gold}
          />
        }
      >
        {cards && cards.length > 0 && (
          <RCard padding={16} style={{ marginBottom: 14 }}>
            <REyebrow style={{ marginBottom: 8, textAlign: ar ? 'right' : 'left' }}>
              {ar ? 'هذا الشهر عبر كل البطاقات' : 'This month, all cards'}
            </REyebrow>
            <View style={{ flexDirection: ar ? 'row-reverse' : 'row', justifyContent: 'space-between' }}>
              <Stat label={ar ? 'مصروف' : 'Spent'} value={-monthSpent} currency={currency} />
              <Stat label={ar ? 'دخل' : 'Income'} value={monthIncome} currency={currency} sign />
            </View>
          </RCard>
        )}

        {cards && cards.length === 0 && (
          <RCard padding={20}>
            <Text style={{ fontFamily: fontHead(lang), fontSize: 16, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>
              {ar ? 'لا توجد بطاقات بعد' : 'No cards yet'}
            </Text>
            <Text style={{ marginTop: 8, fontFamily: fontBody(lang), fontSize: 13.5, lineHeight: 20, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>
              {ar
                ? 'تظهر البطاقات تلقائياً عندما تصل رسائل البنك المسجَّلة بالرصد التلقائي، وكل بطاقة بآخر أرقامها. فعّل الرصد من الملف الشخصي.'
                : 'Cards appear on their own once bank messages are captured, each by its last digits. Turn on auto-capture from Profile.'}
            </Text>
          </RCard>
        )}

        {(cards ?? []).map((c) => {
          const Icon = ICON[c.kind] ?? CreditCard;
          return (
            <Pressable
              key={c.id}
              onPress={() => router.push({ pathname: '/cards/[id]', params: { id: c.id } })}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, marginBottom: 12 })}
            >
              <RCard padding={16}>
                <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{
                    width: 40, height: 40, borderRadius: 12, backgroundColor: tok.elevated,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={20} color={tok.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontFamily: fontHead(lang), fontSize: 16, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>
                      {c.name}
                    </Text>
                    <Text style={{ marginTop: 2, fontFamily: fontMono('regular'), fontSize: 11, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>
                      {c.total.count} {ar ? 'عملية' : c.total.count === 1 ? 'operation' : 'operations'}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={tok.muted} style={{ transform: [{ scaleX: ar ? -1 : 1 }] }} />
                </View>
                <View style={{ height: 14 }} />
                <View style={{ flexDirection: ar ? 'row-reverse' : 'row', justifyContent: 'space-between' }}>
                  <Stat label={ar ? 'مصروف هذا الشهر' : 'Spent this month'} value={-c.month.expense} currency={currency} />
                  <Stat label={ar ? 'دخل هذا الشهر' : 'In this month'} value={c.month.income} currency={currency} sign />
                </View>
                <Text style={{ marginTop: 12, fontFamily: fontMono('regular'), fontSize: 11, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>
                  {ar ? 'الإجمالي: ' : 'All time: '}
                  {`−${Math.round(c.total.expense).toLocaleString()} / +${Math.round(c.total.income).toLocaleString()} ${currency}`}
                </Text>
              </RCard>
            </Pressable>
          );
        })}
      </ScreenScroll>
    </PlanScreen>
  );
}

function Stat({ label, value, currency, sign }: { label: string; value: number; currency: string; sign?: boolean }) {
  const { lang } = useI18n();
  return (
    <View style={{ flex: 1 }}>
      <REyebrow style={{ marginBottom: 4, textAlign: lang === 'ar' ? 'right' : 'left' }}>{label}</REyebrow>
      <RAmount value={value} currency={currency} size={18} sign={!!sign} decimals={0} />
    </View>
  );
}
