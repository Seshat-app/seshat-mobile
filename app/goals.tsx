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

type Goal = {
  _id: string;
  nameEn: string;
  nameAr: string;
  targetAmount: number;
  savedAmount: number;
  currency: string;
  deadline?: string;
};

export default function GoalsScreen() {
  const { tok, lang, t } = useI18n();
  const { profile } = useAppData();
  const [items, setItems] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!(await hasToken())) return;
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    try {
      const res = await apiFetch<{ data: Goal[] }>('/goals');
      setItems(res.data);
    } catch (err) { console.warn('goals load', err); }
    finally {
      if (mode === 'initial') setLoading(false);
      else setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onSave = async (g: Partial<Goal>) => {
    if (editing && editing !== 'new') {
      await apiFetch(`/goals/${editing._id}`, { method: 'PATCH', body: JSON.stringify(g) });
    } else {
      await apiFetch('/goals', {
        method: 'POST',
        body: JSON.stringify({
          nameEn: g.nameEn,
          nameAr: g.nameAr ?? g.nameEn,
          targetAmount: g.targetAmount,
          savedAmount: g.savedAmount ?? 0,
          currency: g.currency ?? profile?.currency ?? 'EGP',
        }),
        idempotencyKey: newIdempotencyKey(),
      });
    }
    await load();
    setEditing(null);
  };

  const onDelete = async (id: string) => {
    await apiFetch(`/goals/${id}`, { method: 'DELETE' });
    await load();
    setEditing(null);
  };

  return (
    <PlanScreen
      title={lang === 'ar' ? 'الأهداف' : 'Goals'}
      subtitle={lang === 'ar' ? 'ما الذي تدّخر له' : 'What you are saving toward'}
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
          <EmptyState text={lang === 'ar' ? 'لم تُسجَّل أهداف بعد.' : 'No goals yet.'} sub={lang === 'ar' ? 'أضف هدفاً ليبدأ سيشات في التتبع.' : 'Add a goal and Seshat begins tracking.'} />
        ) : (
          <View style={{ gap: 10 }}>
            {items.map((g) => <GoalRow key={g._id} goal={g} onPress={() => setEditing(g)} />)}
          </View>
        )}
      </ScrollView>

      {editing && (
        <EditGoalSheet
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

function EmptyState({ text, sub }: { text: string; sub: string }) {
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

function GoalRow({ goal, onPress }: { goal: Goal; onPress: () => void }) {
  const { tok, lang } = useI18n();
  const pct = goal.targetAmount > 0 ? Math.min(100, (goal.savedAmount / goal.targetAmount) * 100) : 0;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <RCard padding={16}>
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          justifyContent: 'space-between', alignItems: 'baseline',
        }}>
          <Text style={{
            flex: 1, color: tok.bone, fontFamily: fontBody(lang, 'medium'), fontSize: 15,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>{lang === 'ar' ? goal.nameAr : goal.nameEn}</Text>
          <Text style={{
            color: tok.gold, fontFamily: fontMono('medium'), fontSize: 13, writingDirection: 'ltr',
          }}>
            {pct.toFixed(0)}%
          </Text>
        </View>
        <Text style={{
          marginTop: 4, color: tok.muted, fontFamily: fontMono('regular'), fontSize: 11,
          textAlign: lang === 'ar' ? 'right' : 'left', writingDirection: 'ltr',
        }}>
          {formatAmount(goal.savedAmount, { decimals: 0 })} / {formatAmount(goal.targetAmount, { decimals: 0 })} {currencyLabel(goal.currency, lang)}
        </Text>
        <View style={{ marginTop: 10 }}>
          <RProgress value={pct} max={100} color={tok.gold} height={3} />
        </View>
      </RCard>
    </Pressable>
  );
}

function EditGoalSheet({
  visible, onClose, onSave, onDelete, initial, defaultCurrency,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (g: Partial<Goal>) => Promise<void>;
  onDelete?: () => Promise<void>;
  initial: Goal | null;
  defaultCurrency: string;
}) {
  const { tok, lang, t } = useI18n();
  const [name, setName] = useState(initial?.nameEn ?? '');
  const [target, setTarget] = useState(initial ? String(initial.targetAmount) : '');
  const [saved, setSaved] = useState(initial ? String(initial.savedAmount) : '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(initial?.nameEn ?? '');
      setTarget(initial ? String(initial.targetAmount) : '');
      setSaved(initial ? String(initial.savedAmount) : '');
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

  const targetNum = parseFloat(target) || 0;
  const savedNum = parseFloat(saved) || 0;
  const canSave = !!name.trim() && targetNum > 0 && !busy;

  const submit = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await onSave({
        nameEn: name.trim(),
        nameAr: name.trim(),
        targetAmount: targetNum,
        savedAmount: savedNum,
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
            <REyebrow>{initial ? (lang === 'ar' ? 'تعديل الهدف' : 'Edit goal') : (lang === 'ar' ? 'هدف جديد' : 'New goal')}</REyebrow>
            <Pressable onPress={onClose} hitSlop={8}><X size={20} color={tok.muted} /></Pressable>
          </View>
          <View style={{ paddingHorizontal: 22, paddingTop: 6, gap: 14 }}>
            <Field label={lang === 'ar' ? 'الاسم' : 'Name'} value={name} onChange={setName} placeholder={lang === 'ar' ? 'مثلاً: سفر' : 'e.g. Trip'} autoFocus />
            <Field label={lang === 'ar' ? 'المبلغ المستهدف' : 'Target amount'} value={target} onChange={(v) => setTarget(v.replace(/[^0-9.]/g, ''))} placeholder="0" numeric />
            <Field label={lang === 'ar' ? 'المُدخر' : 'Saved so far'} value={saved} onChange={(v) => setSaved(v.replace(/[^0-9.]/g, ''))} placeholder="0" numeric />
          </View>
          <View style={{ paddingHorizontal: 18, paddingTop: 18, gap: 10 }}>
            <RButton full onPress={submit} disabled={!canSave}>
              {busy ? (lang === 'ar' ? 'جارٍ الحفظ…' : 'Saving…') : t('save')}
            </RButton>
            {onDelete && (
              <RButton full variant="destructive" onPress={async () => { setBusy(true); try { await onDelete(); } finally { setBusy(false); } }} icon={<Trash2 size={16} color={tok.alertText} />}>
                {lang === 'ar' ? 'حذف الهدف' : 'Delete goal'}
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
