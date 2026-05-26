import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, Animated, TextInput, Platform, StyleSheet, RefreshControl } from 'react-native';
import { Trash2, X } from 'lucide-react-native';
import { apiFetch, hasToken, newIdempotencyKey } from '../lib/api';
import { useI18n, currencyLabel, formatAmount } from '../lib/i18n';
import { useAppData } from '../lib/appData';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { RCard, REyebrow, RButton, RProgress, RPill, RStatus, RHScroll } from '../components/ui';
import { PlanScreen } from '../components/PlanShell';
import { SkeletonRow, Skeleton } from '../components/Skeleton';
import { CategoryIcon } from '../components/icons';
import { catIdFromName, catLabel } from '../lib/categoryMap';
import { useKeyboardHeight } from '../components/useKeyboardHeight';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ApiCategory } from '../components/AddTransactionSheet';

type Budget = {
  _id: string;
  categoryId: { _id: string; nameEn: string; nameAr?: string; emoji?: string } | string;
  amount: number;
  currency: string;
  spent?: number;
  percent?: number;
  status?: 'on-track' | 'near' | 'over';
};

export default function BudgetsScreen() {
  const { tok, lang, t } = useI18n();
  const { categories, profile } = useAppData();
  const [items, setItems] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<{ categoryId: string; amount?: number; budgetId?: string } | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!(await hasToken())) return;
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    try {
      const res = await apiFetch<{ data: Budget[] }>('/budgets');
      setItems(res.data);
    } catch (err) { console.warn('budgets load', err); }
    finally {
      if (mode === 'initial') setLoading(false);
      else setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const budgetByCat = useMemo(() => {
    const m = new Map<string, Budget>();
    for (const b of items) {
      const cid = typeof b.categoryId === 'string' ? b.categoryId : b.categoryId._id;
      m.set(cid, b);
    }
    return m;
  }, [items]);

  const onSave = async (categoryId: string, amount: number) => {
    await apiFetch('/budgets', {
      method: 'POST',
      body: JSON.stringify({ categoryId, amount, currency: profile?.currency ?? 'EGP' }),
      idempotencyKey: newIdempotencyKey(),
    });
    await load();
    setEditing(null);
  };

  const onDelete = async (budgetId: string) => {
    await apiFetch(`/budgets/${budgetId}`, { method: 'DELETE' });
    await load();
    setEditing(null);
  };

  return (
    <PlanScreen
      title={lang === 'ar' ? 'الميزانيات' : 'Budgets'}
      subtitle={lang === 'ar' ? 'حد شهري لكل فئة' : 'A monthly cap per category'}
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
          <RCard padding={18}>
            {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
          </RCard>
        ) : (
          <View style={{ gap: 10 }}>
            {categories.length === 0 ? (
              <Text style={{
                color: tok.muted, fontFamily: fontBody(lang), fontSize: 14,
                textAlign: 'center', marginTop: 40,
              }}>
                {lang === 'ar' ? 'لا توجد فئات بعد.' : 'No categories yet.'}
              </Text>
            ) : (
              categories.map((c) => {
                const id = catIdFromName(c.nameEn);
                const b = budgetByCat.get(c._id);
                return (
                  <BudgetRow
                    key={c._id}
                    cat={c}
                    catIconId={id}
                    budget={b}
                    onPress={() => setEditing({
                      categoryId: c._id,
                      amount: b?.amount,
                      budgetId: b?._id,
                    })}
                  />
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {editing && (
        <EditSheet
          visible={!!editing}
          onClose={() => setEditing(null)}
          initialAmount={editing.amount}
          categoryLabel={catLabel(categories.find((c) => c._id === editing.categoryId), lang)}
          currency={profile?.currency ?? 'EGP'}
          onSave={(amount) => onSave(editing.categoryId, amount)}
          onDelete={editing.budgetId ? () => onDelete(editing.budgetId!) : undefined}
        />
      )}
    </PlanScreen>
  );
}

function BudgetRow({
  cat, catIconId, budget, onPress,
}: { cat: ApiCategory; catIconId: any; budget?: Budget; onPress: () => void }) {
  const { tok, lang } = useI18n();
  const set = !!budget;
  const pct = budget?.percent ?? 0;
  const status = budget?.status ?? 'on-track';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <RCard padding={16}>
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          alignItems: 'center', gap: 12,
        }}>
          <View style={{
            width: 44, height: 44, borderRadius: 12,
            backgroundColor: tok.elevated,
            borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <CategoryIcon cat={catIconId} size={22} color={tok.bone} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fontBody(lang, 'medium'), fontSize: 14, color: tok.bone,
                textAlign: lang === 'ar' ? 'right' : 'left',
              }}
            >{lang === 'ar' && cat.nameAr ? cat.nameAr : cat.nameEn}</Text>
            {set ? (
              <Text style={{
                marginTop: 3, color: tok.muted, fontFamily: fontMono('regular'), fontSize: 11,
                textAlign: lang === 'ar' ? 'right' : 'left', writingDirection: 'ltr',
              }}>
                {formatAmount(budget!.spent ?? 0, { decimals: 0 })} / {formatAmount(budget!.amount, { decimals: 0 })} {currencyLabel(budget!.currency, lang)}
              </Text>
            ) : (
              <Text style={{
                marginTop: 3, color: tok.muted, fontFamily: fontBody(lang), fontSize: 12,
                textAlign: lang === 'ar' ? 'right' : 'left',
              }}>{lang === 'ar' ? 'لم تُحدّد' : 'Not set — tap to add'}</Text>
            )}
          </View>
          {set && (
            <RStatus kind={status === 'over' ? 'alert' : status === 'near' ? 'warning' : 'positive'}>
              {status === 'over' ? (lang === 'ar' ? 'تجاوز' : 'over') : status === 'near' ? (lang === 'ar' ? 'قرب الحد' : 'near') : (lang === 'ar' ? 'في المسار' : 'on track')}
            </RStatus>
          )}
        </View>
        {set && (
          <View style={{ marginTop: 12 }}>
            <RProgress
              value={Math.min(pct, 100)}
              max={100}
              color={status === 'over' ? tok.alertText : status === 'near' ? tok.warnText : tok.gold}
              height={3}
            />
          </View>
        )}
      </RCard>
    </Pressable>
  );
}

function EditSheet({
  visible, onClose, onSave, onDelete, initialAmount, categoryLabel, currency,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (amount: number) => Promise<void>;
  onDelete?: () => Promise<void>;
  initialAmount?: number;
  categoryLabel: string;
  currency: string;
}) {
  const { tok, lang, t } = useI18n();
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : '');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (visible) setAmount(initialAmount ? String(initialAmount) : '');
  }, [visible, initialAmount]);

  const translate = useRef(new Animated.Value(800)).current;
  const overlay = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(translate, { toValue: visible ? 0 : 800, duration: 320, useNativeDriver: true }),
      Animated.timing(overlay, { toValue: visible ? 1 : 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  const numeric = parseFloat(amount.replace(/,/g, '')) || 0;
  const canSave = numeric > 0 && !busy;

  const submit = async () => {
    if (!canSave) return;
    setBusy(true);
    try { await onSave(numeric); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!onDelete) return;
    setBusy(true);
    try { await onDelete(); } finally { setBusy(false); }
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
          // Manual keyboard avoidance — KAV is unreliable inside <Modal> on iOS.
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
            <REyebrow>{categoryLabel}</REyebrow>
            <Pressable onPress={onClose} hitSlop={8}><X size={20} color={tok.muted} /></Pressable>
          </View>
          <View style={{ paddingHorizontal: 22, paddingTop: 10 }}>
            <Text style={{
              fontFamily: fontHead(lang), fontSize: 20, color: tok.bone, letterSpacing: -0.4,
              textAlign: lang === 'ar' ? 'right' : 'left',
            }}>{lang === 'ar' ? 'الحد الشهري' : 'Monthly cap'}</Text>
            <View style={{ marginTop: 18, marginBottom: 10, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 10 }}>
              <TextInput
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
                placeholder="0"
                placeholderTextColor={tok.muted}
                keyboardType="decimal-pad"
                autoFocus
                style={{
                  color: tok.bone, fontFamily: fontMono('medium'), fontSize: 44,
                  letterSpacing: -1, padding: 0, minWidth: 80, textAlign: 'center', writingDirection: 'ltr',
                }}
              />
              <Text style={{ color: tok.muted, fontFamily: fontMono('regular'), fontSize: 16 }}>
                {currencyLabel(currency, lang)}
              </Text>
            </View>
          </View>
          <View style={{ paddingHorizontal: 18, paddingTop: 16, gap: 10 }}>
            <RButton full onPress={submit} disabled={!canSave}>
              {busy ? (lang === 'ar' ? 'جارٍ الحفظ…' : 'Saving…') : t('save')}
            </RButton>
            {onDelete && (
              <RButton full variant="destructive" onPress={remove} icon={<Trash2 size={16} color={tok.alertText} />}>
                {lang === 'ar' ? 'حذف الميزانية' : 'Delete budget'}
              </RButton>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
