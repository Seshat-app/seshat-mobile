import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Alert, RefreshControl } from 'react-native';
import { ScrollView as ScreenScroll } from '../../components/Scroll';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pencil } from 'lucide-react-native';
import { PlanScreen } from '../../components/PlanShell';
import { RCard, REyebrow, RAmount, RField, RButton } from '../../components/ui';
import { RTxRow, type TxRowData } from '../../components/shell';
import { useI18n } from '../../lib/i18n';
import { useAppData } from '../../lib/appData';
import { apiFetch, hasToken } from '../../lib/api';
import { fontBody, fontHead, fontMono } from '../../lib/fonts';
import { S } from '../../lib/theme';
import type { CardDetail } from '../../lib/cards';
import { CategoryIconByKey } from '../../components/icons';
import { iconKeyForCategory } from '../../lib/categoryMap';

/** /cards/[id] - one card: this month and all-time income/expense, top categories, every operation. */
export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tok, lang } = useI18n();
  const { profile, dataVersion, bumpVersion } = useAppData();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const ar = lang === 'ar';
  const currency = profile?.currency ?? 'EGP';
  const [card, setCard] = useState<CardDetail | null>(null);
  const [txs, setTxs] = useState<TxRowData[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [label, setLabel] = useState('');

  const load = useCallback(async () => {
    if (!id || !(await hasToken())) return;
    try {
      const [c, t] = await Promise.all([
        apiFetch<{ data: CardDetail }>(`/cards/${id}`),
        apiFetch<{ data: TxRowData[] }>(`/transactions?cardId=${id}&limit=100`),
      ]);
      setCard(c.data);
      setTxs(t.data);
    } catch (err) {
      console.warn('card fetch failed', err);
    }
  }, [id]);
  useEffect(() => { void load(); }, [load, dataVersion]);

  const groups = useMemo(() => {
    const m = new Map<string, TxRowData[]>();
    for (const t of txs) {
      const day = new Date(t.date).toLocaleDateString(ar ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
      m.set(day, [...(m.get(day) ?? []), t]);
    }
    return [...m.entries()];
  }, [txs, ar]);

  const saveLabel = async () => {
    try {
      await apiFetch(`/cards/${id}`, { method: 'PATCH', body: JSON.stringify({ label: label.trim() }) });
      setRenaming(false);
      bumpVersion();
      void load();
    } catch { Alert.alert(ar ? 'تعذّر الحفظ' : 'Could not save'); }
  };

  const remove = () => {
    Alert.alert(
      ar ? 'إخفاء البطاقة' : 'Hide this card',
      ar ? 'ستبقى معاملاتها كما هي.' : 'Its transactions stay as they are.',
      [
        { text: ar ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: ar ? 'إخفاء' : 'Hide', style: 'destructive',
          onPress: async () => {
            try { await apiFetch(`/cards/${id}`, { method: 'DELETE' }); bumpVersion(); router.back(); } catch { /* ignore */ }
          },
        },
      ],
    );
  };

  const para = { fontFamily: fontMono('regular'), fontSize: 11, color: tok.muted, textAlign: ar ? 'right' : 'left' } as const;

  return (
    <PlanScreen title={card?.name ?? (ar ? 'بطاقة' : 'Card')} subtitle={card ? `${card.total.count} ${ar ? 'عملية' : 'operations'}` : undefined}>
      <ScreenScroll
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + S[6], paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={tok.gold} />}
      >
        {card && (
          <>
            <RCard padding={16} style={{ marginBottom: 12 }}>
              <REyebrow style={{ marginBottom: 8, textAlign: ar ? 'right' : 'left' }}>{ar ? 'هذا الشهر' : 'This month'}</REyebrow>
              <View style={{ flexDirection: ar ? 'row-reverse' : 'row', justifyContent: 'space-between' }}>
                <Col label={ar ? 'مصروف' : 'Spent'} value={-card.month.expense} currency={currency} />
                <Col label={ar ? 'دخل' : 'Income'} value={card.month.income} currency={currency} sign />
                <Col label={ar ? 'الصافي' : 'Net'} value={card.month.net} currency={currency} sign />
              </View>
              <View style={{ height: 1, backgroundColor: tok.border, marginVertical: 14 }} />
              <REyebrow style={{ marginBottom: 8, textAlign: ar ? 'right' : 'left' }}>{ar ? 'الإجمالي' : 'All time'}</REyebrow>
              <View style={{ flexDirection: ar ? 'row-reverse' : 'row', justifyContent: 'space-between' }}>
                <Col label={ar ? 'مصروف' : 'Spent'} value={-card.total.expense} currency={currency} />
                <Col label={ar ? 'دخل' : 'Income'} value={card.total.income} currency={currency} sign />
                <Col label={ar ? 'الصافي' : 'Net'} value={card.total.net} currency={currency} sign />
              </View>
            </RCard>

            {card.topCategories.length > 0 && (
              <RCard padding={16} style={{ marginBottom: 12 }}>
                <REyebrow style={{ marginBottom: 10, textAlign: ar ? 'right' : 'left' }}>{ar ? 'أكثر ما صُرف عليه' : 'Where it goes'}</REyebrow>
                {card.topCategories.map((c) => {
                  const pct = card.total.expense > 0 ? Math.round((c.total / card.total.expense) * 100) : 0;
                  return (
                    <View key={c.categoryId} style={{ marginBottom: 10 }}>
                      <View style={{ flexDirection: ar ? 'row-reverse' : 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
                          <CategoryIconByKey iconKey={iconKeyForCategory(c)} size={15} color={tok.gold} />
                          <Text style={{ fontFamily: fontBody(lang), fontSize: 13.5, color: tok.bone }}>
                            {ar && c.nameAr ? c.nameAr : c.nameEn}
                          </Text>
                        </View>
                        <Text style={{ fontFamily: fontMono('regular'), fontSize: 12, color: tok.muted }}>
                          {Math.round(c.total).toLocaleString()} {currency} · {pct}%
                        </Text>
                      </View>
                      <View style={{ height: 4, borderRadius: 2, backgroundColor: tok.elevated }}>
                        <View style={{ width: `${Math.max(pct, 3)}%`, height: 4, borderRadius: 2, backgroundColor: tok.gold }} />
                      </View>
                    </View>
                  );
                })}
              </RCard>
            )}

            <RCard padding={16} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fontHead(lang), fontSize: 15, color: tok.bone }}>{ar ? 'العمليات' : 'Operations'}</Text>
                <Pressable onPress={() => { setLabel(card.label ?? ''); setRenaming((r) => !r); }} hitSlop={10} accessibilityLabel={ar ? 'إعادة تسمية' : 'Rename'}>
                  <Pencil size={16} color={tok.muted} />
                </Pressable>
              </View>
              {renaming && (
                <View style={{ marginTop: 12, gap: 10 }}>
                  <RField label={ar ? 'اسم البطاقة' : 'Card name'} value={label} onChange={setLabel} placeholder={card.name} />
                  <RButton full onPress={saveLabel}>{ar ? 'حفظ' : 'Save'}</RButton>
                </View>
              )}
              {groups.length === 0 && <Text style={[para, { marginTop: 12 }]}>{ar ? 'لا عمليات بعد' : 'No operations yet'}</Text>}
              {groups.map(([day, list]) => (
                <View key={day} style={{ marginTop: 12 }}>
                  <Text style={para}>{day}</Text>
                  {list.map((t, i) => <RTxRow key={t._id} tx={t} last={i === list.length - 1} />)}
                </View>
              ))}
            </RCard>

            <Pressable onPress={remove} style={{ alignSelf: 'center', padding: 10 }}>
              <Text style={{ fontFamily: fontBody(lang), fontSize: 12.5, color: tok.muted }}>{ar ? 'إخفاء هذه البطاقة' : 'Hide this card'}</Text>
            </Pressable>
          </>
        )}
      </ScreenScroll>
    </PlanScreen>
  );
}

function Col({ label, value, currency, sign }: { label: string; value: number; currency: string; sign?: boolean }) {
  const { lang } = useI18n();
  return (
    <View style={{ flex: 1 }}>
      <REyebrow style={{ marginBottom: 4, textAlign: lang === 'ar' ? 'right' : 'left' }}>{label}</REyebrow>
      <RAmount value={value} currency={currency} size={16} sign={!!sign} decimals={0} />
    </View>
  );
}
