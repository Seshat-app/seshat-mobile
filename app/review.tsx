import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { ScrollView as ScreenScroll } from '../components/Scroll';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlanScreen } from '../components/PlanShell';
import { RCard, RAmount, RButton } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { useAppData } from '../lib/appData';
import { apiFetch, hasToken } from '../lib/api';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { emitDataChanged } from '../lib/dataEvents';
import { S } from '../lib/theme';

type Question = {
  id: string; kind: 'atm' | 'category'; amount: number; currency: string; description: string | null; date: string;
  card?: { bank?: string | null; last4?: string; label?: string | null } | null;
};

/**
 * /review - the questions Seshat has about transactions it captured on its own: "was this an ATM
 * withdrawal?", "what was this for?". Opened from a notification (the button pressed there arrives as
 * `action` and answers the question straight away) or from the home banner.
 */
export default function ReviewScreen() {
  const { id, action } = useLocalSearchParams<{ id?: string; action?: string }>();
  const { tok, lang } = useI18n();
  const { categories } = useAppData();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const ar = lang === 'ar';
  const [items, setItems] = useState<Question[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!(await hasToken())) { router.replace('/'); return; }
    try {
      const r = await apiFetch<{ data: Question[] }>('/capture/review');
      setItems(r.data);
    } catch { setItems((c) => c ?? []); }
  }, [router]);
  useEffect(() => { void load(); }, [load]);

  const answer = useCallback(async (qid: string, body: Record<string, string>) => {
    setBusy(qid);
    try {
      await apiFetch(`/capture/review/${qid}/resolve`, { method: 'POST', body: JSON.stringify(body) });
      emitDataChanged();
      setItems((cur) => (cur ?? []).filter((q) => q.id !== qid));
    } catch (err) {
      Alert.alert(ar ? 'تعذّر الحفظ' : 'Could not save', err instanceof Error ? err.message : undefined);
    } finally { setBusy(null); }
  }, [ar]);

  // A notification button pre-answers the question it belongs to, once.
  const [auto, setAuto] = useState(false);
  useEffect(() => {
    if (auto || !id || (action !== 'atm' && action !== 'spending') || !items) return;
    setAuto(true);
    if (items.some((q) => q.id === id)) void answer(id, { action });
  }, [auto, id, action, items, answer]);

  const expenseCats = categories.filter((c) => !c.type || c.type === 'both' || c.type === 'expense').slice(0, 12);
  const card = (q: Question) => (q.card?.label || q.card?.bank || (q.card?.last4 ? `••${q.card.last4}` : '')) || '';

  return (
    <PlanScreen title={ar ? 'أسئلة سيشات' : 'Seshat has questions'} subtitle={ar ? 'ساعدني أصنّف ما رصدته' : 'Help me file what I captured'}>
      <ScreenScroll contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + S[6], paddingTop: 8 }}>
        {items === null && <ActivityIndicator color={tok.gold} />}
        {items && items.length === 0 && (
          <RCard padding={20}>
            <Text style={{ fontFamily: fontHead(lang), fontSize: 16, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>
              {ar ? 'لا أسئلة الآن' : 'Nothing to answer'}
            </Text>
            <Text style={{ marginTop: 6, fontFamily: fontBody(lang), fontSize: 13.5, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>
              {ar ? 'سأسألك هنا عندما لا أكون متأكداً مما رصدته.' : 'I will ask here when I am not sure about something I captured.'}
            </Text>
          </RCard>
        )}
        {(items ?? []).map((q) => (
          <RCard key={q.id} padding={16} style={{ marginBottom: 12, opacity: busy === q.id ? 0.6 : 1 }}>
            <Text style={{ fontFamily: fontHead(lang), fontSize: 16, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>
              {q.kind === 'atm'
                ? (ar ? 'هل كان هذا سحباً من ماكينة؟' : 'Was this an ATM withdrawal?')
                : (ar ? 'على ماذا صرفتَ هذا؟' : 'What was this for?')}
            </Text>
            <View style={{ marginTop: 8 }}>
              <RAmount value={-q.amount} currency={q.currency} size={24} decimals={0} />
            </View>
            <Text style={{ marginTop: 4, fontFamily: fontMono('regular'), fontSize: 11, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>
              {[q.description, card(q), new Date(q.date).toLocaleDateString(ar ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })].filter(Boolean).join(' · ')}
            </Text>
            {q.kind === 'atm' ? (
              <View style={{ marginTop: 14, gap: 10 }}>
                <RButton full onPress={() => answer(q.id, { action: 'atm' })} disabled={busy === q.id}>
                  {ar ? 'نعم، سحبتُ كاش' : 'Yes, I withdrew cash'}
                </RButton>
                <RButton full variant="secondary" onPress={() => answer(q.id, { action: 'spending' })} disabled={busy === q.id}>
                  {ar ? 'لا، كان مصروفاً' : 'No, it was spending'}
                </RButton>
              </View>
            ) : (
              <View style={{ marginTop: 14, flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
                {expenseCats.map((c) => (
                  <Pressable
                    key={c._id}
                    onPress={() => answer(q.id, { action: 'category', categoryId: c._id })}
                    style={({ pressed }) => ({
                      paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: tok.elevated,
                      borderWidth: 1, borderColor: tok.border, opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text style={{ fontFamily: fontBody(lang), fontSize: 13, color: tok.bone }}>{ar && c.nameAr ? c.nameAr : c.nameEn}</Text>
                  </Pressable>
                ))}
                <Pressable onPress={() => answer(q.id, { action: 'spending' })} style={{ paddingHorizontal: 10, paddingVertical: 9 }}>
                  <Text style={{ fontFamily: fontBody(lang), fontSize: 13, color: tok.muted }}>{ar ? 'اتركه كما هو' : 'Keep as is'}</Text>
                </Pressable>
              </View>
            )}
          </RCard>
        ))}
      </ScreenScroll>
    </PlanScreen>
  );
}
