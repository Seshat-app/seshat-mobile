import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, RefreshControl, Alert, StyleSheet } from 'react-native';
import { ScrollView as ScreenScroll } from '../components/Scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash2, X } from 'lucide-react-native';
import { apiFetch, newIdempotencyKey } from '../lib/api';
import { useFetchList } from '../lib/hooks/useFetchList';
import { useI18n } from '../lib/i18n';
import { useAppData } from '../lib/appData';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { RCard, RButton, RField, RSegmented } from '../components/ui';
import { PlanScreen } from '../components/PlanShell';
import { SkeletonRow } from '../components/Skeleton';
import { useKeyboardHeight } from '../components/useKeyboardHeight';
import { CategoryIconByKey, CATEGORY_ICON_KEYS } from '../components/icons';
import { iconKeyForCategory } from '../lib/categoryMap';

type ApiCategory = {
  _id: string;
  nameEn: string;
  nameAr: string;
  emoji: string;
  icon?: string;
  type: 'income' | 'expense' | 'both';
  isDefault: boolean;
};

export default function CategoriesScreen() {
  const { tok, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const { bumpVersion } = useAppData();
  const { items, setItems, loading, refreshing, load } = useFetchList<ApiCategory>(
    () => apiFetch<{ data: ApiCategory[] }>('/categories').then((r) => r.data),
  );
  const [adding, setAdding] = useState(false);

  const onDelete = (cat: ApiCategory) => {
    if (cat.isDefault) return;
    Alert.alert(
      lang === 'ar' ? `حذف "${cat.nameAr}"؟` : `Delete "${cat.nameEn}"?`,
      lang === 'ar' ? 'المعاملات المربوطة بهذا التصنيف ستبقى لكنها ستظهر بدون اسم تصنيف.' : 'Transactions in this category stay logged but lose their category name.',
      [
        { text: lang === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'ar' ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiFetch(`/categories/${cat._id}`, { method: 'DELETE' });
              await load();
              bumpVersion();
            } catch (e) { console.warn('delete category', e); }
          },
        },
      ],
    );
  };

  return (
    <PlanScreen
      title={lang === 'ar' ? 'التصنيفات' : 'Categories'}
      subtitle={lang === 'ar' ? 'الافتراضية + ما أضفته' : 'Defaults + what you have added'}
      refreshing={refreshing}
      onAdd={() => setAdding(true)}
    >
      <ScreenScroll
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40, paddingTop: 8 }}
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
            {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
          </RCard>
        ) : (
          <RCard padding={0} style={{ paddingHorizontal: 18 }}>
            {items.map((cat, i) => (
              <Pressable
                key={cat._id}
                onLongPress={() => onDelete(cat)}
                delayLongPress={400}
                style={({ pressed }) => ({
                  paddingVertical: 16,
                  flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                  alignItems: 'center', gap: 14,
                  borderBottomWidth: i < items.length - 1 ? StyleSheet.hairlineWidth : 0,
                  borderBottomColor: tok.border,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View style={{
                  width: 42, height: 42, borderRadius: 12,
                  backgroundColor: tok.elevated,
                  borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <CategoryIconByKey iconKey={iconKeyForCategory(cat)} size={20} color={tok.bone} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: fontBody(lang, 'medium'), fontSize: 15, color: tok.bone,
                      textAlign: lang === 'ar' ? 'right' : 'left',
                    }}
                  >
                    {lang === 'ar' ? cat.nameAr : cat.nameEn}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: fontMono('regular'), fontSize: 10, color: tok.muted, letterSpacing: 1.2, marginTop: 3,
                      textAlign: lang === 'ar' ? 'right' : 'left',
                    }}
                  >
                    {cat.isDefault
                      ? (lang === 'ar' ? 'افتراضي' : 'DEFAULT')
                      : (lang === 'ar' ? 'مخصص' : 'CUSTOM')}
                    {'  ·  '}{cat.type.toUpperCase()}
                  </Text>
                </View>
                {/* Right-anchor on every row so the layout reads balanced.
                    Default rows show a muted "lock" indicator (you cannot
                    delete a default); custom rows get a tappable trash icon. */}
                <View style={{
                  width: 32, height: 32, borderRadius: 10,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: cat.isDefault ? 'transparent' : tok.elevated,
                }}>
                  {cat.isDefault ? (
                    <View style={{
                      width: 6, height: 6, borderRadius: 3,
                      backgroundColor: tok.border,
                    }} />
                  ) : (
                    <Pressable onPress={() => onDelete(cat)} hitSlop={10} style={{ padding: 6 }}>
                      <Trash2 size={16} color={tok.muted} />
                    </Pressable>
                  )}
                </View>
              </Pressable>
            ))}
          </RCard>
        )}

        {!loading && (
          <Text style={{
            fontFamily: fontMono('regular'), fontSize: 10, color: tok.muted, letterSpacing: 1.2,
            textAlign: 'center', marginTop: 18,
          }}>
            {lang === 'ar' ? 'اضغط مطوّلاً على تصنيف مخصص لحذفه' : 'LONG-PRESS A CUSTOM CATEGORY TO DELETE'}
          </Text>
        )}
      </ScreenScroll>

      <AddCategorySheet
        visible={adding}
        onClose={() => setAdding(false)}
        onCreated={() => { setAdding(false); load(); bumpVersion(); }}
      />
    </PlanScreen>
  );
}

function AddCategorySheet({
  visible, onClose, onCreated,
}: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const { tok, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [iconKey, setIconKey] = useState<string>('other');
  const [type, setType] = useState<'expense' | 'income' | 'both'>('expense');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (visible) {
      setNameEn(''); setNameAr(''); setIconKey('other');
      setType('expense'); setErr('');
    }
  }, [visible]);

  const submit = async () => {
    if (!nameEn.trim() || !nameAr.trim()) {
      setErr(lang === 'ar' ? 'الاسمان مطلوبان' : 'Both names are required');
      return;
    }
    setSaving(true); setErr('');
    try {
      await apiFetch('/categories', {
        method: 'POST',
        body: JSON.stringify({
          nameEn: nameEn.trim(),
          nameAr: nameAr.trim(),
          icon: iconKey,
          type,
        }),
        idempotencyKey: newIdempotencyKey(),
      });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#000A' }} onPress={onClose}>
        <View style={{ flex: 1 }} />
      </Pressable>
      <View style={{
        backgroundColor: tok.surface,
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        paddingHorizontal: 20, paddingTop: 12,
        paddingBottom: Math.max(insets.bottom, keyboardHeight) + 24,
        gap: 14, maxHeight: '85%',
      }}>
        <View style={{
          alignSelf: 'center', width: 36, height: 4, borderRadius: 999,
          backgroundColor: tok.border, marginBottom: 6,
        }} />
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          justifyContent: 'space-between', alignItems: 'center',
        }}>
          <Text style={{ fontFamily: fontHead(lang), fontSize: 20, color: tok.bone }}>
            {lang === 'ar' ? 'تصنيف جديد' : 'New category'}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}><X size={18} color={tok.muted} /></Pressable>
        </View>

        {/* Names */}
        <View style={{ gap: 8 }}>
          <RField
            value={nameEn}
            onChange={setNameEn}
            placeholder={lang === 'ar' ? 'الاسم بالإنجليزية (مثل Skincare)' : 'English name (e.g. Skincare)'}
            ltr
          />
          <RField
            value={nameAr}
            onChange={setNameAr}
            placeholder={lang === 'ar' ? 'الاسم بالعربية' : 'Arabic name'}
            ltr={false}
          />
        </View>

        {/* Type selector */}
        <RSegmented
          value={type}
          onChange={setType}
          options={[
            { value: 'expense', label: lang === 'ar' ? 'مصروف' : 'Expense' },
            { value: 'income', label: lang === 'ar' ? 'دخل' : 'Income' },
            { value: 'both', label: lang === 'ar' ? 'كلاهما' : 'Both' },
          ]}
        />

        {/* Icon picker grid */}
        <View>
          <Text style={{
            fontFamily: fontMono('regular'), fontSize: 10, color: tok.muted, letterSpacing: 1.4, marginBottom: 8,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>{lang === 'ar' ? 'اختاري أيقونة' : 'PICK AN ICON'}</Text>
          <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
            <View style={{
              flexDirection: 'row', flexWrap: 'wrap', gap: 8,
              justifyContent: 'flex-start',
            }}>
              {CATEGORY_ICON_KEYS.map((k) => {
                const active = k === iconKey;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setIconKey(k)}
                    style={{
                      width: 44, height: 44, borderRadius: 12,
                      backgroundColor: active ? tok.gold : tok.elevated,
                      alignItems: 'center', justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: active ? tok.gold : tok.border,
                    }}
                  >
                    <CategoryIconByKey iconKey={k} size={20} color={active ? tok.void : tok.bone} />
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {err ? (
          <Text style={{
            fontFamily: fontBody(lang), fontSize: 13, color: tok.alertText,
            textAlign: 'center', marginTop: -4,
          }}>{err}</Text>
        ) : null}

        <RButton full onPress={submit} disabled={saving} loading={saving}>
          {saving ? '…' : (lang === 'ar' ? 'إضافة' : 'Add category')}
        </RButton>
      </View>
    </Modal>
  );
}
