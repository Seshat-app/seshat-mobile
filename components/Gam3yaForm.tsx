import { useEffect, useMemo, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { apiFetch } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { fontBody } from '../lib/fonts';
import { REyebrow, RButton, RField, RPill, RCard } from './ui';
import { emitDataChanged } from '../lib/dataEvents';

export type Suggestion = { goalName: string; goalNameAr: string; remaining: number; members: number; amount: number; turn: number; pot: number; fits: boolean | null; extendsDeadline?: boolean; endsOn?: string };
const n0 = (v: number) => Math.round(v).toLocaleString('en-US');

/** The form for a new gam3ya. Lives on its own screen. */
export function Gam3yaForm({ seed, onDone }: { seed?: Partial<Suggestion>; onDone: () => void }) {
  const visible = true;
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const [name, setName] = useState('');
  const [freq, setFreq] = useState<'monthly' | 'weekly'>('monthly');
  const [amount, setAmount] = useState('');
  const [members, setMembers] = useState('');
  const [turns, setTurns] = useState('');
  const [payDay, setPayDay] = useState('1');
  const [weekday, setWeekday] = useState(5);
  const [start, setStart] = useState<'this' | 'next'>('this');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setName(seed?.goalName ? (ar ? `جمعية ${seed.goalNameAr ?? ''}` : `${seed.goalName} gam3ya`) : '');
    setFreq('monthly'); setAmount(seed?.amount ? String(seed.amount) : ''); setMembers(seed?.members ? String(seed.members) : '');
    setTurns(seed?.turn ? String(seed.turn) : ''); setPayDay('1'); setWeekday(5); setStart('this');
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const a = parseFloat(amount) || 0;
  const m = Math.trunc(parseFloat(members) || 0);
  const turnList = useMemo(() => Array.from(new Set(turns.split(/[,\s،]+/).map((x) => Math.trunc(Number(x))).filter((x) => x >= 1 && x <= (m || 0)))), [turns, m]);
  const day = Math.trunc(parseFloat(payDay) || 0);
  const ok = !!name.trim() && a > 0 && m >= 2 && turnList.length > 0 && (freq === 'weekly' || (day >= 1 && day <= 31));
  const per = a * Math.max(1, turnList.length);
  const dayNames = ar ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const save = async () => {
    if (!ok) return;
    setBusy(true);
    try {
      const d = new Date();
      if (freq === 'monthly') { d.setUTCDate(1); if (start === 'next') d.setUTCMonth(d.getUTCMonth() + 1); }
      else if (start === 'next') d.setUTCDate(d.getUTCDate() + 7);
      await apiFetch('/gam3ya', { method: 'POST', body: JSON.stringify({ name: name.trim(), frequency: freq, amount: a, members: m, turns: turnList, payDay: freq === 'weekly' ? weekday : day, startDate: d.toISOString().slice(0, 10) }) });
      emitDataChanged(); onDone();
    } catch (err) { Alert.alert(ar ? 'تعذّر الحفظ' : 'Could not save', err instanceof Error ? err.message : undefined); }
    finally { setBusy(false); }
  };

  return (
    <View style={{ gap: 16 }}>
      <RField label={ar ? 'الاسم' : 'Name'} value={name} onChange={setName} placeholder={ar ? 'مثلاً: جمعية الشغل' : 'e.g. Work gam3ya'} />
      <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 8 }}>
        <RPill active={freq === 'monthly'} onPress={() => setFreq('monthly')}>{ar ? 'شهرية' : 'Monthly'}</RPill>
        <RPill active={freq === 'weekly'} onPress={() => setFreq('weekly')}>{ar ? 'أسبوعية' : 'Weekly'}</RPill>
      </View>
      <RField label={ar ? (freq === 'weekly' ? 'القسط الأسبوعي لكل حصة' : 'القسط الشهري لكل حصة') : `${freq === 'weekly' ? 'Weekly' : 'Monthly'} amount per share`} value={amount} onChange={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" mono />
      <RField label={ar ? 'عدد الأعضاء (الحصص)' : 'Members (shares)'} value={members} onChange={(v) => setMembers(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" mono />
      <RField label={ar ? `دورك (رقم ${freq === 'weekly' ? 'الأسبوع' : 'الشهر'}، أو أكثر مفصولة بفاصلة)` : `Your turn (${freq === 'weekly' ? 'week' : 'month'} number, or several separated by commas)`} value={turns} onChange={(v) => setTurns(v.replace(/[^0-9, ]/g, ''))} keyboardType="numeric" mono />
      {freq === 'monthly' ? (
        <RField label={ar ? 'يوم الدفع من الشهر' : 'Payment day of the month'} value={payDay} onChange={(v) => setPayDay(v.replace(/[^0-9]/g, '').slice(0, 2))} keyboardType="number-pad" mono />
      ) : (
        <View style={{ gap: 8 }}>
          <REyebrow>{ar ? 'يوم الدفع' : 'Payment day'}</REyebrow>
          <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
            {dayNames.map((d, i) => <RPill key={d} active={weekday === i} onPress={() => setWeekday(i)}>{d}</RPill>)}
          </View>
        </View>
      )}
      <View style={{ gap: 8 }}>
        <REyebrow>{ar ? 'بداية الجمعية' : 'Starts'}</REyebrow>
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 8 }}>
          <RPill active={start === 'this'} onPress={() => setStart('this')}>{freq === 'monthly' ? (ar ? 'هذا الشهر' : 'This month') : (ar ? 'هذا الأسبوع' : 'This week')}</RPill>
          <RPill active={start === 'next'} onPress={() => setStart('next')}>{freq === 'monthly' ? (ar ? 'الشهر القادم' : 'Next month') : (ar ? 'الأسبوع القادم' : 'Next week')}</RPill>
        </View>
      </View>
      {ok ? (
        <RCard padding={14}>
          <Text style={{ fontFamily: fontBody(lang), fontSize: 13.5, lineHeight: 20, color: '#E8E6DD', textAlign: ar ? 'right' : 'left' }}>
            {ar
              ? `تدفع ${n0(per)} في كل ${freq === 'weekly' ? 'أسبوع' : 'شهر'}، وتقبض ${n0(a * m)} في دورك. إجمالي ما تدفعه ${n0(per * m)}.`
              : `You pay ${n0(per)} each ${freq === 'weekly' ? 'week' : 'month'} and collect ${n0(a * m)} in your turn. Over the whole circle you pay ${n0(per * m)}.`}
          </Text>
        </RCard>
      ) : null}
      <RButton full onPress={save} disabled={!ok} loading={busy}>{ar ? 'احفظ' : 'Save'}</RButton>
    </View>
  );
}
