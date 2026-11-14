import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Alert, RefreshControl, Switch } from 'react-native';
import { ScrollView as ScreenScroll } from '../../components/Scroll';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pencil, ArrowLeftRight } from 'lucide-react-native';
import { PlanScreen } from '../../components/PlanShell';
import { RCard, REyebrow, RAmount, RField, RButton } from '../../components/ui';
import { RTxRow, type TxRowData } from '../../components/shell';
import { useI18n } from '../../lib/i18n';
import { useAppData, useWorkspace } from '../../lib/appData';
import { apiFetch, hasToken } from '../../lib/api';
import { fontBody, fontHead, fontMono } from '../../lib/fonts';
import { S } from '../../lib/theme';
import type { CardDetail, CardSummary } from '../../lib/cards';
import { MoveMoneySheet, CorrectBalanceSheet, MergeAccountSheet } from '../../components/MoneySheets';
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
  const ws = useWorkspace();
  const currency = profile?.currency ?? 'EGP';
  const [card, setCard] = useState<CardDetail | null>(null);
  const [txs, setTxs] = useState<TxRowData[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [label, setLabel] = useState('');
  const [fixing, setFixing] = useState(false);
  const [merging, setMerging] = useState(false);
  const [sources, setSources] = useState<CardSummary[]>([]);
  const [moving, setMoving] = useState(false);

  const load = useCallback(async () => {
    if (!id || !(await hasToken())) return;
    try {
      const [c, t, all] = await Promise.all([
        apiFetch<{ data: CardDetail }>(`/cards/${id}`),
        apiFetch<{ data: TxRowData[] }>(`/transactions?cardId=${id}&limit=100`),
        apiFetch<{ data: CardSummary[] }>('/cards'),
      ]);
      setSources(all.data);
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
              <REyebrow style={{ marginBottom: 8, textAlign: ar ? 'right' : 'left' }}>{ar ? 'الرصيد الحالي' : 'Balance now'}</REyebrow>
              <RAmount value={card.balance ?? 0} currency={currency} size={30} decimals={0} />
              <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 10, marginTop: 14 }}>
                <View style={{ flex: 1 }}>
                  <RButton full icon={<ArrowLeftRight size={15} color={tok.void} />} onPress={() => setMoving(true)}>
                    {ar ? 'نقل مبلغ' : 'Move money'}
                  </RButton>
                </View>
                <View style={{ flex: 1 }}>
                  <RButton full variant="secondary" onPress={() => setFixing(true)}>
                    {ar ? 'صحّح الرصيد' : 'Correct balance'}
                  </RButton>
                </View>
              </View>
            </RCard>

            {card.reportedBalance != null && Math.abs(card.reportedBalance - (card.balance ?? 0)) >= 1 && (
              <RCard padding={14} style={{ marginBottom: 12 }}>
                <Text style={{ fontFamily: fontBody(lang), fontSize: 13.5, lineHeight: 20, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>
                  {ar
                    ? `آخر رسالة من البنك تقول إن رصيده ${Math.round(card.reportedBalance).toLocaleString()} ${currency}، وسيشات يحسب ${Math.round(card.balance ?? 0).toLocaleString()}.`
                    : `Your last bank message says this holds ${Math.round(card.reportedBalance).toLocaleString()} ${currency}; Seshat has ${Math.round(card.balance ?? 0).toLocaleString()}.`}
                </Text>
                <View style={{ marginTop: 10 }}>
                  <RButton
                    onPress={async () => {
                      await apiFetch(`/cards/${id}`, { method: 'PATCH', body: JSON.stringify({ currentBalance: card.reportedBalance }) });
                      bumpVersion();
                      void load();
                    }}
                  >
                    {ar ? 'استخدم رصيد البنك' : "Use the bank's balance"}
                  </RButton>
                </View>
              </RCard>
            )}

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

            {ws.inOrg && card.kind !== 'cash' && card.mine ? (
              <RCard padding={16} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fontHead(lang), fontSize: 15, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{ar ? 'حساب خاص' : 'Private account'}</Text>
                    <Text style={[para, { marginTop: 3 }]}>{ar ? 'أنت وحدك ترى هذا الحساب وما يُسجَّل عليه. لا يراه بقية أفراد العائلة.' : 'Only you see this account and what is logged on it. Nobody else in the household does.'}</Text>
                  </View>
                  <Switch
                    value={card.visibility === 'private'}
                    onValueChange={async (on) => {
                      try { await apiFetch(`/cards/${id}`, { method: 'PATCH', body: JSON.stringify({ visibility: on ? 'private' : 'shared' }) }); await load(); }
                      catch (e) { Alert.alert(ar ? 'تعذّر' : 'Could not change it', e instanceof Error ? e.message : String(e)); }
                    }}
                    trackColor={{ true: tok.gold, false: tok.border }}
                  />
                </View>
              </RCard>
            ) : null}

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

            {card.kind !== 'cash' && (
              <Pressable onPress={() => setMerging(true)} style={{ alignSelf: 'center', padding: 10 }}>
                <Text style={{ fontFamily: fontBody(lang), fontSize: 13, color: tok.gold }}>{ar ? 'هل هو نفس حساب آخر؟ ادمجهما' : 'Same account as another one? Merge them'}</Text>
              </Pressable>
            )}
            <Pressable onPress={remove} style={{ alignSelf: 'center', padding: 10 }}>
              <Text style={{ fontFamily: fontBody(lang), fontSize: 12.5, color: tok.muted }}>{ar ? 'إخفاء هذه البطاقة' : 'Hide this card'}</Text>
            </Pressable>
          </>
        )}
      </ScreenScroll>
      <MergeAccountSheet visible={merging} onClose={() => setMerging(false)} account={card ? { id: card.id, name: card.name } : null} others={sources} onDone={() => { bumpVersion(); router.back(); }} />
      <CorrectBalanceSheet visible={fixing} onClose={() => setFixing(false)} account={card ? { id: card.id, name: card.name, balance: card.balance } : null} onDone={() => void load()} />
      <MoveMoneySheet visible={moving} onClose={() => setMoving(false)} sources={sources} initialFrom={id} onDone={() => void load()} />
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
