import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { ScrollView as ScreenScroll } from '../components/Scroll';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline, Line } from 'react-native-svg';
import { Coins } from 'lucide-react-native';
import { apiFetch } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { fontBody, fontMono } from '../lib/fonts';
import { RCard, REyebrow, RButton, RPill } from '../components/ui';
import { PlanScreen } from '../components/PlanShell';
import { type Holding } from '../components/SavingsSheets';

type Overview = {
  currency: string; value: number; cost: number; gain: number; gainPct: number | null; realized: number; stale: boolean;
  allocation: Array<{ type: string; value: number; share: number }>; holdings: Holding[];
};
type Point = { date: string; value: number; cost: number };

const n0 = (v: number) => Math.round(v).toLocaleString('en-US');
/** "12 Aug", with the year when it is not this year. */
const shortDate = (iso: string, ar: boolean) => {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(ar ? 'ar-EG' : 'en-GB', d.getFullYear() === new Date().getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
};
export const typeName = (t: string, ar: boolean) => ({ gold: ar ? 'ذهب' : 'Gold', currency: ar ? 'عملات' : 'Currency', crypto: ar ? 'كريبتو' : 'Crypto', stock: ar ? 'أسهم' : 'Stocks', other: ar ? 'أخرى' : 'Other' } as Record<string, string>)[t] ?? t;

/** Everything you saved or invested, valued today, with what you gained or lost. */
export default function SavingsScreen() {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [ov, setOv] = useState<Overview | null>(null);
  const [pts, setPts] = useState<Point[]>([]);
  const [range, setRange] = useState<'1m' | '3m' | '6m' | '1y' | 'all'>('3m');
  const [alerts, setAlerts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (mode?: 'refresh') => {
    if (mode === 'refresh') setRefreshing(true);
    try {
      const r = await apiFetch<{ data: Overview }>('/savings');
      setOv(r.data);
    } catch { setOv((v) => v); }
    finally { setRefreshing(false); }
  }, []);
  useEffect(() => { apiFetch<{ data: { savingsAlerts?: boolean } }>('/me').then((r) => setAlerts(r.data.savingsAlerts !== false)).catch(() => {}); }, []);
  useEffect(() => { void load(); }, [load]);
  // The chart follows the range chosen above it; it reloads when the range or what you hold changes.
  useEffect(() => {
    let alive = true;
    apiFetch<{ data: { points: Point[] } }>(`/savings/history/portfolio?range=${range}`).then((h) => { if (alive) setPts(h.data.points); }).catch(() => { if (alive) setPts([]); });
    return () => { alive = false; };
  }, [range, ov?.cost, ov?.holdings.length]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const up = (ov?.gain ?? 0) >= 0;
  const gainColor = up ? '#6FCF97' : tok.alertText;
  const W = 300; const H = 70;
  const line = (() => {
    if (pts.length < 2) return null;
    const vals = pts.flatMap((p) => [p.value, p.cost]);
    const lo = Math.min(...vals); const hi = Math.max(...vals); const span = Math.max(1, hi - lo);
    const xy = (v: number, i: number) => `${(i / (pts.length - 1)) * W},${H - ((v - lo) / span) * (H - 8) - 4}`;
    return { value: pts.map((p, i) => xy(p.value, i)).join(' '), cost: pts.map((p, i) => xy(p.cost, i)).join(' ') };
  })();

  return (
    <PlanScreen title={ar ? 'المدخرات' : 'Savings'} subtitle={ar ? 'ما اشتريته وكم كسبت أو خسرت' : 'What you bought, and what it gained or lost'} onAdd={ov && ov.holdings.length === 0 ? undefined : () => router.push('/savings/new' as never)} refreshing={refreshing}>
      <ScreenScroll contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 96, paddingTop: 8, gap: 12 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={tok.gold} colors={[tok.gold]} progressBackgroundColor={tok.surface} />}>
        {ov && ov.holdings.length === 0 ? (
          <View style={{ paddingTop: 40, alignItems: 'center', gap: 8 }}>
            <Coins size={28} color={tok.muted} />
            <Text style={{ color: tok.bone, fontFamily: fontBody(lang, 'medium'), fontSize: 16 }}>{ar ? 'لا مدخرات بعد.' : 'Nothing saved here yet.'}</Text>
            <Text style={{ color: tok.muted, fontFamily: fontBody(lang), fontSize: 13, textAlign: 'center', maxWidth: 290, lineHeight: 19 }}>
              {ar ? 'اشتريت ذهباً أو دولاراً أو استثمرت في شيء؟ أضفه ليتتبّع سيشات قيمته ومكسبك أو خسارتك.' : 'Bought gold or dollars, or invested in something? Add it and Seshat tracks its value and what you gained or lost.'}
            </Text>
            <View style={{ marginTop: 14, alignSelf: 'center' }}><RButton onPress={() => router.push('/savings/new' as never)}>{ar ? 'أضف ادخاراً' : 'Add a saving'}</RButton></View>
          </View>
        ) : ov ? (
          <>
            <RCard accent padding={18}>
              <REyebrow style={{ marginBottom: 6, textAlign: ar ? 'right' : 'left' }}>{ar ? 'القيمة الآن' : 'Worth now'}</REyebrow>
              <Text style={{ fontFamily: fontMono('medium'), fontSize: 30, color: tok.bone, textAlign: ar ? 'right' : 'left', writingDirection: 'ltr' }}>{n0(ov.value)} <Text style={{ fontSize: 14, color: tok.muted }}>{ov.currency}</Text></Text>
              <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 16, marginTop: 10 }}>
                <View><REyebrow>{ar ? 'المستثمَر' : 'Invested'}</REyebrow><Text style={{ fontFamily: fontMono('regular'), fontSize: 14, color: tok.bone }}>{n0(ov.cost)}</Text></View>
                <View><REyebrow>{up ? (ar ? 'مكسب' : 'Gain') : (ar ? 'خسارة' : 'Loss')}</REyebrow>
                  <Text style={{ fontFamily: fontMono('regular'), fontSize: 14, color: gainColor }}>{up ? '+' : '−'}{n0(Math.abs(ov.gain))}{ov.gainPct !== null ? `  (${up ? '+' : '−'}${Math.abs(ov.gainPct)}%)` : ''}</Text></View>
                {ov.realized !== 0 && <View><REyebrow>{ar ? 'محقَّق' : 'Realised'}</REyebrow><Text style={{ fontFamily: fontMono('regular'), fontSize: 14, color: ov.realized >= 0 ? '#6FCF97' : tok.alertText }}>{ov.realized >= 0 ? '+' : '−'}{n0(Math.abs(ov.realized))}</Text></View>}
              </View>
              <View style={{ marginTop: 14 }}>
                <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 6, marginBottom: 10 }}>
                  {(['1m', '3m', '6m', '1y', 'all'] as const).map((r) => (
                    <RPill key={r} active={range === r} onPress={() => setRange(r)}>{({ '1m': ar ? 'شهر' : '1M', '3m': ar ? '٣ أشهر' : '3M', '6m': ar ? '٦ أشهر' : '6M', '1y': ar ? 'سنة' : '1Y', all: ar ? 'الكل' : 'All' })[r]}</RPill>
                  ))}
                </View>
                {line ? (
                  <>
                    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                      <Line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke={tok.border} strokeWidth="1" />
                      <Polyline points={line.cost} fill="none" stroke={tok.muted} strokeWidth="1.5" strokeDasharray="4 4" />
                      <Polyline points={line.value} fill="none" stroke={tok.gold} strokeWidth="2.2" />
                    </Svg>
                    <View style={{ flexDirection: ar ? 'row-reverse' : 'row', justifyContent: 'space-between', marginTop: 4 }}>
                      <Text style={{ fontFamily: fontMono('regular'), fontSize: 10, color: tok.muted }}>{shortDate(pts[0].date, ar)}</Text>
                      <Text style={{ fontFamily: fontMono('regular'), fontSize: 10, color: tok.muted }}>{ar ? 'اليوم' : 'Today'}</Text>
                    </View>
                    <Text style={{ fontFamily: fontBody(lang), fontSize: 11, color: tok.muted, marginTop: 6, textAlign: ar ? 'right' : 'left' }}>{ar ? 'الخط الذهبي قيمتها، والمنقّط ما دفعت.' : 'Gold line is what it is worth, dashed is what you put in.'}</Text>
                  </>
                ) : (
                  <Text style={{ fontFamily: fontBody(lang), fontSize: 12, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>{ar ? 'لا بيانات كافية لهذه الفترة بعد.' : 'Not enough history for this period yet.'}</Text>
                )}
              </View>
              {ov.stale && <Text style={{ marginTop: 8, fontFamily: fontBody(lang), fontSize: 12, color: tok.alertText, textAlign: ar ? 'right' : 'left' }}>{ar ? 'بعض الأسعار غير متاحة الآن، ويُحسب ما دفعته.' : 'Some prices are not available right now; those are counted at what you paid.'}</Text>}
            </RCard>

            {ov.allocation.length > 1 && (
              <RCard padding={16}>
                <REyebrow style={{ marginBottom: 10, textAlign: ar ? 'right' : 'left' }}>{ar ? 'التوزيع' : 'Where it sits'}</REyebrow>
                <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: tok.elevated }}>
                  {ov.allocation.map((a, i) => <View key={a.type} style={{ width: `${a.share}%`, backgroundColor: ['#C9A84C', '#8FB8DE', '#B58FDE', '#9C9A92'][i % 4] }} />)}
                </View>
                <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 }}>
                  {ov.allocation.map((a, i) => <Text key={a.type} style={{ fontFamily: fontMono('regular'), fontSize: 11, color: tok.muted }}><Text style={{ color: ['#C9A84C', '#8FB8DE', '#B58FDE', '#9C9A92'][i % 4] }}>● </Text>{typeName(a.type, ar)} {a.share}%</Text>)}
                </View>
              </RCard>
            )}

            <RCard padding={14}>
              <Pressable onPress={() => { const next = !alerts; setAlerts(next); apiFetch('/me', { method: 'PATCH', body: JSON.stringify({ savingsAlerts: next }) }).catch(() => setAlerts(!next)); }}
                style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fontBody(lang, 'medium'), fontSize: 14, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{ar ? 'تنبيه أسبوعي عند تغيّر مدخراتك' : 'Weekly alert when your savings move'}</Text>
                  <Text style={{ fontFamily: fontBody(lang), fontSize: 12, color: tok.muted, marginTop: 2, textAlign: ar ? 'right' : 'left' }}>{ar ? 'عند تغيّر القيمة ٥٪ أو أكثر' : 'When the total moves 5% or more'}</Text>
                </View>
                <View style={{ width: 46, height: 26, borderRadius: 13, backgroundColor: alerts ? tok.gold : tok.elevated, padding: 3, alignItems: alerts ? 'flex-end' : 'flex-start' }}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: alerts ? tok.void : tok.muted }} />
                </View>
              </Pressable>
            </RCard>

            {ov.holdings.filter((h) => h.quantity > 0).map((h) => {
              const g = h.gain ?? 0;
              return (
                <Pressable key={h.id} onPress={() => router.push(`/savings/${h.id}` as never)} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
                  <RCard padding={16}>
                    <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                      <Text style={{ flex: 1, fontFamily: fontBody(lang, 'medium'), fontSize: 15, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{h.name}</Text>
                      <Text style={{ fontFamily: fontMono('regular'), fontSize: 14, color: tok.bone }}>{h.value !== null ? n0(h.value) : '—'} {ov.currency}</Text>
                    </View>
                    <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <Text style={{ fontFamily: fontMono('regular'), fontSize: 11, color: tok.muted }}>{h.quantity} {h.unit}</Text>
                      {h.gain !== null && <Text style={{ fontFamily: fontMono('regular'), fontSize: 12, color: g >= 0 ? '#6FCF97' : tok.alertText }}>{g >= 0 ? '+' : '−'}{n0(Math.abs(g))}{h.gainPct !== null ? `  (${g >= 0 ? '+' : '−'}${Math.abs(h.gainPct)}%)` : ''}</Text>}
                    </View>
                  </RCard>
                </Pressable>
              );
            })}
          </>
        ) : null}
      </ScreenScroll>
    </PlanScreen>
  );
}
