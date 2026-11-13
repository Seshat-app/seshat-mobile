import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { ScrollView as ScreenScroll } from '../../components/Scroll';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Coins } from 'lucide-react-native';
import { apiFetch } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useInOrg } from '../../lib/appData';
import { PersonalOnly } from '../../components/PersonalOnly';
import { fontBody, fontMono } from '../../lib/fonts';
import { RCard, REyebrow, RButton } from '../../components/ui';
import { PlanScreen } from '../../components/PlanShell';
import { type Holding } from '../../components/SavingsSheets';
import { RangeChart } from '../../components/RangeChart';
import { PriceTargets, ZakatCard } from '../../components/SavingsExtras';
import { trackEvent } from '../../lib/track';

type Overview = {
  currency: string; value: number; cost: number; gain: number; gainPct: number | null; realized: number; stale: boolean;
  allocation: Array<{ type: string; value: number; share: number }>; holdings: Holding[];
};

const n0 = (v: number) => Math.round(v).toLocaleString('en-US');
export const typeName = (t: string, ar: boolean) => ({ gold: ar ? 'ذهب' : 'Gold', currency: ar ? 'عملات' : 'Currency', crypto: ar ? 'كريبتو' : 'Crypto', stock: ar ? 'أسهم' : 'Stocks', other: ar ? 'أخرى' : 'Other' } as Record<string, string>)[t] ?? t;

/** Everything you saved or invested, valued today, with what you gained or lost. */
export default function SavingsScreen() {
  const { tok, lang } = useI18n();
  const inOrg = useInOrg();
  const ar = lang === 'ar';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [ov, setOv] = useState<Overview | null>(null);
  const [alerts, setAlerts] = useState(true);
  useEffect(() => { trackEvent('screen_savings'); }, []);
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
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const up = (ov?.gain ?? 0) >= 0;
  const gainColor = up ? '#6FCF97' : tok.alertText;

  if (inOrg) return <PersonalOnly title={ar ? 'المدخرات' : 'Savings'} what={{ en: 'Gold, dollars and investments are kept in your personal profile, not in an organization.', ar: 'الذهب والدولار والاستثمارات تُحفظ في ملفك الشخصي وليس في منظمة.' }} />;

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
              <RangeChart path="/savings/history/portfolio" refreshKey={`${ov.cost}-${ov.holdings.length}`} />
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

            <PriceTargets />
            <ZakatCard />

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
