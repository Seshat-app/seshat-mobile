import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, Animated, TextInput, Platform, StyleSheet } from 'react-native';
import { Sparkles, X } from 'lucide-react-native';
import { useI18n, currencyLabel } from '../lib/i18n';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { REyebrow, RButton } from './ui';
import { useKeyboardHeight } from './useKeyboardHeight';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─────────────────────────────────────────────────────────────
// SalaryBanner — gold-accent invite to set monthly salary. Shows on the
// dashboard until the user enters a number. Tapping opens the bottom sheet.
// ─────────────────────────────────────────────────────────────
export function SalaryBanner({ onPress }: { onPress: () => void }) {
  const { tok, lang, t } = useI18n();
  const headline = lang === 'ar' ? 'حدّد راتبك الشهري' : 'Set your monthly salary';
  const sub = lang === 'ar'
    ? 'حتى يعرف رادار ما الذي يجب أن يراقبه.'
    : "So Radar knows what to watch over.";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        marginHorizontal: 16, marginTop: 4,
        backgroundColor: tok.surface,
        borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
        ...(lang === 'ar'
          ? { borderRightWidth: 2, borderRightColor: tok.gold }
          : { borderLeftWidth: 2, borderLeftColor: tok.gold }),
        borderRadius: 12, padding: 14,
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', gap: 12,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View style={{
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: tok.elevated,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Sparkles size={18} color={tok.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{
          color: tok.bone, fontFamily: fontBody(lang, 'semibold'), fontSize: 14,
          textAlign: lang === 'ar' ? 'right' : 'left',
        }}>{headline}</Text>
        <Text style={{
          marginTop: 3, color: tok.muted, fontFamily: fontBody(lang), fontSize: 12,
          textAlign: lang === 'ar' ? 'right' : 'left',
        }}>{sub}</Text>
      </View>
      <Text style={{ color: tok.gold, fontFamily: fontMono('regular'), fontSize: 14 }}>
        {lang === 'ar' ? '←' : '→'}
      </Text>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// SetSalarySheet — bottom sheet with a single amount input.
// onSave returns Promise<void>; sheet stays open + shows "Saving…" until resolved.
// ─────────────────────────────────────────────────────────────
export function SetSalarySheet({
  visible, onClose, onSave, defaultCurrency, initialAmount,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (amount: number) => Promise<void> | void;
  defaultCurrency: string;
  initialAmount?: number | null;
}) {
  const { tok, lang, t } = useI18n();
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : '');
  const [saving, setSaving] = useState(false);

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
  const canSave = numeric > 0 && !saving;
  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave(numeric);
    } finally {
      setSaving(false);
    }
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
        <Animated.View
          style={{
            backgroundColor: tok.void,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            borderTopWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
            paddingBottom: 26,
            marginBottom: kbHeight,
            paddingTop: kbHeight > 0 ? insets.top : 0,
            transform: [{ translateY: translate }],
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: tok.borderHi, opacity: 0.6 }} />
          </View>
          <View style={{
            flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
            justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: 18, paddingVertical: 6,
          }}>
            <REyebrow>{lang === 'ar' ? 'الراتب الشهري' : 'Monthly salary'}</REyebrow>
            <Pressable onPress={onClose} hitSlop={8}><X size={20} color={tok.muted} /></Pressable>
          </View>

          <View style={{ paddingHorizontal: 22, paddingTop: 10 }}>
            <Text style={{
              fontFamily: fontHead(lang),
              fontSize: lang === 'ar' ? 22 : 22, color: tok.bone,
              letterSpacing: lang === 'ar' ? 0 : -0.4, lineHeight: 28,
              textAlign: lang === 'ar' ? 'right' : 'left',
            }}>
              {lang === 'ar' ? 'كم يصلك شهرياً؟' : 'How much do you earn monthly?'}
            </Text>
            <Text style={{
              marginTop: 6, color: tok.muted, fontFamily: fontBody(lang), fontSize: 13,
              textAlign: lang === 'ar' ? 'right' : 'left', lineHeight: 19,
            }}>
              {lang === 'ar'
                ? 'سيقارن رادار صرفك بهذا الرقم. تقدر تعدّله متى ما شئت.'
                : "Radar compares your spending against this number. You can change it anytime."}
            </Text>

            <View style={{
              marginTop: 24, marginBottom: 10,
              flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center',
              gap: 10,
            }}>
              <TextInput
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
                placeholder="0"
                placeholderTextColor={tok.muted}
                keyboardType="decimal-pad"
                autoFocus
                style={{
                  color: tok.bone, fontFamily: fontMono('medium'), fontSize: 52,
                  letterSpacing: -1.5, padding: 0, minWidth: 80, textAlign: 'center',
                  writingDirection: 'ltr',
                }}
              />
              <Text style={{ color: tok.muted, fontFamily: fontMono('regular'), fontSize: 18 }}>
                {currencyLabel(defaultCurrency, lang)}
              </Text>
            </View>
          </View>

          <View style={{ paddingHorizontal: 18, paddingTop: 16 }}>
            <RButton full onPress={submit} disabled={!canSave}>
              {saving
                ? (lang === 'ar' ? 'جارٍ الحفظ…' : 'Saving…')
                : t('save')}
            </RButton>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
