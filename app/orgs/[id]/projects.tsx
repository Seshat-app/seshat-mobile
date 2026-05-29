import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet, RefreshControl, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Archive, Layers, Plus, X } from 'lucide-react-native';
import { PlanScreen } from '../../../components/PlanShell';
import { RCard, REyebrow, RButton } from '../../../components/ui';
import { SkeletonRow } from '../../../components/Skeleton';
import { useI18n } from '../../../lib/i18n';
import { useAppData, type ApiProject } from '../../../lib/appData';
import { apiFetch, newIdempotencyKey } from '../../../lib/api';
import { fontBody, fontHead, fontMono } from '../../../lib/fonts';

// A small fixed palette so projects pick up a distinguishable color
// without us shipping a color wheel. Cycles through these in create order
// when the user doesn't pick one.
const PROJECT_PALETTE = ['#C9A84C', '#7AB7E8', '#E87A9B', '#7AE89E', '#B17AE8', '#E8B17A'];

type ProjectWithBudget = ApiProject & { _totalsLoading?: boolean };

export default function OrgProjectsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tok, lang } = useI18n();
  const { activeLedgerId, refreshProjects } = useAppData();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<ProjectWithBudget[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [budgetStr, setBudgetStr] = useState('');

  const expectedLedgerId = useMemo(() => (id ? `o_${id}` : null), [id]);
  const onCorrectLedger = activeLedgerId === expectedLedgerId;

  const load = useCallback(async (mode: 'first' | 'refresh' = 'first') => {
    if (mode === 'first') setLoading(true); else setRefreshing(true);
    try {
      const res = await apiFetch<{ data: ApiProject[] }>(`/projects?status=${showArchived ? 'archived' : 'active'}`);
      setItems(res.data ?? []);
    } catch (err) {
      console.warn('load projects failed', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showArchived]);

  useEffect(() => { load('first'); }, [load]);

  const submitCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const budgetNum = budgetStr.trim() ? parseFloat(budgetStr) : undefined;
    if (budgetNum !== undefined && (Number.isNaN(budgetNum) || budgetNum < 0)) {
      Alert.alert(
        lang === 'ar' ? 'ميزانية غير صالحة' : 'Invalid budget',
        lang === 'ar' ? 'لازم تكون رقم موجب.' : 'Must be a non-negative number.',
      );
      return;
    }
    setCreating(true);
    try {
      const color = PROJECT_PALETTE[items.length % PROJECT_PALETTE.length];
      await apiFetch('/projects', {
        method: 'POST',
        body: JSON.stringify({ name: trimmed, budget: budgetNum, color }),
        idempotencyKey: newIdempotencyKey(),
      });
      setName('');
      setBudgetStr('');
      await load('refresh');
      await refreshProjects();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert(
        lang === 'ar' ? 'فشل' : 'Failed',
        message.includes('CONFLICT')
          ? (lang === 'ar' ? 'اسم المشروع موجود بالفعل.' : 'A project with that name already exists.')
          : message,
      );
    } finally {
      setCreating(false);
    }
  };

  const toggleArchived = async (p: ProjectWithBudget) => {
    const nextStatus = p.status === 'active' ? 'archived' : 'active';
    try {
      await apiFetch(`/projects/${p._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      await load('refresh');
      await refreshProjects();
    } catch (err) {
      Alert.alert(lang === 'ar' ? 'فشل' : 'Failed', err instanceof Error ? err.message : String(err));
    }
  };

  const editBudget = (p: ProjectWithBudget) => {
    Alert.prompt(
      lang === 'ar' ? `ميزانية ${p.name}` : `Budget for ${p.name}`,
      lang === 'ar' ? 'سيب فاضي عشان تشيل الحد' : 'Leave empty to remove the cap',
      [
        { text: lang === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'ar' ? 'حفظ' : 'Save',
          onPress: async (value?: string) => {
            const trimmed = (value ?? '').trim();
            const next = trimmed === '' ? null : parseFloat(trimmed);
            if (next !== null && (Number.isNaN(next) || next < 0)) {
              Alert.alert(lang === 'ar' ? 'ميزانية غير صالحة' : 'Invalid');
              return;
            }
            try {
              await apiFetch(`/projects/${p._id}`, {
                method: 'PATCH',
                body: JSON.stringify({ budget: next }),
              });
              await load('refresh');
              await refreshProjects();
            } catch (err) {
              Alert.alert(lang === 'ar' ? 'فشل' : 'Failed', err instanceof Error ? err.message : String(err));
            }
          },
        },
      ],
      'plain-text',
      p.budget != null ? String(p.budget) : '',
      'numeric',
    );
  };

  return (
    <PlanScreen
      title={lang === 'ar' ? 'المشاريع' : 'Projects'}
      subtitle={lang === 'ar' ? 'مصاريف وأرباح لكل مشروع' : 'Per-project income, spend, and net'}
      refreshing={refreshing}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 140 }}
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
          {!onCorrectLedger ? (
            <View style={{ padding: 18 }}>
              <Text style={{
                color: tok.muted, fontFamily: fontBody(lang), fontSize: 13,
                textAlign: lang === 'ar' ? 'right' : 'left',
              }}>
                {lang === 'ar'
                  ? 'افتح هذه المنظمة من قائمة المساحات لإدارة مشاريعها.'
                  : 'Open this organization from the workspace switcher to manage its projects.'}
              </Text>
            </View>
          ) : (
            <>
              {/* Create form */}
              <REyebrow>{lang === 'ar' ? 'مشروع جديد' : 'NEW PROJECT'}</REyebrow>
              <RCard padding={14} style={{ marginBottom: 18 }}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={lang === 'ar' ? 'اسم المشروع' : 'Project name'}
                  placeholderTextColor={tok.muted}
                  style={{
                    color: tok.bone, fontFamily: fontBody(lang),
                    fontSize: 15, paddingVertical: 10,
                    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tok.border,
                    textAlign: lang === 'ar' ? 'right' : 'left',
                  }}
                />
                <TextInput
                  value={budgetStr}
                  onChangeText={setBudgetStr}
                  placeholder={lang === 'ar' ? 'ميزانية (اختياري)' : 'Budget (optional)'}
                  placeholderTextColor={tok.muted}
                  keyboardType="numeric"
                  style={{
                    color: tok.bone, fontFamily: fontMono('regular'),
                    fontSize: 14, paddingVertical: 10,
                    textAlign: lang === 'ar' ? 'right' : 'left',
                  }}
                />
                <RButton full disabled={!name.trim() || creating} onPress={submitCreate}>
                  <View style={{
                    flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                    alignItems: 'center', gap: 8,
                  }}>
                    <Plus size={16} color="#0D0D0D" />
                    <Text style={{ color: '#0D0D0D', fontFamily: fontBody(lang, 'semibold'), fontSize: 14 }}>
                      {creating
                        ? (lang === 'ar' ? 'يضيف…' : 'Adding…')
                        : (lang === 'ar' ? 'إضافة' : 'Add project')}
                    </Text>
                  </View>
                </RButton>
              </RCard>

              {/* List */}
              <View style={{
                flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 4, marginBottom: 6,
              }}>
                <REyebrow>
                  {showArchived
                    ? (lang === 'ar' ? 'مؤرشف' : 'ARCHIVED')
                    : (lang === 'ar' ? 'نشط' : 'ACTIVE')}
                </REyebrow>
                <Pressable onPress={() => setShowArchived((s) => !s)} hitSlop={6}>
                  <Text style={{
                    color: tok.muted, fontFamily: fontMono('regular'),
                    fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase',
                  }}>
                    {showArchived
                      ? (lang === 'ar' ? 'عرض النشط' : 'Show active')
                      : (lang === 'ar' ? 'عرض المؤرشف' : 'Show archived')}
                  </Text>
                </Pressable>
              </View>

              {loading ? (
                <RCard padding={18}>
                  {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
                </RCard>
              ) : items.length === 0 ? (
                <RCard padding={18}>
                  <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                    <Layers size={22} color={tok.muted} strokeWidth={1.4} />
                    <Text style={{
                      color: tok.muted, fontFamily: fontBody(lang),
                      fontSize: 13, textAlign: 'center',
                    }}>
                      {showArchived
                        ? (lang === 'ar' ? 'مفيش مشاريع مؤرشفة.' : 'No archived projects yet.')
                        : (lang === 'ar' ? 'اضف أول مشروع فوق.' : 'Add your first project above.')}
                    </Text>
                  </View>
                </RCard>
              ) : (
                <RCard padding={0} style={{ paddingHorizontal: 16, marginBottom: 18 }}>
                  {items.map((p, i) => (
                    <View
                      key={p._id}
                      style={{
                        paddingVertical: 14,
                        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                        alignItems: 'center', gap: 12,
                        borderBottomWidth: i < items.length - 1 ? StyleSheet.hairlineWidth : 0,
                        borderBottomColor: tok.border,
                      }}
                    >
                      <View style={{
                        width: 10, height: 10, borderRadius: 5,
                        backgroundColor: p.color ?? tok.gold,
                      }} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          numberOfLines={1}
                          style={{
                            fontFamily: fontHead(lang), fontSize: 15, color: tok.bone,
                            textAlign: lang === 'ar' ? 'right' : 'left',
                          }}
                        >
                          {p.name}
                        </Text>
                        <Pressable onPress={() => editBudget(p)} hitSlop={4}>
                          <Text
                            style={{
                              marginTop: 2,
                              fontFamily: fontMono('regular'), fontSize: 10,
                              color: tok.muted, letterSpacing: 1.2,
                              textAlign: lang === 'ar' ? 'right' : 'left',
                            }}
                          >
                            {p.budget != null
                              ? `${lang === 'ar' ? 'ميزانية' : 'BUDGET'} · ${p.budget.toLocaleString()} ${p.currency}`
                              : (lang === 'ar' ? 'اضغط لإضافة ميزانية' : 'TAP TO SET BUDGET')}
                          </Text>
                        </Pressable>
                      </View>
                      <Pressable onPress={() => toggleArchived(p)} hitSlop={8} style={{ padding: 6 }}>
                        {p.status === 'active'
                          ? <Archive size={16} color={tok.muted} strokeWidth={1.5} />
                          : <Text style={{
                              color: tok.gold, fontFamily: fontMono('regular'),
                              fontSize: 10, letterSpacing: 1.2,
                            }}>
                              {lang === 'ar' ? 'استرجع' : 'RESTORE'}
                            </Text>}
                      </Pressable>
                    </View>
                  ))}
                </RCard>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </PlanScreen>
  );
}
