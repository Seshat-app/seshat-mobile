import { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, TextInput, Platform, ScrollView } from 'react-native';
import { X } from 'lucide-react-native';
import { apiFetch, newIdempotencyKey } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { RButton } from './ui';
import { useKeyboardHeight } from './useKeyboardHeight';
import type { ApiCategory } from './AddTransactionSheet';

export type EditingTx = {
  _id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  description?: string;
  date: string;
  categoryId?: string | { _id: string };
};

type Props = {
  visible: boolean;
  editing: EditingTx | null;
  categories: ApiCategory[];
  onClose: () => void;
  onSaved: () => void;
};

// Simpler edit sheet — no NLP, no voice, no Seshat-mode keypad. Just the
// minimum fields needed to fix a wrong entry: type, amount, category, note.
export function EditTransactionSheet({ visible, editing, categories, onClose, onSaved }: Props) {
  const { tok, lang } = useI18n();
  const kbHeight = useKeyboardHeight();

  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [categoryId, setCategoryId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!editing || !visible) return;
    setAmount(String(editing.amount));
    setType(editing.type);
    setCategoryId(typeof editing.categoryId === 'string' ? editing.categoryId : editing.categoryId?._id ?? '');
    setDescription(editing.description ?? '');
    setErr('');
  }, [editing, visible]);

  const filteredCats = categories.filter((c) => !c.type || c.type === 'both' || c.type === type);

  const submit = async () => {
    if (!editing) return;
    const n = parseFloat(amount);
    if (!isFinite(n) || n <= 0) { setErr(lang === 'ar' ? 'مبلغ غير صالح' : 'Invalid amount'); return; }
    if (!categoryId) { setErr(lang === 'ar' ? 'اختر تصنيفًا' : 'Pick a category'); return; }
    setSaving(true); setErr('');
    try {
      await apiFetch(`/transactions/${editing._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          type,
          amount: n,
          categoryId,
          description: description.trim() || undefined,
        }),
        idempotencyKey: newIdempotencyKey(),
      });
      onSaved();
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
        paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24 + kbHeight,
        gap: 14, maxHeight: '85%',
      }}>
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          justifyContent: 'space-between', alignItems: 'center',
        }}>
          <Text style={{ fontFamily: fontHead(lang), fontSize: 20, color: tok.bone }}>
            {lang === 'ar' ? 'تعديل المعاملة' : 'Edit transaction'}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}><X size={18} color={tok.muted} /></Pressable>
        </View>

        {/* Type toggle */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['expense', 'income'] as const).map((tt) => (
            <Pressable
              key={tt}
              onPress={() => setType(tt)}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 10,
                backgroundColor: type === tt ? tok.gold : tok.elevated,
                alignItems: 'center',
              }}
            >
              <Text style={{
                fontFamily: fontMono('regular'), fontSize: 11, letterSpacing: 1.4,
                color: type === tt ? '#0D0D0D' : tok.muted,
              }}>
                {tt === 'expense'
                  ? (lang === 'ar' ? 'مصروف' : 'EXPENSE')
                  : (lang === 'ar' ? 'دخل' : 'INCOME')}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Amount */}
        <View>
          <Text style={{
            fontFamily: fontMono('regular'), fontSize: 10, color: tok.muted, letterSpacing: 1.4, marginBottom: 6,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>{lang === 'ar' ? 'المبلغ' : 'AMOUNT'}</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            style={{
              height: 48, borderRadius: 10, paddingHorizontal: 12,
              backgroundColor: tok.elevated, color: tok.bone,
              fontFamily: Platform.select({ ios: 'System', default: 'sans-serif' }), fontSize: 18,
              textAlign: lang === 'ar' ? 'right' : 'left',
            }}
          />
        </View>

        {/* Category */}
        <View>
          <Text style={{
            fontFamily: fontMono('regular'), fontSize: 10, color: tok.muted, letterSpacing: 1.4, marginBottom: 6,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>{lang === 'ar' ? 'التصنيف' : 'CATEGORY'}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {filteredCats.map((c) => {
              const active = c._id === categoryId;
              return (
                <Pressable
                  key={c._id}
                  onPress={() => setCategoryId(c._id)}
                  style={{
                    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999,
                    backgroundColor: active ? tok.gold : tok.elevated,
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 14 }}>{c.emoji ?? '📦'}</Text>
                  <Text style={{
                    fontFamily: fontBody(lang, active ? 'semibold' : 'medium'), fontSize: 13,
                    color: active ? '#0D0D0D' : tok.bone,
                  }}>
                    {lang === 'ar' ? (c.nameAr ?? c.nameEn) : c.nameEn}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Description */}
        <View>
          <Text style={{
            fontFamily: fontMono('regular'), fontSize: 10, color: tok.muted, letterSpacing: 1.4, marginBottom: 6,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>{lang === 'ar' ? 'الوصف (اختياري)' : 'NOTE (OPTIONAL)'}</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={lang === 'ar' ? 'مثال: قهوة على الإفطار' : 'e.g. coffee with breakfast'}
            placeholderTextColor={tok.muted}
            style={{
              height: 44, borderRadius: 10, paddingHorizontal: 12,
              backgroundColor: tok.elevated, color: tok.bone,
              fontFamily: Platform.select({ ios: 'System', default: 'sans-serif' }), fontSize: 14,
              textAlign: lang === 'ar' ? 'right' : 'left',
            }}
          />
        </View>

        {err ? (
          <Text style={{
            fontFamily: fontBody(lang), fontSize: 13, color: '#FF7B7B', textAlign: 'center', marginTop: -4,
          }}>{err}</Text>
        ) : null}

        <RButton full onPress={submit} disabled={saving}>
          {saving ? '…' : (lang === 'ar' ? 'حفظ التعديل' : 'Save changes')}
        </RButton>
      </View>
    </Modal>
  );
}
