import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Landmark, CreditCard, Wallet, Banknote, ArrowDown, ArrowUpDown, Check } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { apiFetch } from '../lib/api';
import { fmtNum } from '../lib/privacy';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { radius } from '../lib/theme';
import { REyebrow, RButton, RField, RPill } from './ui';
import { useKeyboardHeight } from './useKeyboardHeight';
import { emitDataChanged } from '../lib/dataEvents';
import type { CardSummary } from '../lib/cards';

const ICON = { card: CreditCard, account: Landmark, wallet: Wallet, cash: Banknote } as const;

/** Bottom sheet shell shared by the money-source sheets. */
function Sheet({ visible, onClose, title, hint, children }: {
  visible: boolean; onClose: () => void; title: string; hint?: string; children: React.ReactNode;
}) {
  const { tok, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const ar = lang === 'ar';
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)' }} onPress={onClose} />
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: kb,
        backgroundColor: tok.void, maxHeight: '92%',
        borderTopLeftRadius: radius.modal, borderTopRightRadius: radius.modal,
        paddingHorizontal: 18, paddingTop: 10, paddingBottom: kb ? 14 : insets.bottom + 18,
        borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
      }}>
        <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 999, backgroundColor: tok.border, marginBottom: 12 }} />
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fontHead(lang), fontSize: 21, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{title}</Text>
            {hint ? <Text style={{ marginTop: 4, fontFamily: fontBody(lang), fontSize: 13, lineHeight: 19, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>{hint}</Text> : null}
          </View>
          <Pressable onPress={onClose} hitSlop={10}><X size={20} color={tok.muted} /></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 6 }}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

/** One account as a tappable row: icon, name, balance, and a check when picked. */
function AccountPick({ s, on, onPress }: { s: CardSummary; on: boolean; onPress: () => void }) {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const Icon = ICON[s.kind] ?? CreditCard;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 12,
        padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: on ? tok.gold : tok.border,
        backgroundColor: on ? 'rgba(201,168,76,0.10)' : tok.elevated, opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icon size={18} color={on ? tok.gold : tok.muted} />
      <Text numberOfLines={1} style={{ flex: 1, fontFamily: fontBody(lang, 'semibold'), fontSize: 14.5, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{s.name}</Text>
      <Text style={{ fontFamily: fontMono('regular'), fontSize: 12.5, color: tok.muted }}>{fmtNum(Math.round(s.balance ?? 0))}</Text>
      <View style={{ width: 18 }}>{on ? <Check size={17} color={tok.gold} /> : null}</View>
    </Pressable>
  );
}

/**
 * Move money between two of your own accounts. Amount first, then where it left and where it went; a one-line
 * preview shows what each balance becomes. "Withdraw cash" pre-fills the common case (bank to Cash).
 */
export function MoveMoneySheet({ visible, onClose, sources, initialFrom, onDone }: {
  visible: boolean; onClose: () => void; sources: CardSummary[]; initialFrom?: string; onDone?: () => void;
}) {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const cash = sources.find((s) => s.kind === 'cash');
  const firstBank = sources.find((s) => s.kind !== 'cash');

  useEffect(() => {
    if (!visible) return;
    const start = initialFrom ?? firstBank?.id ?? sources[0]?.id ?? null;
    setFrom(start);
    setTo(cash && cash.id !== start ? cash.id : sources.find((s) => s.id !== start)?.id ?? null);
    setAmount('');
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = parseFloat(amount.replace(/,/g, ''));
  const a = sources.find((s) => s.id === from);
  const b = sources.find((s) => s.id === to);
  const ok = !!a && !!b && a.id !== b.id && Number.isFinite(value) && value > 0;

  const swap = () => { setFrom(to); setTo(from); };
  const withdraw = () => { if (firstBank && cash) { setFrom(from && from !== cash.id ? from : firstBank.id); setTo(cash.id); } };

  const submit = async () => {
    if (!ok) return;
    setBusy(true);
    try {
      await apiFetch('/transfers', { method: 'POST', body: JSON.stringify({ from, to, amount: value }) });
      emitDataChanged();
      onDone?.();
      onClose();
    } catch (err) {
      Alert.alert(ar ? 'تعذّر نقل المبلغ' : 'Could not move the money', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible} onClose={onClose}
      title={ar ? 'نقل مبلغ' : 'Move money'}
      hint={ar ? 'سحب كاش أو تحويل بين حساباتك. لا يُحسب كمصروف.' : 'Withdraw cash or move money between your own accounts. It is not counted as spending.'}
    >
      {cash && firstBank && (
        <Pressable onPress={withdraw} style={({ pressed }) => ({ alignSelf: ar ? 'flex-end' : 'flex-start', flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: tok.border, backgroundColor: tok.elevated, opacity: pressed ? 0.8 : 1 })}>
          <Banknote size={15} color={tok.gold} />
          <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 13, color: tok.bone }}>{ar ? 'سحب كاش من ماكينة' : 'Withdrew cash (ATM)'}</Text>
        </Pressable>
      )}
      <RField label={ar ? 'كم المبلغ؟' : 'How much?'} value={amount} onChange={setAmount} keyboardType="decimal-pad" mono placeholder="0" />

      <View style={{ gap: 8 }}>
        <REyebrow style={{ textAlign: ar ? 'right' : 'left' }}>{ar ? 'خرج من' : 'Taken from'}</REyebrow>
        {sources.map((s) => <AccountPick key={`f${s.id}`} s={s} on={s.id === from} onPress={() => { setFrom(s.id); if (s.id === to) setTo(from); }} />)}
      </View>

      <Pressable onPress={swap} hitSlop={10} style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4 }}>
        <ArrowDown size={16} color={tok.gold} />
        <ArrowUpDown size={14} color={tok.muted} />
      </Pressable>

      <View style={{ gap: 8 }}>
        <REyebrow style={{ textAlign: ar ? 'right' : 'left' }}>{ar ? 'وصل إلى' : 'Moved to'}</REyebrow>
        {sources.filter((s) => s.id !== from).map((s) => <AccountPick key={`t${s.id}`} s={s} on={s.id === to} onPress={() => setTo(s.id)} />)}
      </View>

      {ok && a && b && (
        <View style={{ padding: 12, borderRadius: 12, backgroundColor: tok.elevated, gap: 4 }}>
          <Text style={{ fontFamily: fontMono('regular'), fontSize: 12, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>
            {a.name}: {fmtNum(Math.round(a.balance))} → {fmtNum(Math.round(a.balance - value))}
          </Text>
          <Text style={{ fontFamily: fontMono('regular'), fontSize: 12, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>
            {b.name}: {fmtNum(Math.round(b.balance))} → {fmtNum(Math.round(b.balance + value))}
          </Text>
        </View>
      )}
      <RButton full onPress={submit} disabled={!ok} loading={busy}>{ar ? 'انقل' : 'Move it'}</RButton>
    </Sheet>
  );
}

const KINDS: Array<{ key: 'account' | 'card' | 'wallet'; icon: typeof Landmark; en: string; ar: string; ph: string; phAr: string }> = [
  { key: 'account', icon: Landmark, en: 'Bank account', ar: 'حساب بنكي', ph: 'e.g. CIB salary', phAr: 'مثال: حساب CIB' },
  { key: 'card', icon: CreditCard, en: 'Card', ar: 'بطاقة', ph: 'e.g. Visa NBK', phAr: 'مثال: فيزا NBK' },
  { key: 'wallet', icon: Wallet, en: 'Wallet', ar: 'محفظة', ph: 'e.g. Vodafone Cash', phAr: 'مثال: فودافون كاش' },
];

/** Add an account in three plain steps: what kind, what to call it, how much is in it now. Digits are optional. */
export function AddSourceSheet({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone?: () => void }) {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const [kind, setKind] = useState<'account' | 'card' | 'wallet'>('account');
  const [name, setName] = useState('');
  const [opening, setOpening] = useState('');
  const [digits, setDigits] = useState('');
  const [showDigits, setShowDigits] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (visible) { setKind('account'); setName(''); setOpening(''); setDigits(''); setShowDigits(false); } }, [visible]);

  const k = useMemo(() => KINDS.find((x) => x.key === kind)!, [kind]);
  const last4 = digits.replace(/\D/g, '').slice(-4);
  const ok = name.trim().length > 0;

  const submit = async () => {
    if (!ok) return;
    setBusy(true);
    try {
      const balance = parseFloat(opening.replace(/,/g, ''));
      await apiFetch('/cards', {
        method: 'POST',
        body: JSON.stringify({
          kind, label: name.trim(),
          ...(last4.length >= 3 ? { last4 } : {}),
          ...(Number.isFinite(balance) ? { openingBalance: balance } : {}),
        }),
      });
      emitDataChanged();
      onDone?.();
      onClose();
    } catch (err) {
      Alert.alert(ar ? 'تعذّرت الإضافة' : 'Could not add it', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible} onClose={onClose}
      title={ar ? 'أضف حساباً' : 'Add an account'}
      hint={ar ? 'سيتتبّع سيشات رصيده مع كل عملية.' : 'Seshat will track its balance with every entry.'}
    >
      <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 10 }}>
        {KINDS.map((x) => {
          const on = x.key === kind; const Icon = x.icon;
          return (
            <Pressable key={x.key} onPress={() => setKind(x.key)} style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: on ? tok.gold : tok.border, backgroundColor: on ? 'rgba(201,168,76,0.10)' : tok.elevated, opacity: pressed ? 0.85 : 1 })}>
              <Icon size={22} color={on ? tok.gold : tok.muted} />
              <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 12.5, color: tok.bone }}>{ar ? x.ar : x.en}</Text>
            </Pressable>
          );
        })}
      </View>
      <RField label={ar ? 'الاسم' : 'Name'} value={name} onChange={setName} placeholder={ar ? k.phAr : k.ph} autoFocus />
      <RField label={ar ? 'كم فيه الآن؟' : 'How much is in it now?'} value={opening} onChange={setOpening} keyboardType="decimal-pad" mono placeholder="0" />
      {showDigits ? (
        <RField label={ar ? 'آخر 4 أرقام (لربط رسائل البنك)' : 'Last 4 digits (matches bank messages)'} value={digits} onChange={setDigits} keyboardType="number-pad" maxLength={4} mono placeholder="1234" />
      ) : (
        <Pressable onPress={() => setShowDigits(true)} hitSlop={8}>
          <Text style={{ fontFamily: fontBody(lang), fontSize: 13, color: tok.gold, textAlign: ar ? 'right' : 'left' }}>
            {ar ? '+ لديها رقم؟ أضف آخر 4 أرقام لربط رسائل البنك تلقائياً' : '+ Has card digits? Add them so bank messages match automatically'}
          </Text>
        </Pressable>
      )}
      <RButton full onPress={submit} disabled={!ok} loading={busy}>{ar ? 'أضف الحساب' : 'Add account'}</RButton>
    </Sheet>
  );
}

/** Fix an account's balance by telling Seshat what it holds right now. */
export function CorrectBalanceSheet({ visible, onClose, account, onDone }: {
  visible: boolean; onClose: () => void; account: Pick<CardSummary, 'id' | 'name' | 'balance'> | null; onDone?: () => void;
}) {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible && account) setValue(String(Math.round(account.balance ?? 0))); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = parseFloat(value.replace(/,/g, ''));
  const submit = async () => {
    if (!account || !Number.isFinite(n)) return;
    setBusy(true);
    try {
      await apiFetch(`/cards/${account.id}`, { method: 'PATCH', body: JSON.stringify({ currentBalance: n }) });
      emitDataChanged();
      onDone?.();
      onClose();
    } catch (err) {
      Alert.alert(ar ? 'تعذّر الحفظ' : 'Could not save', err instanceof Error ? err.message : undefined);
    } finally { setBusy(false); }
  };
  return (
    <Sheet
      visible={visible} onClose={onClose}
      title={ar ? 'صحّح الرصيد' : 'Correct the balance'}
      hint={ar ? `اكتب ما في «${account?.name ?? ''}» الآن، وسيضبط سيشات الباقي.` : `Type what “${account?.name ?? ''}” holds right now. Seshat adjusts the rest.`}
    >
      <RField label={ar ? 'الرصيد الحالي' : 'Balance now'} value={value} onChange={setValue} keyboardType="decimal-pad" mono autoFocus />
      <RButton full onPress={submit} disabled={!Number.isFinite(n)} loading={busy}>{ar ? 'احفظ' : 'Save'}</RButton>
    </Sheet>
  );
}

/**
 * "This is the same account as another one": a bank can call one account by two numbers (the card's digits and the
 * account's). Merging moves every entry across and makes future messages with either number land on one account.
 */
export function MergeAccountSheet({ visible, onClose, account, others, onDone }: {
  visible: boolean; onClose: () => void; account: { id: string; name: string } | null; others: CardSummary[]; onDone?: () => void;
}) {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const [into, setInto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const choices = others.filter((o) => o.id !== account?.id && o.kind !== 'cash');
  useEffect(() => { if (visible) setInto(null); }, [visible]);
  const target = choices.find((c) => c.id === into);

  const submit = async () => {
    if (!account || !into) return;
    setBusy(true);
    try {
      await apiFetch(`/cards/${account.id}/merge`, { method: 'POST', body: JSON.stringify({ intoId: into }) });
      emitDataChanged();
      onDone?.();
      onClose();
    } catch (err) {
      Alert.alert(ar ? 'تعذّر الدمج' : 'Could not merge', err instanceof Error ? err.message : undefined);
    } finally { setBusy(false); }
  };

  return (
    <Sheet
      visible={visible} onClose={onClose}
      title={ar ? 'نفس الحساب؟' : 'Same account?'}
      hint={ar
        ? `إن كان «${account?.name ?? ''}» هو نفسه حساباً آخر لديك، ادمجهما: تنتقل كل عملياته، وأي رسالة بنك تحمل أياً من الرقمين تذهب للحساب الواحد.`
        : `If “${account?.name ?? ''}” is another account you already have under a second number, merge them: all its entries move over, and bank messages with either number land on the one account.`}
    >
      {choices.length === 0 ? (
        <Text style={{ fontFamily: fontBody(lang), fontSize: 13.5, color: '#8A8A8A', textAlign: ar ? 'right' : 'left' }}>
          {ar ? 'لا يوجد حساب آخر للدمج معه.' : 'There is no other account to merge into.'}
        </Text>
      ) : (
        <View style={{ gap: 8 }}>
          <REyebrow style={{ textAlign: ar ? 'right' : 'left' }}>{ar ? 'ادمجه في' : 'Merge it into'}</REyebrow>
          {choices.map((c) => <AccountPick key={c.id} s={c} on={c.id === into} onPress={() => setInto(c.id)} />)}
        </View>
      )}
      {target && (
        <Text style={{ fontFamily: fontBody(lang), fontSize: 12.5, lineHeight: 18, color: '#8A8A8A', textAlign: ar ? 'right' : 'left' }}>
          {ar ? `سيختفي «${account?.name}» وتنتقل عملياته إلى «${target.name}».` : `“${account?.name}” will disappear and its entries move to “${target.name}”.`}
        </Text>
      )}
      <RButton full onPress={submit} disabled={!into} loading={busy}>{ar ? 'ادمج الحسابين' : 'Merge accounts'}</RButton>
    </Sheet>
  );
}


export type DailyLimitInfo = {
  limit: { amount: number; until: string | null; goalId: string | null } | null;
  currency: string;
  spentToday: number;
  leftToday: number | null;
  avgDailySpend: number;
  goal: { id: string; name: string; nameAr: string; target: number; saved: number; deadline: string | null;
          remaining: number; daysLeft: number; perDayToSave: number | null; suggestedLimit: number | null } | null;
};
type GoalRow = { _id: string; nameEn: string; nameAr: string; targetAmount: number; savedAmount: number; deadline?: string };

/**
 * A daily spending limit, optionally to reach a savings goal by its date. Pick a goal with a deadline and Seshat says
 * what has to be set aside each day and suggests the limit that gets you there; the number stays yours to change.
 */
export function DailyLimitSheet({ visible, onClose, info, onDone }: {
  visible: boolean; onClose: () => void; info: DailyLimitInfo | null; onDone?: () => void;
}) {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const [value, setValue] = useState('');
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setValue(info?.limit ? String(Math.round(info.limit.amount)) : '');
    setGoalId(info?.limit?.goalId ?? null);
    apiFetch<{ data: GoalRow[] }>('/goals').then((r) => setGoals(r.data.filter((g) => g.deadline && g.savedAmount < g.targetAmount))).catch(() => setGoals([]));
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const goal = goals.find((g) => g._id === goalId);
  const plan = useMemo(() => {
    if (!goal?.deadline) return null;
    const days = Math.max(0, Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000));
    if (days === 0) return null;
    const perDay = Math.ceil((goal.targetAmount - goal.savedAmount) / days);
    const avg = info?.avgDailySpend ?? 0;
    return { days, perDay, suggested: avg > perDay ? Math.floor(avg - perDay) : null };
  }, [goal, info?.avgDailySpend]);

  const n = parseFloat(value.replace(/,/g, ''));
  const cur = info?.currency ?? '';
  const save = async () => {
    if (!Number.isFinite(n) || n <= 0) return;
    setBusy(true);
    try {
      await apiFetch('/me/daily-limit', { method: 'PUT', body: JSON.stringify({ amount: n, until: goal?.deadline, goalId: goalId ?? undefined }) });
      emitDataChanged(); onDone?.(); onClose();
    } catch (err) {
      Alert.alert(ar ? 'تعذّر الحفظ' : 'Could not save', err instanceof Error ? err.message : undefined);
    } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await apiFetch('/me/daily-limit', { method: 'DELETE' }); emitDataChanged(); onDone?.(); onClose(); }
    catch (err) { Alert.alert(ar ? 'تعذّر الحذف' : 'Could not remove', err instanceof Error ? err.message : undefined); }
    finally { setBusy(false); }
  };

  return (
    <Sheet
      visible={visible} onClose={onClose}
      title={ar ? 'حدّ الإنفاق اليومي' : 'Daily spending limit'}
      hint={ar ? 'اختر مبلغاً لا تتجاوزه كل يوم. يظهر في الرئيسية كم تبقّى لك اليوم.' : 'Pick an amount you will not pass in a day. Home shows how much is left today.'}
    >
      {goals.length > 0 && (
        <View style={{ gap: 8 }}>
          <REyebrow>{ar ? 'لهدف (اختياري)' : 'For a goal (optional)'}</REyebrow>
          <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
            <RPill active={goalId === null} onPress={() => setGoalId(null)}>{ar ? 'بدون هدف' : 'No goal'}</RPill>
            {goals.map((g) => (
              <RPill key={g._id} active={goalId === g._id} onPress={() => setGoalId(g._id)}>{ar ? g.nameAr : g.nameEn}</RPill>
            ))}
          </View>
        </View>
      )}
      {plan && goal && (
        <View style={{ gap: 4 }}>
          <Text style={{ fontFamily: fontBody(lang), fontSize: 13, lineHeight: 19, color: '#9C9A92', textAlign: ar ? 'right' : 'left' }}>
            {ar
              ? `للوصول إلى «${goal.nameAr}» خلال ${plan.days} يوماً تحتاج أن تدّخر ${fmtNum(plan.perDay)} ${cur} كل يوم.`
              : `To reach “${goal.nameEn}” in ${plan.days} days, set aside ${fmtNum(plan.perDay)} ${cur} a day.`}
          </Text>
          {plan.suggested !== null ? (
            <Pressable onPress={() => setValue(String(plan.suggested))}>
              <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 13, color: '#C9A84C', textAlign: ar ? 'right' : 'left' }}>
                {ar ? `الحدّ المقترح: ${fmtNum(plan.suggested)} ${cur} (اضغط للاستخدام)` : `Suggested limit: ${fmtNum(plan.suggested)} ${cur} (tap to use)`}
              </Text>
            </Pressable>
          ) : (
            <Text style={{ fontFamily: fontBody(lang), fontSize: 13, color: '#9C9A92', textAlign: ar ? 'right' : 'left' }}>
              {ar ? 'إنفاقك المعتاد أقل مما يتطلبه الهدف، فالحدّ وحده لا يكفي.' : 'Your usual spending is below what the goal needs, so a limit alone will not get you there.'}
            </Text>
          )}
        </View>
      )}
      <RField label={ar ? `الحدّ اليومي (${cur})` : `Limit per day (${cur})`} value={value} onChange={setValue} keyboardType="decimal-pad" mono />
      <RButton full onPress={save} disabled={!Number.isFinite(n) || n <= 0} loading={busy}>{ar ? 'احفظ' : 'Save'}</RButton>
      {info?.limit ? <RButton full variant="ghost" onPress={remove} disabled={busy}>{ar ? 'إزالة الحدّ' : 'Remove the limit'}</RButton> : null}
    </Sheet>
  );
}
