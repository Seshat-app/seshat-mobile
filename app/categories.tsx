import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, TextInput, Platform, RefreshControl, Alert } from 'react-native';
import { Trash2, X } from 'lucide-react-native';
import { apiFetch, hasToken, newIdempotencyKey } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useAppData } from '../lib/appData';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { RCard, RButton } from '../components/ui';
import { PlanScreen } from '../components/PlanShell';
import { SkeletonRow } from '../components/Skeleton';
import { useKeyboardHeight } from '../components/useKeyboardHeight';

type ApiCategory = {
  _id: string;
  nameEn: string;
  nameAr: string;
  emoji: string;
  type: 'income' | 'expense' | 'both';
  isDefault: boolean;
};

export default function CategoriesScreen() {
  const { tok, lang } = useI18n();
  const { bumpVersion } = useAppData();
  const [items, setItems] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!(await hasToken())) return;
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    try {
      const res = await apiFetch<{ data: ApiCategory[] }>('/categories');
      setItems(res.data);
    } catch (err) { console.warn('categories load', err); }
    finally {
      if (mode === 'initial') setLoading(false);
      else setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
            {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
          </RCard>
        ) : (
          <RCard padding={0} style={{ paddingHorizontal: 12 }}>
            {items.map((cat, i) => (
              <Pressable
                key={cat._id}
                onLongPress={() => onDelete(cat)}
                delayLongPress={400}
                style={({ pressed }) => ({
                  paddingVertical: 14, paddingHorizontal: 8,
                  flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                  alignItems: 'center', gap: 14,
                  borderBottomWidth: i < items.length - 1 ? 1 : 0,
                  borderBottomColor: tok.border,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontSize: 22 }}>{cat.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontFamily: fontBody(lang, 'medium'), fontSize: 15, color: tok.bone,
                    textAlign: lang === 'ar' ? 'right' : 'left',
                  }}>
                    {lang === 'ar' ? cat.nameAr : cat.nameEn}
                  </Text>
                  <Text style={{
                    fontFamily: fontMono('regular'), fontSize: 10, color: tok.muted, letterSpacing: 1.2, marginTop: 2,
                    textAlign: lang === 'ar' ? 'right' : 'left',
                  }}>
                    {cat.isDefault
                      ? (lang === 'ar' ? 'افتراضي' : 'DEFAULT')
                      : (lang === 'ar' ? 'مخصص' : 'CUSTOM')}
                    {'  ·  '}{cat.type.toUpperCase()}
                  </Text>
                </View>
                {!cat.isDefault && (
                  <Pressable onPress={() => onDelete(cat)} hitSlop={8} style={{ padding: 6 }}>
                    <Trash2 size={16} color={tok.muted} />
                  </Pressable>
                )}
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
      </ScrollView>

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
  const insets = useKeyboardHeight();
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [emoji, setEmoji] = useState('📌');
  const [type, setType] = useState<'expense' | 'income' | 'both'>('expense');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (visible) { setNameEn(''); setNameAr(''); setEmoji('📌'); setType('expense'); setErr(''); }
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
        body: JSON.stringify({ nameEn: nameEn.trim(), nameAr: nameAr.trim(), emoji: emoji.trim() || '📌', type }),
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
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24 + insets,
        gap: 14,
      }}>
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          justifyContent: 'space-between', alignItems: 'center',
        }}>
          <Text style={{ fontFamily: fontHead(lang), fontSize: 20, color: tok.bone }}>
            {lang === 'ar' ? 'تصنيف جديد' : 'New category'}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}><X size={18} color={tok.muted} /></Pressable>
        </View>

        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          alignItems: 'center', gap: 12,
        }}>
          <TextInput
            value={emoji}
            onChangeText={setEmoji}
            maxLength={4}
            placeholder="📌"
            placeholderTextColor={tok.muted}
            style={{
              width: 60, height: 56, borderRadius: 14, backgroundColor: tok.elevated,
              textAlign: 'center', fontSize: 26, color: tok.bone,
            }}
          />
          <View style={{ flex: 1, gap: 8 }}>
            <TextInput
              value={nameEn}
              onChangeText={setNameEn}
              placeholder={lang === 'ar' ? 'الاسم بالإنجليزية (مثل Skincare)' : 'English name (e.g. Skincare)'}
              placeholderTextColor={tok.muted}
              style={inputStyle(tok)}
            />
            <TextInput
              value={nameAr}
              onChangeText={setNameAr}
              placeholder={lang === 'ar' ? 'الاسم بالعربية' : 'Arabic name'}
              placeholderTextColor={tok.muted}
              style={[inputStyle(tok), { textAlign: 'right' }]}
            />
          </View>
        </View>

        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          gap: 8, marginTop: 2,
        }}>
          {(['expense', 'income', 'both'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 10,
                backgroundColor: type === t ? tok.gold : tok.elevated,
                alignItems: 'center',
              }}
            >
              <Text style={{
                fontFamily: fontMono('regular'), fontSize: 11, letterSpacing: 1.4,
                color: type === t ? '#0D0D0D' : tok.muted,
              }}>{t.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        {err ? (
          <Text style={{
            fontFamily: fontBody(lang), fontSize: 13, color: '#FF7B7B',
            textAlign: 'center', marginTop: -4,
          }}>{err}</Text>
        ) : null}

        <RButton full onPress={submit} disabled={saving}>
          {saving ? '…' : (lang === 'ar' ? 'إضافة' : 'Add category')}
        </RButton>
      </View>
    </Modal>
  );
}

const inputStyle = (tok: ReturnType<typeof useI18n>['tok']) => ({
  height: 44, borderRadius: 10, paddingHorizontal: 12,
  backgroundColor: tok.elevated, color: tok.bone,
  fontFamily: Platform.select({ ios: 'System', default: 'sans-serif' }), fontSize: 15,
});
