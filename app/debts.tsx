import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, Animated, TextInput, Platform, StyleSheet, RefreshControl } from 'react-native';
import { useKeyboardHeight } from '../components/useKeyboardHeight';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash2, X } from 'lucide-react-native';
import { apiFetch, hasToken, newIdempotencyKey } from '../lib/api';
import { useI18n, currencyLabel, formatAmount } from '../lib/i18n';
import { useAppData } from '../lib/appData';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { RCard, REyebrow, RButton, RProgress } from '../components/ui';
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
};

export default function DebtsScreen() {
  const { tok, lang, t } = useI18n();
  const { profile } = useAppData();
  const [items, setItems] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Debt | 'new' | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!(await hasToken())) return;
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    try {
      const res = await apiFetch<{ data: Debt[] }>('/debts');
      setItems(res.data);
    } catch (err) { console.warn('debts load', err); }
    finally {
      if (mode === 'initial') setLoading(false);
      else setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onSave = async (d: Partial<Debt>) => {
    if (editing && editing !== 'new') {
      await apiFetch(`/debts/${editing._id}`, { method: 'PATCH', body: JSON.stringify(d) });
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

  const onDelete = async (id: string) => {
    await apiFetch(`/debts/${id}`, { method: 'DELETE' });
    await load();
    setEditing(null);
  };

  return (
    <PlanScreen
      title={lang === 'ar' ? 'الديون' : 'Debts'}
      subtitle={lang === 'ar' ? 'ما الذي تدين به' : 'What you still owe'}
      onAdd={() => setEditing('new')}
      refreshing={refreshing}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 8 }}
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
          <Empty text={lang === 'ar' ? 'لا توجد ديون.' : 'No debts. Stay that way.'} sub={lang === 'ar' ? 'إذا ظهر دين، سجّله هنا.' : 'If one shows up, log it here.'} />
        ) : (
          <View style={{ gap: 10 }}>
            {items.map((d) => <DebtRow key={d._id} debt={d} onPress={() => setEditing(d)} />)}
          </View>
        )}
      </ScrollView>

      {editing && (
        <EditDebtSheet
          visible={!!editing}
          onClose={() => setEditing(null)}
          initial={editing === 'new' ? null : editing}
          defaultCurrency={profile?.currency ?? 'EGP'}
          onSave={onSave}
          onDelete={editing !== 'new' ? () => onDelete(editing._id) : undefined}
        />
      )}
    </PlanScreen>
  );
}

function Empty({ text, sub }: { text: string; sub: string }) {
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
  visible, onClose, onSave, onDelete, initial, defaultCurrency,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (d: Partial<Debt>) => Promise<void>;
  onDelete?: () => Promise<void>;
  initial: Debt | null;
  defaultCurrency: string;
}) {
  const { tok, lang, t } = useI18n();
  const [creditor, setCreditor] = useState(initial?.creditor ?? '');
  const [total, setTotal] = useState(initial ? String(initial.totalAmount) : '');
  const [paid, setPaid] = useState(initial ? String(initial.paidAmount) : '');
  const [busy, setBusy] = useState(false);

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
      Animated.timing(translate, { toValue: visible ? 0 : 800, duration: 320, useNativeDriver: true }),
      Animated.timing(overlay, { toValue: visible ? 1 : 0, duration: 220, useNativeDriver: true }),
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
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          borderTopWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
          paddingBottom: 26,
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
            <Field label={lang === 'ar' ? 'الدائن' : 'Creditor'} value={creditor} onChange={setCreditor} placeholder={lang === 'ar' ? 'مثلاً: البنك' : 'e.g. The Bank'} autoFocus />
            <Field label={lang === 'ar' ? 'إجمالي الدين' : 'Total amount'} value={total} onChange={(v) => setTotal(v.replace(/[^0-9.]/g, ''))} placeholder="0" numeric />
            <Field label={lang === 'ar' ? 'المسدَّد' : 'Paid so far'} value={paid} onChange={(v) => setPaid(v.replace(/[^0-9.]/g, ''))} placeholder="0" numeric />
          </View>
          <View style={{ paddingHorizontal: 18, paddingTop: 18, gap: 10 }}>
            <RButton full onPress={submit} disabled={!canSave}>
              {busy ? (lang === 'ar' ? 'جارٍ الحفظ…' : 'Saving…') : t('save')}
            </RButton>
            {onDelete && (
              <RButton full variant="destructive" onPress={async () => { setBusy(true); try { await onDelete(); } finally { setBusy(false); } }} icon={<Trash2 size={16} color={tok.alertText} />}>
                {lang === 'ar' ? 'حذف الدين' : 'Delete debt'}
              </RButton>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Field({
  label, value, onChange, placeholder, numeric, autoFocus,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; numeric?: boolean; autoFocus?: boolean }) {
  const { tok, lang } = useI18n();
  return (
    <View>
      <REyebrow style={{ marginBottom: 6, textAlign: lang === 'ar' ? 'right' : 'left' }}>{label}</REyebrow>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={tok.muted}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        style={{
          backgroundColor: tok.surface,
          borderWidth: 1, borderColor: tok.border, borderRadius: 10,
          paddingHorizontal: 14, paddingVertical: 13,
          color: tok.bone, fontFamily: numeric ? fontMono('regular') : fontBody(lang), fontSize: 14,
          writingDirection: numeric ? 'ltr' : (lang === 'ar' ? 'rtl' : 'ltr'),
          textAlign: numeric ? 'left' : (lang === 'ar' ? 'right' : 'left'),
        }}
      />
    </View>
  );
}
