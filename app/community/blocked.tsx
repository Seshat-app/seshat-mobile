import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView as ScreenScroll } from '../../components/Scroll';
import { PlanScreen } from '../../components/PlanShell';
import { RCard } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { fontBody } from '../../lib/fonts';
import { apiFetch } from '../../lib/api';

/** Members you blocked, with a way to undo it. */
export default function BlockedScreen() {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<Array<{ id: string; name: string }> | null>(null);
  const load = useCallback(() => { apiFetch<{ data: Array<{ id: string; name: string }> }>('/community/blocks').then((r) => setRows(r.data)).catch(() => setRows([])); }, []);
  useEffect(load, [load]);
  const unblock = async (id: string) => {
    try { await apiFetch(`/community/blocks/${id}`, { method: 'DELETE' }); load(); }
    catch (e) { Alert.alert(ar ? 'تعذّر' : 'Could not unblock', e instanceof Error ? e.message : String(e)); }
  };
  return (
    <PlanScreen title={ar ? 'الأعضاء المحظورون' : 'Blocked members'} subtitle={ar ? 'لا ترى منشوراتهم' : 'You do not see their posts'}>
      <ScreenScroll contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40, paddingTop: 8, gap: 10 }} showsVerticalScrollIndicator={false}>
        {rows === null ? null : rows.length === 0 ? (
          <Text style={{ paddingTop: 40, textAlign: 'center', color: tok.muted, fontFamily: fontBody(lang), fontSize: 14 }}>{ar ? 'لم تحظر أحداً.' : 'You have not blocked anyone.'}</Text>
        ) : rows.map((b) => (
          <RCard key={b.id} padding={14}>
            <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: tok.bone, fontFamily: fontBody(lang, 'medium'), fontSize: 15 }}>{b.name}</Text>
              <Pressable onPress={() => unblock(b.id)} hitSlop={8}><Text style={{ color: tok.gold, fontFamily: fontBody(lang, 'semibold'), fontSize: 13 }}>{ar ? 'إلغاء الحظر' : 'Unblock'}</Text></Pressable>
            </View>
          </RCard>
        ))}
      </ScreenScroll>
    </PlanScreen>
  );
}
