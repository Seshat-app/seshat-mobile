import { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { apiFetch } from '../lib/api';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { radius } from '../lib/theme';
import { REyebrow, RButton, RField } from './ui';
import { useKeyboardHeight } from './useKeyboardHeight';
import { emitDataChanged } from '../lib/dataEvents';
import type { CardSummary } from '../lib/cards';

/** Bottom sheet shell shared by the two money-source sheets. */
function Sheet({ visible, onClose, eyebrow, title, children }: {
  visible: boolean; onClose: () => void; eyebrow: string; title: string; children: React.ReactNode;
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
        backgroundColor: tok.void, maxHeight: '88%',
        borderTopLeftRadius: radius.modal, borderTopRightRadius: radius.modal,
        paddingHorizontal: 18, paddingTop: 10, paddingBottom: kb ? 14 : insets.bottom + 18,
        borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
      }}>
        <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 999, backgroundColor: tok.border, marginBottom: 12 }} />
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <REyebrow style={{ color: tok.gold, marginBottom: 4, textAlign: ar ? 'right' : 'left' }}>{eyebrow}</REyebrow>
            <Text style={{ fontFamily: fontHead(lang), fontSize: 20, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{title}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8}><X size={20} color={tok.muted} /></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

function Chips<T extends string>({ options, value, onChange, label }: {
  options: Array<{ key: T; label: string }>; value: T | null; onChange: (k: T) => void; label: string;
}) {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  return (
    <View>
      <REyebrow style={{ marginBottom: 8, textAlign: ar ? 'right' : 'left' }}>{label}</REyebrow>
      <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => {
          const on = o.key === value;
          return (
            <Pressable
              key={o.key}
              onPress={() => onChange(o.key)}
              style={({ pressed }) => ({
                paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
                backgroundColor: on ? tok.gold : tok.elevated, borderWidth: 1, borderColor: on ? tok.gold : tok.border,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ fontFamily: fontMono(on ? 'medium' : 'regular'), fontSize: 12.5, color: on ? tok.void : tok.bone }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Move money between two of your own sources (ATM withdrawal, account to account, wallet top-up). */
export function MoveMoneySheet({ visible, onClose, sources, initialFrom, onDone }: {
  visible: boolean; onClose: () => void; sources: CardSummary[]; initialFrom?: string; onDone?: () => void;
}) {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setFrom(initialFrom ?? sources.find((s) => s.kind !== 'cash')?.id ?? sources[0]?.id ?? null);
    setTo(sources.find((s) => s.kind === 'cash' && s.id !== initialFrom)?.id ?? null);
    setAmount('');
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const opts = sources.map((s) => ({ key: s.id, label: s.name }));
  const value = parseFloat(amount.replace(/,/g, ''));
  const ok = !!from && !!to && from !== to && Number.isFinite(value) && value > 0;

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
    <Sheet visible={visible} onClose={onClose} eyebrow={ar ? 'تحويل' : 'Move money'} title={ar ? 'انقل مبلغاً بين حساباتك' : 'Move money between your accounts'}>
      <Chips label={ar ? 'من' : 'From'} options={opts} value={from} onChange={setFrom} />
      <Chips label={ar ? 'إلى' : 'To'} options={opts.filter((o) => o.key !== from)} value={to} onChange={setTo} />
      <RField label={ar ? 'المبلغ' : 'Amount'} value={amount} onChange={setAmount} keyboardType="decimal-pad" mono placeholder="0" />
      <Text style={{ fontFamily: fontBody(lang), fontSize: 12, lineHeight: 18, color: '#8A8A8A', textAlign: ar ? 'right' : 'left' }}>
        {ar ? 'لا يُحتسب كمصروف ولا دخل، يغيّر فقط رصيد الحسابين.' : 'This is not spending or income. It only changes the two balances.'}
      </Text>
      <RButton full onPress={submit} disabled={!ok} loading={busy}>{ar ? 'نقل' : 'Move'}</RButton>
    </Sheet>
  );
}

/** Add a card, account or e-wallet by hand, with the balance it holds today. */
export function AddSourceSheet({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone?: () => void }) {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const [kind, setKind] = useState<'card' | 'account' | 'wallet'>('account');
  const [name, setName] = useState('');
  const [last4, setLast4] = useState('');
  const [opening, setOpening] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (visible) { setKind('account'); setName(''); setLast4(''); setOpening(''); } }, [visible]);

  const digits = last4.replace(/\D/g, '').slice(-4);
  const ok = digits.length >= 3;

  const submit = async () => {
    if (!ok) return;
    setBusy(true);
    try {
      const balance = parseFloat(opening.replace(/,/g, ''));
      await apiFetch('/cards', {
        method: 'POST',
        body: JSON.stringify({
          kind, last4: digits, label: name.trim() || undefined,
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
    <Sheet visible={visible} onClose={onClose} eyebrow={ar ? 'مصدر أموال' : 'Money source'} title={ar ? 'أضف بطاقة أو حساباً أو محفظة' : 'Add a card, account or wallet'}>
      <Chips
        label={ar ? 'النوع' : 'Type'} value={kind} onChange={setKind}
        options={[
          { key: 'account', label: ar ? 'حساب بنكي' : 'Bank account' },
          { key: 'card', label: ar ? 'بطاقة' : 'Card' },
          { key: 'wallet', label: ar ? 'محفظة (فودافون كاش…)' : 'E-wallet (Vodafone Cash…)' },
        ]}
      />
      <RField label={ar ? 'الاسم (اختياري)' : 'Name (optional)'} value={name} onChange={setName} placeholder={ar ? 'مثال: حساب CIB' : 'e.g. CIB salary'} />
      <RField label={ar ? 'آخر 4 أرقام' : 'Last 4 digits'} value={last4} onChange={setLast4} keyboardType="number-pad" maxLength={4} mono placeholder="1234" />
      <RField label={ar ? 'الرصيد الحالي' : 'Balance today'} value={opening} onChange={setOpening} keyboardType="decimal-pad" mono placeholder="0" />
      <RButton full onPress={submit} disabled={!ok} loading={busy}>{ar ? 'إضافة' : 'Add'}</RButton>
    </Sheet>
  );
}
