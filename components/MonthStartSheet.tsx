import { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { radius } from '../lib/theme';
import { REyebrow, RButton } from './ui';

// ─────────────────────────────────────────────────────────────
// SetMonthStartSheet — pick the day the financial month begins (1-31). Day 1
// is the plain calendar month; any other day runs every total payday to
// payday. Mirrors the onboarding tour's month scene, in a bottom sheet for
// Profile. onSave returns Promise<void>; the sheet shows "Saving…" until done.
// ─────────────────────────────────────────────────────────────
export function SetMonthStartSheet({
  visible, onClose, onSave, initialDay = 1,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (day: number) => Promise<void> | void;
  initialDay?: number;
}) {
  const { tok, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const ar = lang === 'ar';
  const [day, setDay] = useState(initialDay);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setDay(initialDay || 1);
  }, [visible, initialDay]);

  const submit = async () => {
    setSaving(true);
    try {
      await onSave(day);
    } finally {
      setSaving(false);
    }
  };

  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#000A' }} onPress={onClose} />
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: tok.void,
        borderTopLeftRadius: radius.modal, borderTopRightRadius: radius.modal,
        paddingHorizontal: 18, paddingTop: 10, paddingBottom: insets.bottom + 18,
        borderTopWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
        gap: 14,
      }}>
        <View style={{
          alignSelf: 'center', width: 36, height: 4, borderRadius: 999,
          backgroundColor: tok.border, marginBottom: 4,
        }} />
        <View style={{
          flexDirection: ar ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <View style={{ flex: 1 }}>
            <REyebrow style={{ color: tok.gold, marginBottom: 4 }}>
              {ar ? 'بداية الشهر' : 'Month start'}
            </REyebrow>
            <Text style={{
              fontFamily: fontHead(lang), fontSize: 20, color: tok.bone, letterSpacing: -0.3,
              textAlign: ar ? 'right' : 'left',
            }}>
              {ar ? 'متى يبدأ شهرك؟' : 'When does your month begin?'}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8}><X size={20} color={tok.muted} /></Pressable>
        </View>

        <Text style={{
          fontFamily: fontBody(lang), fontSize: 13, lineHeight: 19, color: tok.muted,
          textAlign: ar ? 'right' : 'left',
        }}>
          {ar
            ? 'يصلك راتبك يوم 25؟ حدّده وستحسب كل الإجماليات من راتب لراتب.'
            : 'Paid on the 25th? Set it and every total runs payday to payday.'}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
          {days.map((d) => {
            const on = d === day;
            return (
              <Pressable
                key={d}
                onPress={() => setDay(d)}
                style={({ pressed }) => ({
                  width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: on ? tok.gold : tok.elevated,
                  borderWidth: 1, borderColor: on ? tok.gold : tok.border,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{
                  fontFamily: fontMono(on ? 'medium' : 'regular'), fontSize: 12.5,
                  color: on ? tok.void : tok.muted,
                }}>{d}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={{
          textAlign: 'center', fontFamily: fontMono('regular'), fontSize: 12,
        }}>
          <Text style={{ color: tok.muted }}>{ar ? 'شهرك: ' : 'Your month: '}</Text>
          <Text style={{ color: tok.gold }}>
            {day === 1
              ? (ar ? 'الشهر الميلادي (من الأول)' : 'Calendar month (the 1st)')
              : windowLabel(day, lang)}
          </Text>
        </Text>

        <RButton full onPress={submit} disabled={saving} loading={saving}>
          {saving ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : (ar ? 'حفظ' : 'Save')}
        </RButton>
      </View>
    </Modal>
  );
}

// "Jun 25 → Jul 24" from the chosen start day, anchored to today. Clamps the
// day to each month's length so day 31 still resolves.
function windowLabel(day: number, lang: 'en' | 'ar'): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  let sy = y, sm = m;
  if (d < day) { sm = m - 1; if (sm < 0) { sm = 11; sy = y - 1; } }
  const clamp = (yy: number, mm: number) => Math.min(day, new Date(yy, mm + 1, 0).getDate());
  const start = new Date(sy, sm, clamp(sy, sm));
  const end = new Date(sy, sm + 1, clamp(sy, sm + 1));
  end.setDate(end.getDate() - 1);
  const fmt = (dt: Date) => dt.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)} → ${fmt(end)}`;
}
