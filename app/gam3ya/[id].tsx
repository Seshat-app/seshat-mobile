import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { ScrollView as ScreenScroll } from '../../components/Scroll';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2 } from 'lucide-react-native';
import { apiFetch } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { fontBody, fontMono } from '../../lib/fonts';
import { RCard, REyebrow, RButton, RPill } from '../../components/ui';
import { PlanScreen } from '../../components/PlanShell';
import { emitDataChanged } from '../../lib/dataEvents';

type Period = { period: number; due: string; state: 'paid' | 'due' | 'upcoming'; paidAt: string | null; isTurn: boolean; received: boolean; payoutPending: boolean };
type Gam = {
  id: string; name: string; frequency: 'monthly' | 'weekly'; currency: string; paymentPerPeriod: number; pot: number; members: number;
  paidCount: number; paidTotal: number; remainingToPay: number; nextDue: Period | null; schedule: Period[];
};
type Acct = { id: string; name: string; kind?: string };
type GoalRow = { _id: string; nameEn: string; nameAr: string; savedAmount: number; targetAmount: number };

const n0 = (v: number) => Math.round(v).toLocaleString('en-US');

/** One gam3ya on its own screen: what needs you now first, then the whole circle as a grid. No long list. */
export default function Gam3yaDetailScreen() {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [gam, setGam] = useState<Gam | null | undefined>(undefined);
  const [accts, setAccts] = useState<Acct[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [acct, setAcct] = useState<string | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const r = await apiFetch<{ data: Gam[] }>('/gam3ya'); setGam(r.data.find((g) => g.id === id) ?? null); }
    catch { setGam((v) => (v === undefined ? null : v)); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    apiFetch<{ data: Acct[] }>('/cards').then((r) => setAccts(r.data.filter((a) => a.kind !== 'cash'))).catch(() => {});
    apiFetch<{ data: GoalRow[] }>('/goals').then((r) => setGoals(r.data.filter((g) => g.savedAmount < g.targetAmount))).catch(() => {});
  }, []);

  if (gam === undefined) return <PlanScreen title="">{null}</PlanScreen>;
  if (gam === null) {
    return (
      <PlanScreen title={ar ? 'الجمعية' : 'Gam3ya'}>
        <View style={{ padding: 24, alignItems: 'center', gap: 12 }}>
          <Text style={{ color: tok.muted, fontFamily: fontBody(lang) }}>{ar ? 'هذه الجمعية لم تعد موجودة.' : 'This gam3ya is not there any more.'}</Text>
          <RButton onPress={() => router.back()}>{ar ? 'رجوع' : 'Back'}</RButton>
        </View>
      </PlanScreen>
    );
  }

  const cur = gam.currency;
  const when = (iso: string, long = false) => new Date(iso).toLocaleDateString(ar ? 'ar-EG' : 'en-GB',
    gam.frequency === 'monthly' ? { month: long ? 'long' : 'short', year: long ? 'numeric' : '2-digit', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const run = async (path: string, body: object) => {
    setBusy(true);
    try { await apiFetch(`/gam3ya/${gam.id}/${path}`, { method: 'POST', body: JSON.stringify(body) }); setSel(null); emitDataChanged(); await load(); }
    catch (err) { Alert.alert(ar ? 'تعذّر الحفظ' : 'Could not save', err instanceof Error ? err.message : undefined); }
    finally { setBusy(false); }
  };
  const needsYou = gam.schedule.filter((p) => p.state === 'due' || p.payoutPending);
  const selected = sel === null ? null : gam.schedule.find((p) => p.period === sel) ?? null;
  const muted = { fontFamily: fontBody(lang), fontSize: 13, color: tok.muted, textAlign: ar ? 'right' : 'left' } as const;

  const accountPick = (
    <View style={{ gap: 8 }}>
      <REyebrow>{ar ? 'من أي حساب' : 'From which account'}</REyebrow>
      <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
        <RPill active={acct === null} onPress={() => setAcct(null)}>{ar ? 'كاش' : 'Cash'}</RPill>
        {accts.map((a) => <RPill key={a.id} active={acct === a.id} onPress={() => setAcct(a.id)}>{a.name}</RPill>)}
      </View>
    </View>
  );
  const payButtons = (p: Period) => (
    <View style={{ gap: 8 }}>
      <RButton full loading={busy} onPress={() => run('pay', { period: p.period, addTransaction: true, cardId: acct ?? undefined })}>{ar ? 'دفعت، وسجّلها' : 'I paid · log it'}</RButton>
      <RButton full variant="ghost" disabled={busy} onPress={() => run('pay', { period: p.period })}>{ar ? 'دفعت، بدون تسجيل' : 'I paid · just mark it'}</RButton>
    </View>
  );
  const payoutButtons = (p: Period) => (
    <View style={{ gap: 10 }}>
      {goals.length > 0 && (
        <View style={{ gap: 8 }}>
          <REyebrow>{ar ? 'وجّهها لهدف؟' : 'Put it toward a goal?'}</REyebrow>
          <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
            <RPill active={goalId === null} onPress={() => setGoalId(null)}>{ar ? 'لا' : 'No'}</RPill>
            {goals.map((g) => <RPill key={g._id} active={goalId === g._id} onPress={() => setGoalId(g._id)}>{ar ? g.nameAr : g.nameEn}</RPill>)}
          </View>
        </View>
      )}
      <RButton full loading={busy} onPress={() => run('payout', { period: p.period, addTransaction: true, cardId: acct ?? undefined, goalId: goalId ?? undefined })}>
        {ar ? `استلمت ${n0(gam.pot)} ${cur}` : `I received ${n0(gam.pot)} ${cur}`}
      </RButton>
    </View>
  );

  const Tile = ({ label, value }: { label: string; value: string }) => (
    <RCard padding={12} style={{ flex: 1 }}>
      <REyebrow style={{ marginBottom: 4, textAlign: ar ? 'right' : 'left' }}>{label}</REyebrow>
      <Text style={{ fontFamily: fontMono('regular'), fontSize: 14, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{value}</Text>
    </RCard>
  );

  return (
    <PlanScreen title={gam.name} subtitle={`${n0(gam.paymentPerPeriod)} ${cur} / ${gam.frequency === 'weekly' ? (ar ? 'أسبوع' : 'week') : (ar ? 'شهر' : 'month')} · ${ar ? 'القبض' : 'pot'} ${n0(gam.pot)}`}>
      <ScreenScroll contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40, paddingTop: 8, gap: 12 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 10 }}>
          <Tile label={ar ? 'دفعت' : 'Paid'} value={`${n0(gam.paidTotal)} · ${gam.paidCount}/${gam.members}`} />
          <Tile label={ar ? 'متبقٍّ' : 'Left'} value={n0(gam.remainingToPay)} />
        </View>

        <RCard accent padding={16}>
          <REyebrow style={{ marginBottom: 10, textAlign: ar ? 'right' : 'left' }}>{ar ? 'يحتاجك الآن' : 'Needs you now'}</REyebrow>
          {needsYou.length === 0 ? (
            <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={16} color={tok.gold} />
              <Text style={{ ...muted, flex: 1 }}>{ar ? 'كل شيء على ما يرام.' : 'You are all caught up.'}{gam.nextDue ? (ar ? `  القسط القادم ${when(gam.nextDue.due, true)}` : `  Next payment ${when(gam.nextDue.due, true)}`) : ''}</Text>
            </View>
          ) : (
            <View style={{ gap: 16 }}>
              {accountPick}
              {needsYou.map((p) => (
                <View key={p.period} style={{ gap: 10 }}>
                  {p.state === 'due' && (
                    <>
                      <Text style={{ fontFamily: fontBody(lang, 'medium'), fontSize: 14, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>
                        {ar ? `قسط ${when(p.due, true)} · ${n0(gam.paymentPerPeriod)} ${cur} مستحق` : `${when(p.due, true)} payment · ${n0(gam.paymentPerPeriod)} ${cur} is due`}
                      </Text>
                      {payButtons(p)}
                    </>
                  )}
                  {p.payoutPending && (
                    <>
                      <Text style={{ fontFamily: fontBody(lang, 'medium'), fontSize: 14, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>
                        {ar ? `حان دورك (${when(p.due, true)}). هل استلمت ${n0(gam.pot)} ${cur}؟` : `It is your turn (${when(p.due, true)}). Did you receive ${n0(gam.pot)} ${cur}?`}
                      </Text>
                      {payoutButtons(p)}
                    </>
                  )}
                </View>
              ))}
            </View>
          )}
        </RCard>

        <RCard padding={16}>
          <REyebrow style={{ marginBottom: 10, textAlign: ar ? 'right' : 'left' }}>{ar ? 'الدورة كاملة' : 'The whole circle'}</REyebrow>
          <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
            {gam.schedule.map((p) => {
              const color = p.state === 'paid' ? tok.gold : p.state === 'due' ? tok.alertText : tok.muted;
              return (
                <Pressable key={p.period} onPress={() => setSel(sel === p.period ? null : p.period)}
                  style={{ width: '23%', padding: 8, borderRadius: 12, borderWidth: 1, borderColor: sel === p.period ? tok.gold : p.state === 'due' ? tok.alertText : tok.border, backgroundColor: tok.elevated }}>
                  <Text style={{ fontFamily: fontMono('regular'), fontSize: 10, color: tok.muted }}>{p.period}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: fontBody(lang), fontSize: 12.5, color }}>{when(p.due)}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: fontMono('regular'), fontSize: 9.5, color: tok.muted }}>
                    {p.isTurn ? (p.received ? (ar ? 'استلمت' : 'Received') : (ar ? 'دورك' : 'Your turn')) : p.state === 'paid' ? (ar ? 'مدفوع' : 'Paid') : ' '}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {selected && (
            <View style={{ marginTop: 14, gap: 12, borderTopWidth: 1, borderTopColor: tok.border, paddingTop: 12 }}>
              <Text style={{ fontFamily: fontBody(lang, 'medium'), fontSize: 14, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>
                {when(selected.due, true)}{selected.isTurn ? (ar ? '  ·  دورك' : '  ·  Your turn') : ''}
              </Text>
              {selected.state === 'paid'
                ? <RButton full variant="ghost" disabled={busy} onPress={() => run('unpay', { period: selected.period })}>{ar ? 'لم أدفعها (تراجع)' : 'Not paid after all (undo)'}</RButton>
                : <>{accountPick}{payButtons(selected)}</>}
              {selected.isTurn && !selected.received ? payoutButtons(selected) : null}
            </View>
          )}
        </RCard>

        <RButton full variant="ghost" onPress={() => Alert.alert(ar ? 'حذف الجمعية؟' : 'Delete this gam3ya?', ar ? 'تبقى المعاملات المسجّلة.' : 'Entries already logged stay.', [
          { text: ar ? 'إلغاء' : 'Cancel', style: 'cancel' },
          { text: ar ? 'حذف' : 'Delete', style: 'destructive', onPress: async () => { await apiFetch(`/gam3ya/${gam.id}`, { method: 'DELETE' }).catch(() => {}); emitDataChanged(); router.back(); } },
        ])}>{ar ? 'حذف الجمعية' : 'Delete this gam3ya'}</RButton>
      </ScreenScroll>
    </PlanScreen>
  );
}
