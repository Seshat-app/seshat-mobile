import { useCallback, useEffect, useState } from 'react';
import { View, Text, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView as ScreenScroll } from './Scroll';
import { ScreenAtmosphere } from './ScreenAtmosphere';
import { RHomeHeader } from './shell';
import { RCard, REyebrow, RAmount, RProgress } from './ui';
import { useI18n } from '../lib/i18n';
import { useAppData } from '../lib/appData';
import { apiFetch } from '../lib/api';
import { fontBody, fontMono } from '../lib/fonts';
import { myAllowance, type AllowanceStatus } from '../lib/orgExtras';

type Tx = { _id: string; amount: number; description?: string; date: string; type: 'income' | 'expense'; categoryId?: { nameEn?: string; nameAr?: string; emoji?: string } | string };
type Goal = { _id: string; nameEn: string; nameAr?: string; targetAmount: number; progressAmount?: number; savedAmount: number; currency: string };

/**
 * What a child sees in a family workspace: what they spent this month, their own latest entries and the family goals.
 * Everything else about the household stays with the adults. The + button logs spending.
 */
export function ChildHome() {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const insets = useSafeAreaInsets();
  const { profile, dataVersion, activeLedgerId } = useAppData();
  const [allowance, setAllowance] = useState<AllowanceStatus | null>(null);
  const [txs, setTxs] = useState<Tx[] | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const currency = profile?.currency ?? 'EGP';

  const load = useCallback(async () => {
    try {
      const [t, g] = await Promise.all([
        apiFetch<{ data: Tx[] }>('/transactions?limit=100'),
        apiFetch<{ data: Goal[] }>('/goals').catch(() => ({ data: [] as Goal[] })),
      ]);
      setTxs(t.data); setGoals(g.data);
      if (activeLedgerId?.startsWith('o_')) setAllowance(await myAllowance(activeLedgerId.slice(2)).catch(() => null));
    } catch { setTxs((v) => v ?? []); }
    finally { setRefreshing(false); }
  }, [activeLedgerId]);
  useEffect(() => { void load(); }, [load, dataVersion]);

  const now = new Date();
  const month = (txs ?? []).filter((t) => { const d = new Date(t.date); return t.type === 'expense' && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); });
  const spent = month.reduce((a, t) => a + t.amount, 0);
  const userName = (ar ? (profile?.displayNameAr || profile?.displayName) : profile?.displayName) || (ar ? 'صديقي' : 'there');
  const catName = (t: Tx) => (typeof t.categoryId === 'object' && t.categoryId ? (ar ? t.categoryId.nameAr : t.categoryId.nameEn) : '') ?? '';

  return (
    <View style={{ flex: 1, backgroundColor: tok.void }}>
      <ScreenAtmosphere />
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <RHomeHeader userName={userName} view="bento" onViewChange={() => {}} />
        <ScreenScroll
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 14, paddingBottom: insets.bottom + 100, paddingHorizontal: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={tok.gold} colors={[tok.gold]} progressBackgroundColor={tok.surface} />}
        >
          {allowance ? (
            <RCard padding={18} accent>
              <REyebrow style={{ marginBottom: 8, textAlign: ar ? 'right' : 'left' }}>{allowance.period === 'week' ? (ar ? 'ما تبقّى من مصروفك هذا الأسبوع' : 'Left of your allowance this week') : (ar ? 'ما تبقّى من مصروفك هذا الشهر' : 'Left of your allowance this month')}</REyebrow>
              <RAmount value={Math.max(0, allowance.left)} currency={currency} size={32} decimals={0} color={allowance.over ? tok.alertText : undefined} />
              <View style={{ marginTop: 10 }}><RProgress value={Math.min(allowance.spent, allowance.amount)} max={Math.max(1, allowance.amount)} color={allowance.over ? tok.alertText : tok.gold} height={6} /></View>
              <Text style={{ marginTop: 8, fontFamily: fontMono('regular'), fontSize: 11, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>
                {ar ? `صرفتَ ${Math.round(allowance.spent).toLocaleString('en-US')} من ${Math.round(allowance.amount).toLocaleString('en-US')}` : `${Math.round(allowance.spent).toLocaleString('en-US')} spent of ${Math.round(allowance.amount).toLocaleString('en-US')}`}
              </Text>
            </RCard>
          ) : null}

          <RCard padding={18}>
            <REyebrow style={{ marginBottom: 8, textAlign: ar ? 'right' : 'left' }}>{ar ? 'صرفتَ هذا الشهر' : 'You spent this month'}</REyebrow>
            <RAmount value={-spent} currency={currency} size={32} decimals={0} />
            <Text style={{ marginTop: 8, fontFamily: fontBody(lang), fontSize: 13, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>
              {ar ? 'اضغط + لتسجيل ما صرفته.' : 'Tap + to log what you spend.'}
            </Text>
          </RCard>

          {goals.length > 0 ? (
            <View style={{ gap: 10 }}>
              <REyebrow style={{ textAlign: ar ? 'right' : 'left' }}>{ar ? 'أهداف العائلة' : 'FAMILY GOALS'}</REyebrow>
              {goals.map((g) => {
                const got = g.progressAmount ?? g.savedAmount;
                const pct = g.targetAmount > 0 ? Math.min(100, Math.round((got / g.targetAmount) * 100)) : 0;
                return (
                  <RCard key={g._id} padding={16}>
                    <View style={{ flexDirection: ar ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 15, color: tok.bone }}>{ar ? (g.nameAr || g.nameEn) : g.nameEn}</Text>
                      <Text style={{ fontFamily: fontMono('regular'), fontSize: 12, color: tok.gold }}>{pct}%</Text>
                    </View>
                    <View style={{ marginTop: 10 }}><RProgress value={got} max={Math.max(1, g.targetAmount)} color={tok.gold} height={6} /></View>
                  </RCard>
                );
              })}
            </View>
          ) : null}

          <REyebrow style={{ marginTop: 4, textAlign: ar ? 'right' : 'left' }}>{ar ? 'مدخلاتك' : 'YOUR ENTRIES'}</REyebrow>
          {txs === null ? null : txs.length === 0 ? (
            <Text style={{ fontFamily: fontBody(lang), fontSize: 14, color: tok.muted, textAlign: 'center', paddingTop: 12 }}>{ar ? 'لم تسجّل شيئاً بعد.' : 'You have not logged anything yet.'}</Text>
          ) : (
            <RCard padding={0} style={{ paddingHorizontal: 16 }}>
              {txs.slice(0, 15).map((t, i) => (
                <View key={t._id} style={{ paddingVertical: 12, flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 12, borderBottomWidth: i < Math.min(15, txs.length) - 1 ? 1 : 0, borderBottomColor: tok.border }}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontFamily: fontBody(lang, 'medium'), fontSize: 14, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{t.description || catName(t) || (ar ? 'مصروف' : 'Spending')}</Text>
                    <Text style={{ marginTop: 2, fontFamily: fontMono('regular'), fontSize: 11, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>{new Date(t.date).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' })}</Text>
                  </View>
                  <RAmount value={-t.amount} currency={currency} size={14} decimals={0} />
                </View>
              ))}
            </RCard>
          )}
        </ScreenScroll>
      </View>
    </View>
  );
}
