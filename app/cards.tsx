import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { ScrollView as ScreenScroll } from '../components/Scroll';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CreditCard, Landmark, Wallet, Banknote, ChevronRight, ArrowLeftRight, Plus } from 'lucide-react-native';
import { PlanScreen } from '../components/PlanShell';
import { RCard, REyebrow, RAmount, RButton } from '../components/ui';
import { MoveMoneySheet, AddSourceSheet } from '../components/MoneySheets';
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
const ICON = { card: CreditCard, account: Landmark, wallet: Wallet, cash: Banknote } as const;

export default function CardsScreen() {
  const { tok, lang } = useI18n();
  const { profile, dataVersion } = useAppData();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const ar = lang === 'ar';
  const currency = profile?.currency ?? 'EGP';
  const [cards, setCards] = useState<CardSummary[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [adding, setAdding] = useState(false);

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

  const totalBalance = (cards ?? []).reduce((a, c) => a + (c.balance ?? 0), 0);

  return (
    <PlanScreen
      title={ar ? 'حساباتي' : 'Accounts'}
      subtitle={ar ? 'بنك ومحفظة وكاش: رصيد كل واحد' : 'Bank, wallet and cash: each balance'}
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
          <RCard accent padding={18} style={{ marginBottom: 14 }}>
            <REyebrow style={{ marginBottom: 8, textAlign: ar ? 'right' : 'left' }}>
              {ar ? 'إجمالي ما تملكه' : 'Total you hold'}
            </REyebrow>
            <RAmount value={totalBalance} currency={currency} size={32} decimals={0} />
            <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 10, marginTop: 16 }}>
              <View style={{ flex: 1 }}>
                <RButton full icon={<ArrowLeftRight size={16} color={tok.void} />} onPress={() => setMoving(true)}>
                  {ar ? 'نقل مبلغ' : 'Move money'}
                </RButton>
              </View>
              <View style={{ flex: 1 }}>
                <RButton full variant="secondary" icon={<Plus size={16} color={tok.bone} />} onPress={() => setAdding(true)}>
                  {ar ? 'حساب جديد' : 'Add account'}
                </RButton>
              </View>
            </View>
          </RCard>
        )}

        {cards && cards.length === 0 && (
          <RCard padding={20}>
            <Text style={{ fontFamily: fontHead(lang), fontSize: 17, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>
              {ar ? 'أين تعيش أموالك؟' : 'Where does your money live?'}
            </Text>
            <Text style={{ marginTop: 8, fontFamily: fontBody(lang), fontSize: 13.5, lineHeight: 20, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>
              {ar ? 'أضف حسابك البنكي أو محفظتك لتتبّع رصيد كل واحد.' : 'Add your bank account or wallet and Seshat tracks the balance of each.'}
            </Text>
            <View style={{ marginTop: 14 }}>
              <RButton full onPress={() => setAdding(true)}>{ar ? 'أضف حساباً' : 'Add an account'}</RButton>
            </View>
          </RCard>
        )}

        {cards && cards.length > 0 && cards.every((c) => c.kind === 'cash') && (
          <Pressable onPress={() => setAdding(true)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, marginBottom: 14 })}>
            <RCard padding={14}>
              <Text style={{ fontFamily: fontBody(lang), fontSize: 13.5, lineHeight: 20, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>
                {ar ? 'لديك الكاش فقط. أضف حسابك البنكي أو محفظتك ليظهر رصيدها هنا.' : 'You only have Cash so far. Add your bank account or wallet to see its balance here.'}
              </Text>
            </RCard>
          </Pressable>
        )}

        {(cards ?? []).length > 0 && (
          <RCard padding={0} style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
            {(cards ?? []).map((c, i, all) => {
              const Icon = ICON[c.kind] ?? CreditCard;
              const kindLabel = c.kind === 'cash' ? (ar ? 'كاش' : 'Cash') : c.kind === 'wallet' ? (ar ? 'محفظة' : 'Wallet') : c.kind === 'account' ? (ar ? 'حساب بنكي' : 'Bank account') : (ar ? 'بطاقة' : 'Card');
              return (
                <Pressable
                  key={c.id}
                  onPress={() => router.push({ pathname: '/cards/[id]', params: { id: c.id } })}
                  style={({ pressed }) => ({
                    flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 12, paddingVertical: 14,
                    borderBottomWidth: i === all.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: tok.border, opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: tok.elevated, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={19} color={tok.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 15.5, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{c.name}</Text>
                    <Text style={{ marginTop: 2, fontFamily: fontMono('regular'), fontSize: 11, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>{kindLabel}</Text>
                  </View>
                  <RAmount value={c.balance ?? 0} currency={currency} size={17} decimals={0} />
                  <ChevronRight size={16} color={tok.muted} style={{ transform: [{ scaleX: ar ? -1 : 1 }] }} />
                </Pressable>
              );
            })}
          </RCard>
        )}
      </ScreenScroll>
      <MoveMoneySheet visible={moving} onClose={() => setMoving(false)} sources={cards ?? []} onDone={() => void load()} />
      <AddSourceSheet visible={adding} onClose={() => setAdding(false)} onDone={() => void load()} />
    </PlanScreen>
  );
}
