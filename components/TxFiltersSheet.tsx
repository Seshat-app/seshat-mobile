import { useEffect, useState } from 'react';
import {
  View, Text, Modal, Pressable, ScrollView, TextInput, StyleSheet, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Check, RotateCcw } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { REyebrow, RButton } from './ui';
import type { ApiCategory } from './AddTransactionSheet';

/**
 * Transaction filters sheet. Opens from the slider icon next to the
 * search bar on the Transactions tab.
 *
 * Filters available:
 *   - Type (all | income | expense)
 *   - Quick range presets (this month, last month, last 7 days, last 30 days)
 *   - Custom date range
 *   - Categories (multi-select)
 *   - Sources (multi-select - chip per origin)
 *   - Amount range (min / max)
 *
 * "Apply" hands the resolved filter shape back to the parent. "Reset"
 * clears every filter back to defaults.
 */
export type TxFilters = {
  type: 'all' | 'income' | 'expense';
  categoryIds: string[];
  sources: Array<'manual' | 'voice' | 'seshat' | 'bot' | 'notification' | 'receipt-ocr'>;
  // ISO date strings; absent means no constraint.
  from?: string;
  to?: string;
  minAmount?: number;
  maxAmount?: number;
};

export const EMPTY_FILTERS: TxFilters = {
  type: 'all',
  categoryIds: [],
  sources: [],
};

type Preset = 'this-month' | 'last-month' | 'last-7' | 'last-30' | 'custom';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function presetRange(p: Preset): { from?: string; to?: string } {
  const now = new Date();
  if (p === 'this-month') {
    return {
      from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)),
    };
  }
  if (p === 'last-month') {
    return {
      from: isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: isoDate(new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)),
    };
  }
  if (p === 'last-7') {
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    return { from: isoDate(from), to: isoDate(now) };
  }
  if (p === 'last-30') {
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    return { from: isoDate(from), to: isoDate(now) };
  }
  return {};
}

type Props = {
  visible: boolean;
  onClose: () => void;
  initial: TxFilters;
  categories: ApiCategory[];
  onApply: (filters: TxFilters) => void;
};

export function TxFiltersSheet({ visible, onClose, initial, categories, onApply }: Props) {
  const { tok, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<TxFilters>(initial);
  const [minStr, setMinStr] = useState(initial.minAmount ? String(initial.minAmount) : '');
  const [maxStr, setMaxStr] = useState(initial.maxAmount ? String(initial.maxAmount) : '');

  useEffect(() => {
    if (visible) {
      setDraft(initial);
      setMinStr(initial.minAmount ? String(initial.minAmount) : '');
      setMaxStr(initial.maxAmount ? String(initial.maxAmount) : '');
    }
  }, [visible]);

  const toggleCategory = (id: string) => {
    setDraft((d) => ({
      ...d,
      categoryIds: d.categoryIds.includes(id)
        ? d.categoryIds.filter((x) => x !== id)
        : [...d.categoryIds, id],
    }));
  };

  const toggleSource = (s: TxFilters['sources'][number]) => {
    setDraft((d) => ({
      ...d,
      sources: d.sources.includes(s)
        ? d.sources.filter((x) => x !== s)
        : [...d.sources, s],
    }));
  };

  const applyPreset = (p: Preset) => {
    const r = presetRange(p);
    setDraft((d) => ({ ...d, ...r }));
  };

  const reset = () => {
    setDraft(EMPTY_FILTERS);
    setMinStr('');
    setMaxStr('');
  };

  const apply = () => {
    onApply({
      ...draft,
      minAmount: minStr ? parseFloat(minStr) : undefined,
      maxAmount: maxStr ? parseFloat(maxStr) : undefined,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#000A' }} onPress={onClose} />
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: tok.void,
        borderTopLeftRadius: 22, borderTopRightRadius: 22,
        borderTopWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
        paddingTop: 18,
        paddingBottom: insets.bottom + 12,
        maxHeight: '88%',
      }}>
        {/* Header */}
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          justifyContent: 'space-between', alignItems: 'center',
          paddingHorizontal: 18, marginBottom: 10,
        }}>
          <Text style={{
            fontFamily: fontHead(lang), fontSize: 20, color: tok.bone, letterSpacing: -0.3,
          }}>
            {lang === 'ar' ? 'الفلاتر' : 'Filters'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <Pressable onPress={reset} hitSlop={8}>
              <RotateCcw size={16} color={tok.muted} />
            </Pressable>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={tok.muted} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 16, gap: 18 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Type */}
          <Section title={lang === 'ar' ? 'النوع' : 'Type'} tok={tok} lang={lang}>
            <Row>
              <Chip
                active={draft.type === 'all'}
                onPress={() => setDraft((d) => ({ ...d, type: 'all' }))}
                tok={tok} lang={lang}
              >
                {lang === 'ar' ? 'الكل' : 'All'}
              </Chip>
              <Chip
                active={draft.type === 'expense'}
                onPress={() => setDraft((d) => ({ ...d, type: 'expense' }))}
                tok={tok} lang={lang}
              >
                {lang === 'ar' ? 'مصروف' : 'Expense'}
              </Chip>
              <Chip
                active={draft.type === 'income'}
                onPress={() => setDraft((d) => ({ ...d, type: 'income' }))}
                tok={tok} lang={lang}
              >
                {lang === 'ar' ? 'دخل' : 'Income'}
              </Chip>
            </Row>
          </Section>

          {/* Date range */}
          <Section title={lang === 'ar' ? 'الفترة' : 'Date range'} tok={tok} lang={lang}>
            <Row>
              <Chip onPress={() => applyPreset('this-month')} tok={tok} lang={lang}>
                {lang === 'ar' ? 'هذا الشهر' : 'This month'}
              </Chip>
              <Chip onPress={() => applyPreset('last-month')} tok={tok} lang={lang}>
                {lang === 'ar' ? 'الشهر الماضي' : 'Last month'}
              </Chip>
              <Chip onPress={() => applyPreset('last-7')} tok={tok} lang={lang}>
                {lang === 'ar' ? 'آخر 7 أيام' : 'Last 7 days'}
              </Chip>
              <Chip onPress={() => applyPreset('last-30')} tok={tok} lang={lang}>
                {lang === 'ar' ? 'آخر 30 يوم' : 'Last 30 days'}
              </Chip>
            </Row>
            <View style={{
              flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
              gap: 8, marginTop: 8,
            }}>
              <DateInput
                label={lang === 'ar' ? 'من' : 'From'}
                value={draft.from ?? ''}
                onChange={(v) => setDraft((d) => ({ ...d, from: v || undefined }))}
                tok={tok} lang={lang}
              />
              <DateInput
                label={lang === 'ar' ? 'إلى' : 'To'}
                value={draft.to ?? ''}
                onChange={(v) => setDraft((d) => ({ ...d, to: v || undefined }))}
                tok={tok} lang={lang}
              />
            </View>
          </Section>

          {/* Categories */}
          {categories.length > 0 && (
            <Section title={lang === 'ar' ? 'الفئات' : 'Categories'} tok={tok} lang={lang}>
              <Row wrap>
                {categories.map((c) => (
                  <Chip
                    key={c._id}
                    active={draft.categoryIds.includes(c._id)}
                    onPress={() => toggleCategory(c._id)}
                    tok={tok} lang={lang}
                  >
                    {c.emoji ? `${c.emoji} ` : ''}{lang === 'ar' && c.nameAr ? c.nameAr : c.nameEn}
                  </Chip>
                ))}
              </Row>
            </Section>
          )}

          {/* Source */}
          <Section title={lang === 'ar' ? 'المصدر' : 'Source'} tok={tok} lang={lang}>
            <Row wrap>
              <Chip
                active={draft.sources.includes('manual')}
                onPress={() => toggleSource('manual')}
                tok={tok} lang={lang}
              >
                {lang === 'ar' ? 'يدوي' : 'Manual'}
              </Chip>
              <Chip
                active={draft.sources.includes('seshat')}
                onPress={() => toggleSource('seshat')}
                tok={tok} lang={lang}
              >
                {lang === 'ar' ? 'سيشات' : 'Seshat'}
              </Chip>
              <Chip
                active={draft.sources.includes('voice')}
                onPress={() => toggleSource('voice')}
                tok={tok} lang={lang}
              >
                {lang === 'ar' ? 'صوت' : 'Voice'}
              </Chip>
              <Chip
                active={draft.sources.includes('receipt-ocr')}
                onPress={() => toggleSource('receipt-ocr')}
                tok={tok} lang={lang}
              >
                {lang === 'ar' ? 'إيصال' : 'Receipt'}
              </Chip>
              <Chip
                active={draft.sources.includes('bot')}
                onPress={() => toggleSource('bot')}
                tok={tok} lang={lang}
              >
                {lang === 'ar' ? 'تيليجرام' : 'Telegram'}
              </Chip>
              <Chip
                active={draft.sources.includes('notification')}
                onPress={() => toggleSource('notification')}
                tok={tok} lang={lang}
              >
                {lang === 'ar' ? 'إشعار' : 'Notification'}
              </Chip>
            </Row>
          </Section>

          {/* Amount range */}
          <Section title={lang === 'ar' ? 'المبلغ' : 'Amount'} tok={tok} lang={lang}>
            <View style={{
              flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
              gap: 8,
            }}>
              <AmountInput
                label={lang === 'ar' ? 'الحد الأدنى' : 'Min'}
                value={minStr} onChange={setMinStr}
                tok={tok} lang={lang}
              />
              <AmountInput
                label={lang === 'ar' ? 'الحد الأقصى' : 'Max'}
                value={maxStr} onChange={setMaxStr}
                tok={tok} lang={lang}
              />
            </View>
          </Section>
        </ScrollView>

        {/* Apply */}
        <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
          <RButton full onPress={apply}>
            <View style={{
              flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
              alignItems: 'center', gap: 6,
            }}>
              <Check size={16} color={tok.void} />
              <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 14, color: tok.void }}>
                {lang === 'ar' ? 'تطبيق' : 'Apply'}
              </Text>
            </View>
          </RButton>
        </View>
      </View>
    </Modal>
  );
}

function Section({ title, tok, lang, children }: {
  title: string; tok: any; lang: 'en' | 'ar'; children: React.ReactNode;
}) {
  return (
    <View>
      <REyebrow style={{ marginBottom: 8, textAlign: lang === 'ar' ? 'right' : 'left' }}>
        {title}
      </REyebrow>
      {children}
    </View>
  );
}

function Row({ children, wrap }: { children: React.ReactNode; wrap?: boolean }) {
  return (
    <View style={{
      flexDirection: 'row',
      flexWrap: wrap ? 'wrap' : 'nowrap',
      gap: 6,
    }}>
      {children}
    </View>
  );
}

function Chip({
  active, onPress, tok, lang, children,
}: {
  active?: boolean; onPress: () => void;
  tok: any; lang: 'en' | 'ar';
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
        backgroundColor: active ? tok.gold : (pressed ? tok.elevated : tok.surface),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: active ? tok.gold : tok.border,
      })}
    >
      <Text style={{
        fontFamily: fontBody(lang, active ? 'semibold' : 'medium'),
        fontSize: 12, color: active ? tok.void : tok.bone,
      }}>
        {children}
      </Text>
    </Pressable>
  );
}

function DateInput({
  label, value, onChange, tok, lang,
}: { label: string; value: string; onChange: (v: string) => void; tok: any; lang: 'en' | 'ar' }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{
        fontFamily: fontMono(), fontSize: 9, letterSpacing: 1.5, color: tok.muted,
        textTransform: 'uppercase', marginBottom: 4,
        textAlign: lang === 'ar' ? 'right' : 'left',
      }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={tok.muted}
        autoCapitalize="none"
        style={{
          backgroundColor: tok.surface,
          borderRadius: 10, paddingHorizontal: 12,
          paddingVertical: Platform.OS === 'ios' ? 10 : 6,
          fontFamily: fontMono(), fontSize: 12, color: tok.bone,
          borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
          textAlign: lang === 'ar' ? 'right' : 'left',
        }}
      />
    </View>
  );
}

function AmountInput({
  label, value, onChange, tok, lang,
}: { label: string; value: string; onChange: (v: string) => void; tok: any; lang: 'en' | 'ar' }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{
        fontFamily: fontMono(), fontSize: 9, letterSpacing: 1.5, color: tok.muted,
        textTransform: 'uppercase', marginBottom: 4,
        textAlign: lang === 'ar' ? 'right' : 'left',
      }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^\d.]/g, ''))}
        placeholder="0"
        placeholderTextColor={tok.muted}
        keyboardType="numeric"
        style={{
          backgroundColor: tok.surface,
          borderRadius: 10, paddingHorizontal: 12,
          paddingVertical: Platform.OS === 'ios' ? 10 : 6,
          fontFamily: fontHead(lang), fontSize: 16, color: tok.bone,
          borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
          textAlign: lang === 'ar' ? 'right' : 'left',
        }}
      />
    </View>
  );
}
