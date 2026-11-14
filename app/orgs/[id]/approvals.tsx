import { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView as ScreenScroll } from '../../../components/Scroll';
import { PlanScreen } from '../../../components/PlanShell';
import { RCard, RButton, RAmount } from '../../../components/ui';
import { useI18n } from '../../../lib/i18n';
import { useAppData } from '../../../lib/appData';
import { fontBody, fontMono } from '../../../lib/fonts';
import { listApprovals, decideApproval, type Approval } from '../../../lib/orgExtras';

/** Expenses by members that wait for an owner or admin: approve, or reject (which removes it and tells the member). */
export default function ApprovalsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const insets = useSafeAreaInsets();
  const { bumpVersion } = useAppData();
  const [items, setItems] = useState<Approval[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try { setItems(await listApprovals(id!)); } catch { setItems((v) => v ?? []); } finally { setRefreshing(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const decide = (a: Approval, decision: 'approve' | 'reject') => {
    const run = async () => {
      try { await decideApproval(id!, a.id, decision); bumpVersion(); await load(); }
      catch (e) { Alert.alert(ar ? 'تعذّر' : 'Could not do that', e instanceof Error ? e.message : String(e)); }
    };
    if (decision === 'approve') { void run(); return; }
    Alert.alert(ar ? 'رفض هذا المصروف؟' : 'Reject this expense?', ar ? 'سيُحذف من الدفاتر ويُبلَّغ صاحبه.' : 'It is removed from the books and the member is told.', [
      { text: ar ? 'إلغاء' : 'Cancel', style: 'cancel' },
      { text: ar ? 'رفض' : 'Reject', style: 'destructive', onPress: () => { void run(); } },
    ]);
  };

  return (
    <PlanScreen title={ar ? 'بانتظار الموافقة' : 'Needs approval'} subtitle={ar ? 'مصاريف فوق الحدّ' : 'Expenses above the limit'}>
      <ScreenScroll
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40, paddingTop: 8, gap: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={tok.gold} colors={[tok.gold]} progressBackgroundColor={tok.surface} />}
      >
        {items === null ? null : items.length === 0 ? (
          <Text style={{ paddingTop: 40, textAlign: 'center', color: tok.muted, fontFamily: fontBody(lang), fontSize: 14 }}>{ar ? 'لا شيء بانتظار الموافقة.' : 'Nothing is waiting.'}</Text>
        ) : items.map((a) => (
          <RCard key={a.id} padding={16}>
            <View style={{ flexDirection: ar ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 15, color: tok.bone }}>{a.by}</Text>
              <RAmount value={-a.amount} currency={a.currency} size={18} decimals={0} />
            </View>
            <Text style={{ marginTop: 6, fontFamily: fontBody(lang), fontSize: 14, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{a.description || (ar ? a.category?.nameAr : a.category?.nameEn) || ''}</Text>
            <Text style={{ marginTop: 4, fontFamily: fontMono('regular'), fontSize: 11, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>
              {(ar ? a.category?.nameAr : a.category?.nameEn) ?? ''} · {new Date(a.date).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' })}
            </Text>
            <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 10, marginTop: 12 }}>
              <View style={{ flex: 1 }}><RButton full onPress={() => decide(a, 'approve')}>{ar ? 'موافقة' : 'Approve'}</RButton></View>
              <View style={{ flex: 1 }}><RButton full variant="secondary" onPress={() => decide(a, 'reject')}>{ar ? 'رفض' : 'Reject'}</RButton></View>
            </View>
          </RCard>
        ))}
      </ScreenScroll>
    </PlanScreen>
  );
}
