import { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { ScrollView as ScreenScroll } from '../../components/Scroll';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { fontBody, fontMono } from '../../lib/fonts';
import { RCard, REyebrow, RButton, RField } from '../../components/ui';
import { PlanScreen } from '../../components/PlanShell';
import { TradeSheet, type Holding } from '../../components/SavingsSheets';
import { RPill } from '../../components/ui';
import { emitDataChanged } from '../../lib/dataEvents';

const n0 = (v: number) => Math.round(v).toLocaleString('en-US');

/** One holding: what it is worth, what you gained or lost, every buy and sell, and the actions. */
export default function HoldingScreen() {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [h, setH] = useState<Holding | null | undefined>(undefined);
  const [trade, setTrade] = useState<'buy' | 'sell' | null>(null);
  const [price, setPrice] = useState('');
  const [premium, setPremium] = useState('');
  const [goals, setGoals] = useState<Array<{ _id: string; nameEn: string; nameAr: string; savedAmount: number; targetAmount: number }>>([]);

  const load = useCallback(async () => {
    try { const r = await apiFetch<{ data: Holding }>(`/savings/${id}`); setH(r.data); setPremium(String(r.data.premiumPct || '')); }
    catch { setH(null); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { apiFetch<{ data: typeof goals }>('/goals').then((r) => setGoals(r.data)).catch(() => {}); }, []);

  if (h === undefined) return <PlanScreen title="">{null}</PlanScreen>;
  if (h === null) return <PlanScreen title={ar ? 'ادخار' : 'Saving'}><View style={{ padding: 24, alignItems: 'center' }}><Text style={{ color: tok.muted }}>{ar ? 'غير موجود.' : 'Not found.'}</Text></View></PlanScreen>;

  const g = h.gain ?? 0;
  const patch = async (body: object) => {
    try { await apiFetch(`/savings/${h.id}`, { method: 'PATCH', body: JSON.stringify(body) }); emitDataChanged(); await load(); }
    catch (err) { Alert.alert(ar ? 'تعذّر الحفظ' : 'Could not save', err instanceof Error ? err.message : undefined); }
  };
  const row = (label: string, value: string, color?: string) => (
    <View key={label} style={{ flexDirection: ar ? 'row-reverse' : 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontFamily: fontBody(lang), fontSize: 13, color: tok.muted }}>{label}</Text>
      <Text style={{ fontFamily: fontMono('regular'), fontSize: 13, color: color ?? tok.bone }}>{value}</Text>
    </View>
  );

  return (
    <PlanScreen title={h.name} subtitle={`${h.quantity} ${h.unit}`}>
      <ScreenScroll contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40, paddingTop: 8, gap: 12 }} showsVerticalScrollIndicator={false}>
        <RCard accent padding={18}>
          <REyebrow style={{ marginBottom: 6, textAlign: ar ? 'right' : 'left' }}>{ar ? 'القيمة الآن' : 'Worth now'}</REyebrow>
          <Text style={{ fontFamily: fontMono('medium'), fontSize: 28, color: tok.bone, textAlign: ar ? 'right' : 'left', writingDirection: 'ltr' }}>{h.value !== null ? n0(h.value) : '—'} <Text style={{ fontSize: 14, color: tok.muted }}>{h.currency}</Text></Text>
          {h.gain !== null && <Text style={{ marginTop: 6, fontFamily: fontMono('regular'), fontSize: 15, color: g >= 0 ? '#6FCF97' : tok.alertText, textAlign: ar ? 'right' : 'left' }}>
            {g >= 0 ? (ar ? 'مكسب ' : 'Gain ') : (ar ? 'خسارة ' : 'Loss ')}{g >= 0 ? '+' : '−'}{n0(Math.abs(g))}{h.gainPct !== null ? `  (${g >= 0 ? '+' : '−'}${Math.abs(h.gainPct)}%)` : ''}</Text>}
          <View style={{ marginTop: 14, gap: 6 }}>
            {row(ar ? 'سعر الوحدة اليوم' : 'Price today', h.unitPrice !== null ? `${n0(h.unitPrice)} ${h.currency}${h.priceSource === 'manual' ? (ar ? ' (يدوي)' : ' (manual)') : ''}` : '—')}
            {row(h.making > 0 ? (ar ? 'متوسط سعر شرائك (بدون المصنعية)' : 'Your average price (without masna3ya)') : (ar ? 'متوسط سعر شرائك' : 'Your average price'), `${n0(h.making > 0 ? h.avgPriceNoFees : h.avgPrice)} ${h.currency}`)}
            {row(ar ? 'ما دفعته' : 'You put in', `${n0(h.cost)} ${h.currency}`)}
            {h.making > 0 ? row(ar ? 'منها مصنعية (لا تعود عند البيع)' : 'Of it, masna3ya (not recovered when you sell)', `${n0(h.making)} ${h.currency}`) : null}
            {h.realized !== 0 && row(ar ? 'ربح محقَّق من البيع' : 'Realised from sales', `${h.realized >= 0 ? '+' : '−'}${n0(Math.abs(h.realized))}`, h.realized >= 0 ? '#6FCF97' : tok.alertText)}
          </View>
        </RCard>

        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><RButton full onPress={() => setTrade('buy')}>{ar ? 'اشترِ المزيد' : 'Buy more'}</RButton></View>
          <View style={{ flex: 1 }}><RButton full variant="ghost" onPress={() => setTrade('sell')} disabled={h.quantity <= 0}>{ar ? 'بِع' : 'Sell'}</RButton></View>
        </View>

        {h.type === 'gold' && (
          <RCard padding={16}>
            <RField label={ar ? 'زيادة سعر المحل عن السعر العالمي %' : 'Shop price above the world price, %'} value={premium} onChange={(v) => setPremium(v.replace(/[^0-9.\-]/g, ''))} keyboardType="decimal-pad" mono />
            <View style={{ marginTop: 10 }}><RButton full variant="ghost" onPress={() => patch({ premiumPct: parseFloat(premium) || 0 })}>{ar ? 'احفظ' : 'Save'}</RButton></View>
          </RCard>
        )}
        {h.type === 'other' && (
          <RCard padding={16}>
            <RField label={ar ? 'سعر الوحدة الحالي' : 'Current price per unit'} value={price} onChange={(v) => setPrice(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" mono />
            <View style={{ marginTop: 10 }}><RButton full variant="ghost" disabled={!(parseFloat(price) > 0)} onPress={() => { void patch({ manualPrice: parseFloat(price) }); setPrice(''); }}>{ar ? 'حدّث السعر' : 'Update the price'}</RButton></View>
          </RCard>
        )}

        {goals.length > 0 && (
          <RCard padding={16}>
            <REyebrow style={{ marginBottom: 10, textAlign: ar ? 'right' : 'left' }}>{ar ? 'يُحتسب لهدف' : 'Counts toward a goal'}</REyebrow>
            <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
              <RPill active={!(h as Holding & { goalId?: string | null }).goalId} onPress={() => patch({ goalId: '' })}>{ar ? 'لا' : 'None'}</RPill>
              {goals.map((g) => <RPill key={g._id} active={(h as Holding & { goalId?: string | null }).goalId === g._id} onPress={() => patch({ goalId: g._id })}>{ar ? g.nameAr : g.nameEn}</RPill>)}
            </View>
          </RCard>
        )}

        <RCard padding={16}>
          <REyebrow style={{ marginBottom: 10, textAlign: ar ? 'right' : 'left' }}>{ar ? 'الحركات' : 'Buys and sells'}</REyebrow>
          <View style={{ gap: 8 }}>
            {[...h.lots].reverse().map((l, i) => (
              <View key={i} style={{ flexDirection: ar ? 'row-reverse' : 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fontMono('regular'), fontSize: 12, color: tok.muted }}>{l.date.slice(0, 10)}</Text>
                <Text style={{ fontFamily: fontMono('regular'), fontSize: 12, color: l.kind === 'buy' ? tok.bone : '#6FCF97' }}>
                  {l.kind === 'buy' ? (ar ? 'شراء' : 'Bought') : (ar ? 'بيع' : 'Sold')} {l.quantity} {h.unit} @ {n0(l.unitPrice)}{l.fees > 0 ? ` + ${n0(l.fees)} ${h.type === 'gold' && l.kind === 'buy' ? (ar ? 'مصنعية' : 'masna3ya') : (ar ? 'رسوم' : 'fees')}` : ''}
                </Text>
              </View>
            ))}
          </View>
        </RCard>

        <RButton full variant="ghost" onPress={() => Alert.alert(ar ? 'حذف هذا الادخار؟' : 'Delete this saving?', ar ? 'يُحذف أيضاً ما سُجّل من حركات حسابك له.' : 'The account moves it made are removed too.', [
          { text: ar ? 'إلغاء' : 'Cancel', style: 'cancel' },
          { text: ar ? 'حذف' : 'Delete', style: 'destructive', onPress: async () => { await apiFetch(`/savings/${h.id}`, { method: 'DELETE' }).catch(() => {}); emitDataChanged(); router.back(); } },
        ])}>{ar ? 'حذف' : 'Delete'}</RButton>
      </ScreenScroll>
      <TradeSheet visible={trade !== null} kind={trade ?? 'buy'} holding={h} onClose={() => setTrade(null)} onDone={() => { setTrade(null); void load(); }} />
    </PlanScreen>
  );
}
