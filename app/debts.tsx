import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, Animated, Easing, Platform, StyleSheet, RefreshControl, Switch } from 'react-native';
import { ScrollView as ScreenScroll } from '../components/Scroll';
import { useKeyboardHeight } from '../components/useKeyboardHeight';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Archive, ArchiveRestore, Trash2, X } from 'lucide-react-native';
import { apiFetch, newIdempotencyKey } from '../lib/api';
import { useFetchList } from '../lib/hooks/useFetchList';
import { useI18n, currencyLabel, formatAmount } from '../lib/i18n';
import { useAppData } from '../lib/appData';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { radius } from '../lib/theme';
import { DURATION, EASE } from '../lib/motion';
import { RCard, REyebrow, RButton, RProgress, RField } from '../components/ui';
import { PlanScreen } from '../components/PlanShell';
import { SkeletonRow } from '../components/Skeleton';

type Debt = {
  _id: string;
  creditor: string;
  totalAmount: number;
  paidAmount: number;
  currency: string;
  dueDate?: string;
  notes?: string;
  archivedAt?: string | null;
};

type DebtPayment = {
  _id: string;
  amount: number;
  currency: string;
  note?: string;
  date: string;
  /** 'payment' reduces what is owed; 'increase' means more was borrowed. */
  kind?: 'payment' | 'increase';
};

export default function DebtsScreen() {
  const { tok, lang, t } = useI18n();
  const { profile } = useAppData();
  const insets = useSafeAreaInsets();
  const [showArchived, setShowArchived] = useState(false);
  const { items, setItems, loading, refreshing, load } = useFetchList<Debt>(
    () => apiFetch<{ data: Debt[] }>(showArchived ? '/debts?archived=1' : '/debts').then((r) => r.data),
  );
  const [editing, setEditing] = useState<Debt | 'new' | null>(null);

  // Switching between active and archived debts reloads the list.
  const firstView = useRef(true);
  useEffect(() => {
    if (firstView.current) { firstView.current = false; return; }
    void load('initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  const onSave = async (d: Partial<Debt>) => {
    if (editing && editing !== 'new') {
      // Amounts are not editable: they change through payments / "add to debt" entries so every change has a
      // record. Only the descriptive fields are saved here.
      await apiFetch(`/debts/${editing._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ creditor: d.creditor, currency: d.currency, notes: d.notes }),
      });
    } else {
      await apiFetch('/debts', {
        method: 'POST',
        body: JSON.stringify({
          creditor: d.creditor,
          totalAmount: d.totalAmount,
          paidAmount: d.paidAmount ?? 0,
          currency: d.currency ?? profile?.currency ?? 'EGP',
          notes: d.notes,
        }),
        idempotencyKey: newIdempotencyKey(),
      });
    }
    await load();
    setEditing(null);
  };

  // Archive (or restore) instead of deleting: the debt and its history are kept, it just leaves the list.
  const onArchive = async (d: Debt) => {
    await apiFetch(`/debts/${d._id}/${d.archivedAt ? 'restore' : 'archive'}`, { method: 'POST' });
    await load();
    setEditing(null);
  };

  return (
    <PlanScreen
      title={lang === 'ar' ? 'الديون' : 'Debts'}
      subtitle={lang === 'ar' ? 'ما الذي تدين به' : 'What you still owe'}
      onAdd={!loading && items.length === 0 && !showArchived ? undefined : () => setEditing('new')}
      refreshing={refreshing}
    >
      <ScreenScroll
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 96, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load('refresh')}
            tintColor={tok.gold}
            colors={[tok.gold]}
            progressBackgroundColor={tok.surface}
          />
        }
      >
        {loading ? (
          <RCard padding={18}>{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</RCard>
        ) : items.length === 0 ? (
          <Empty text={showArchived ? (lang === 'ar' ? 'لا توجد ديون مؤرشفة.' : 'No archived debts.') : (lang === 'ar' ? 'لا توجد ديون.' : 'No debts. Stay that way.')} sub={showArchived ? '' : (lang === 'ar' ? 'إذا ظهر دين، سجّله هنا.' : 'If one shows up, log it here.')} cta={showArchived ? undefined : (lang === 'ar' ? 'أضف ديناً' : 'Add a debt')} onCta={() => setEditing('new')} />
        ) : (
          <View style={{ gap: 10 }}>
            {items.map((d) => <DebtRow key={d._id} debt={d} onPress={() => setEditing(d)} />)}
          </View>
        )}
        <Pressable onPress={() => setShowArchived((v) => !v)} hitSlop={8} style={{ alignSelf: 'center', marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Archive size={14} color={tok.muted} />
          <Text style={{ color: tok.muted, fontFamily: fontMono('regular'), fontSize: 11, letterSpacing: 1 }}>
            {showArchived ? (lang === 'ar' ? 'عرض الديون الحالية' : 'SHOW ACTIVE DEBTS') : (lang === 'ar' ? 'عرض المؤرشفة' : 'SHOW ARCHIVED')}
          </Text>
        </Pressable>
      </ScreenScroll>

      {editing && (
        <EditDebtSheet
          visible={!!editing}
          onClose={() => setEditing(null)}
          initial={editing === 'new' ? null : editing}
          defaultCurrency={profile?.currency ?? 'EGP'}
          onSave={onSave}
          onArchive={editing !== 'new' ? () => onArchive(editing) : undefined}
          onPaymentsChanged={load}
        />
      )}
    </PlanScreen>
  );
}

function Empty({ text, sub, cta, onCta }: { text: string; sub: string; cta?: string; onCta?: () => void }) {
  const { tok, lang } = useI18n();
  return (
    <View style={{ paddingTop: 40, alignItems: 'center' }}>
      <Text style={{
        color: tok.bone, fontFamily: fontBody(lang, 'medium'), fontSize: 16,
        textAlign: 'center',
      }}>{text}</Text>
      <Text style={{
        marginTop: 6, color: tok.muted, fontFamily: fontBody(lang), fontSize: 13,
        textAlign: 'center', maxWidth: 280, lineHeight: 19,
      }}>{sub}</Text>
      {cta && onCta ? <View style={{ marginTop: 14 }}><RButton onPress={onCta}>{cta}</RButton></View> : null}
    </View>
  );
}

function DebtRow({ debt, onPress }: { debt: Debt; onPress: () => void }) {
  const { tok, lang } = useI18n();
  const remaining = Math.max(0, debt.totalAmount - debt.paidAmount);
  const pct = debt.totalAmount > 0 ? (debt.paidAmount / debt.totalAmount) * 100 : 0;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <RCard padding={16}>
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          justifyContent: 'space-between', alignItems: 'baseline',
        }}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1, color: tok.bone, fontFamily: fontBody(lang, 'medium'), fontSize: 15,
              textAlign: lang === 'ar' ? 'right' : 'left',
            }}
          >{debt.creditor}</Text>
          <Text style={{
            color: tok.alertText, fontFamily: fontMono('medium'), fontSize: 14, writingDirection: 'ltr',
          }}>
            −{formatAmount(remaining, { decimals: 0 })} {currencyLabel(debt.currency, lang)}
          </Text>
        </View>
        <Text style={{
          marginTop: 4, color: tok.muted, fontFamily: fontMono('regular'), fontSize: 11,
          textAlign: lang === 'ar' ? 'right' : 'left', writingDirection: 'ltr',
        }}>
          {formatAmount(debt.paidAmount, { decimals: 0 })} / {formatAmount(debt.totalAmount, { decimals: 0 })} {lang === 'ar' ? 'مسدَّد' : 'paid'}
        </Text>
        <View style={{ marginTop: 10 }}>
          <RProgress value={pct} max={100} color={tok.posText} height={3} />
        </View>
      </RCard>
    </Pressable>
  );
}

function EditDebtSheet({
  visible, onClose, onSave, onArchive, initial, defaultCurrency, onPaymentsChanged,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (d: Partial<Debt>) => Promise<void>;
  onArchive?: () => Promise<void>;
  initial: Debt | null;
  defaultCurrency: string;
  onPaymentsChanged: () => void;
}) {
  const { tok, lang, t } = useI18n();
  const [creditor, setCreditor] = useState(initial?.creditor ?? '');
  const [total, setTotal] = useState(initial ? String(initial.totalAmount) : '');
  const [paid, setPaid] = useState(initial ? String(initial.paidAmount) : '');
  const [busy, setBusy] = useState(false);

  // Payment history — only meaningful once the debt already exists.
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  // What the entry is: a payment (owe less) or an increase (borrowed more), and whether to also log it as a transaction.
  const [entryKind, setEntryKind] = useState<'payment' | 'increase'>('payment');
  const [alsoTransaction, setAlsoTransaction] = useState(false);

  useEffect(() => {
    if (!visible || !initial) { setPayments([]); return; }
    let alive = true;
    setPaymentsLoading(true);
    apiFetch<{ data: DebtPayment[] }>(`/debts/${initial._id}/payments`)
      .then((r) => { if (alive) setPayments(r.data); })
      .catch(() => { /* keep silent — this is secondary info */ })
      .finally(() => { if (alive) setPaymentsLoading(false); });
    return () => { alive = false; };
  }, [visible, initial]);

  const addPayment = async () => {
    const amount = parseFloat(payAmount);
    if (!initial || !amount || amount <= 0 || payBusy) return;
    setPayBusy(true);
    try {
      const res = await apiFetch<{ data: { payment: DebtPayment; debt: Debt } }>(`/debts/${initial._id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ amount, kind: entryKind, asTransaction: alsoTransaction }),
        idempotencyKey: newIdempotencyKey(),
      });
      setPayments((cur) => [res.data.payment, ...cur]);
      setPaid(String(res.data.debt.paidAmount));
      setTotal(String(res.data.debt.totalAmount));
      setPayAmount('');
      onPaymentsChanged();
    } finally {
      setPayBusy(false);
    }
  };

  const deletePayment = async (paymentId: string) => {
    if (!initial) return;
    const res = await apiFetch<{ data: { debt: Debt } }>(`/debts/${initial._id}/payments/${paymentId}`, { method: 'DELETE' });
    setPayments((cur) => cur.filter((p) => p._id !== paymentId));
    setPaid(String(res.data.debt.paidAmount));
    setTotal(String(res.data.debt.totalAmount));
    onPaymentsChanged();
  };

  useEffect(() => {
    if (visible) {
      setCreditor(initial?.creditor ?? '');
      setTotal(initial ? String(initial.totalAmount) : '');
      setPaid(initial ? String(initial.paidAmount) : '');
    }
  }, [visible, initial]);

  const translate = useRef(new Animated.Value(800)).current;
  const overlay = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(translate, { toValue: visible ? 0 : 800, duration: DURATION.base, easing: Easing.bezier(...EASE.out), useNativeDriver: true }),
      Animated.timing(overlay, { toValue: visible ? 1 : 0, duration: DURATION.fast, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  const totalNum = parseFloat(total) || 0;
  const paidNum = parseFloat(paid) || 0;
  const canSave = !!creditor.trim() && totalNum > 0 && !busy;

  const submit = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await onSave({
        creditor: creditor.trim(),
        totalAmount: totalNum,
        paidAmount: paidNum,
        currency: defaultCurrency,
      });
    } finally { setBusy(false); }
  };

  const kbHeight = useKeyboardHeight();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <Animated.View
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', opacity: overlay }}
          pointerEvents={visible ? 'auto' : 'none'}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>
        <Animated.View style={{
          backgroundColor: tok.void,
          borderTopLeftRadius: radius.modal, borderTopRightRadius: radius.modal,
          borderTopWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
          paddingBottom: 26 + insets.bottom,
          marginBottom: kbHeight,
          paddingTop: kbHeight > 0 ? insets.top : 0,
          transform: [{ translateY: translate }],
        }}>
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: tok.borderHi, opacity: 0.6 }} />
          </View>
          <View style={{
            flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
            justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: 18, paddingVertical: 6,
          }}>
            <REyebrow>{initial ? (lang === 'ar' ? 'تعديل الدين' : 'Edit debt') : (lang === 'ar' ? 'دين جديد' : 'New debt')}</REyebrow>
            <Pressable onPress={onClose} hitSlop={8}><X size={20} color={tok.muted} /></Pressable>
          </View>
          <View style={{ paddingHorizontal: 22, paddingTop: 6, gap: 14 }}>
            <RField label={lang === 'ar' ? 'الدائن' : 'Creditor'} value={creditor} onChange={setCreditor} placeholder={lang === 'ar' ? 'مثلاً: البنك' : 'e.g. The Bank'} autoFocus />
            {initial ? (
              // Existing debt: the amounts are read-only. Change them with a payment or "Add to debt" below, so every change has a record.
              <View style={{ flexDirection: lang === 'ar' ? 'row-reverse' : 'row', gap: 12 }}>
                {[
                  { label: lang === 'ar' ? 'إجمالي الدين' : 'Total owed', v: totalNum },
                  { label: lang === 'ar' ? 'المسدَّد' : 'Paid so far', v: paidNum },
                  { label: lang === 'ar' ? 'المتبقي' : 'Remaining', v: Math.max(0, totalNum - paidNum) },
                ].map((x) => (
                  <View key={x.label} style={{ flex: 1 }}>
                    <REyebrow>{x.label}</REyebrow>
                    <Text style={{ marginTop: 4, color: tok.bone, fontFamily: fontMono('regular'), fontSize: 16, writingDirection: 'ltr' }}>
                      {formatAmount(x.v, { decimals: 0 })}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <>
                <RField label={lang === 'ar' ? 'إجمالي الدين' : 'Total amount'} value={total} onChange={(v) => setTotal(v.replace(/[^0-9.]/g, ''))} placeholder="0" keyboardType="decimal-pad" mono />
                <RField label={lang === 'ar' ? 'المسدَّد' : 'Paid so far'} value={paid} onChange={(v) => setPaid(v.replace(/[^0-9.]/g, ''))} placeholder="0" keyboardType="decimal-pad" mono />
              </>
            )}
          </View>

          {initial && (
            <View style={{ paddingHorizontal: 22, paddingTop: 18, gap: 10 }}>
              <REyebrow>{lang === 'ar' ? 'سجل الدفعات والزيادات' : 'Payments & additions'}</REyebrow>
              <View style={{ flexDirection: lang === 'ar' ? 'row-reverse' : 'row', gap: 8 }}>
                {(['payment', 'increase'] as const).map((k) => (
                  <Pressable
                    key={k}
                    onPress={() => setEntryKind(k)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1,
                      borderColor: entryKind === k ? tok.gold : tok.border,
                      backgroundColor: entryKind === k ? 'rgba(201,168,76,0.14)' : 'transparent',
                    }}
                  >
                    <Text style={{ fontFamily: fontMono('regular'), fontSize: 11, letterSpacing: 1, color: entryKind === k ? tok.gold : tok.muted, textTransform: 'uppercase' }}>
                      {k === 'payment' ? (lang === 'ar' ? 'دفعة' : 'Payment') : (lang === 'ar' ? 'إضافة للدين' : 'Add to debt')}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: lang === 'ar' ? 'row-reverse' : 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <RField
                    value={payAmount}
                    onChange={(v) => setPayAmount(v.replace(/[^0-9.]/g, ''))}
                    placeholder={entryKind === 'payment' ? (lang === 'ar' ? 'مبلغ الدفعة' : 'Payment amount') : (lang === 'ar' ? 'المبلغ المضاف' : 'Amount added')}
                    keyboardType="decimal-pad"
                    mono
                  />
                </View>
                <RButton onPress={addPayment} disabled={!payAmount || parseFloat(payAmount) <= 0 || payBusy} loading={payBusy}>
                  {lang === 'ar' ? 'سجّل' : 'Record'}
                </RButton>
              </View>
              <View style={{ flexDirection: lang === 'ar' ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <Text style={{ flex: 1, color: tok.muted, fontFamily: fontBody(lang), fontSize: 12.5, textAlign: lang === 'ar' ? 'right' : 'left' }}>
                  {entryKind === 'payment'
                    ? (lang === 'ar' ? 'سجّلها أيضاً كمصروف' : 'Also record as an expense')
                    : (lang === 'ar' ? 'سجّلها أيضاً كدخل (مبلغ استلمته)' : 'Also record as income (money received)')}
                </Text>
                <Switch value={alsoTransaction} onValueChange={setAlsoTransaction} trackColor={{ true: tok.gold, false: tok.border }} />
              </View>

              {paymentsLoading ? (
                <SkeletonRow />
              ) : payments.length === 0 ? (
                <Text style={{ color: tok.muted, fontFamily: fontMono('regular'), fontSize: 12 }}>
                  {lang === 'ar' ? 'لا توجد دفعات مسجَّلة بعد.' : 'No payments recorded yet.'}
                </Text>
              ) : (
                <View style={{ gap: 2 }}>
                  {payments.map((p) => (
                    <View
                      key={p._id}
                      style={{
                        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                        justifyContent: 'space-between', alignItems: 'center',
                        paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
                      }}
                    >
                      <View>
                        <Text style={{ color: tok.bone, fontFamily: fontBody(lang, 'medium'), fontSize: 13.5, writingDirection: 'ltr' }}>
                          {p.kind === 'increase' ? '+ ' : ''}{formatAmount(p.amount, { decimals: 0 })} {currencyLabel(p.currency, lang)}
                          <Text style={{ color: tok.muted, fontFamily: fontMono('regular'), fontSize: 11 }}>
                            {'  '}{p.kind === 'increase' ? (lang === 'ar' ? 'إضافة' : 'added') : (lang === 'ar' ? 'دفعة' : 'payment')}
                          </Text>
                        </Text>
                        <Text style={{ color: tok.muted, fontFamily: fontMono('regular'), fontSize: 11, marginTop: 2 }}>
                          {new Date(p.date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                      </View>
                      <Pressable onPress={() => deletePayment(p._id)} hitSlop={8}>
                        <Trash2 size={15} color={tok.alertText} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={{ paddingHorizontal: 18, paddingTop: 18, gap: 10 }}>
            <RButton full onPress={submit} disabled={!canSave} loading={busy}>
              {busy ? (lang === 'ar' ? 'جارٍ الحفظ…' : 'Saving…') : t('save')}
            </RButton>
            {onArchive && (
              <RButton
                full
                variant="secondary"
                onPress={async () => { setBusy(true); try { await onArchive(); } finally { setBusy(false); } }}
                icon={initial?.archivedAt ? <ArchiveRestore size={16} color={tok.bone} /> : <Archive size={16} color={tok.bone} />}
              >
                {initial?.archivedAt ? (lang === 'ar' ? 'استعادة الدين' : 'Restore debt') : (lang === 'ar' ? 'أرشفة الدين' : 'Archive debt')}
              </RButton>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
