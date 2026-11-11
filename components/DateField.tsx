import { useState } from 'react';
import { View, Text, Pressable, Modal, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { fontBody, fontMono } from '../lib/fonts';
import { radius } from '../lib/theme';
import { REyebrow, RButton } from './ui';

/** "2026-11-11" -> a local Date at noon (so a time-zone shift never moves the day). */
export function parseDay(iso: string | undefined): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}
export function toDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * A date the person picks from the phone's own calendar, never types. Shows the chosen day as a field; tapping it
 * opens the system date dialog on Android and a bottom panel with the wheel on iPhone. Values are YYYY-MM-DD.
 */
export function DateField({
  label, value, onChange, minimumDate, maximumDate, clearable, placeholder, style,
}: {
  label?: string;
  value: string;
  onChange: (iso: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Offer a way to empty it (an optional date, like a goal deadline). */
  clearable?: boolean;
  placeholder?: string;
  style?: object;
}) {
  const { tok, lang, mode } = useI18n();
  const insets = useSafeAreaInsets();
  const ar = lang === 'ar';
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(parseDay(value) ?? new Date());
  const current = parseDay(value);
  const shown = current
    ? current.toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : (placeholder ?? (ar ? 'اختر التاريخ' : 'Pick a date'));

  const show = () => {
    const start = current ?? new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: start, mode: 'date', minimumDate, maximumDate,
        onChange: (e: DateTimePickerEvent, d?: Date) => { if (e.type === 'set' && d) onChange(toDay(d)); },
      });
    } else {
      setDraft(start);
      setOpen(true);
    }
  };

  return (
    <View style={style}>
      {label ? <REyebrow style={{ marginBottom: 8, textAlign: ar ? 'right' : 'left' }}>{label}</REyebrow> : null}
      <Pressable
        onPress={show}
        style={({ pressed }) => ({
          flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 10,
          paddingHorizontal: 16, minHeight: 56, borderRadius: 16,
          backgroundColor: tok.shellBg, borderWidth: 1, borderColor: tok.shellBorder, opacity: pressed ? 0.85 : 1,
        })}
      >
        <CalendarDays size={18} color={tok.gold} />
        <Text style={{ flex: 1, fontFamily: current ? fontMono('regular') : fontBody(lang), fontSize: 15, color: current ? tok.bone : tok.muted, textAlign: ar ? 'right' : 'left' }}>{shown}</Text>
        {clearable && current ? (
          <Pressable onPress={() => onChange('')} hitSlop={10}><X size={16} color={tok.muted} /></Pressable>
        ) : null}
      </Pressable>

      {Platform.OS === 'ios' && (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={() => setOpen(false)} />
          <View style={{
            backgroundColor: tok.void, borderTopLeftRadius: radius.modal, borderTopRightRadius: radius.modal,
            paddingHorizontal: 18, paddingTop: 14, paddingBottom: insets.bottom + 16, borderTopWidth: 1, borderColor: tok.border,
          }}>
            <DateTimePicker
              value={draft} mode="date" display="inline" themeVariant={mode === 'light' ? 'light' : 'dark'} accentColor={tok.gold}
              minimumDate={minimumDate} maximumDate={maximumDate}
              onChange={(_e, d) => { if (d) setDraft(d); }}
              locale={ar ? 'ar-EG' : 'en-GB'}
            />
            <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 10, marginTop: 8 }}>
              {clearable ? <View style={{ flex: 1 }}><RButton full variant="ghost" onPress={() => { onChange(''); setOpen(false); }}>{ar ? 'مسح' : 'Clear'}</RButton></View> : null}
              <View style={{ flex: 1 }}><RButton full onPress={() => { onChange(toDay(draft)); setOpen(false); }}>{ar ? 'تم' : 'Done'}</RButton></View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
