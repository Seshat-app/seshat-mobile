import { useEffect, useState } from 'react';
import {
  View, Text, Modal, Pressable, ScrollView, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Check, RotateCcw } from 'lucide-react-native';
import { useI18n, localDateStr } from '../lib/i18n';
import { fontHead } from '../lib/fonts';
import { radius } from '../lib/theme';
import { REyebrow, RButton, RPill, RField } from './ui';
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
  return localDateStr(d);
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
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)' }} onPress={onClose} />
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: tok.void,
        borderTopLeftRadius: radius.modal, borderTopRightRadius: radius.modal,
        borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
        overflow: 'hidden',
        paddingTop: 10,
        paddingBottom: insets.bottom + 12,
        maxHeight: '88%',
      }}>
        {/* Handle */}
        <View style={{ alignItems: 'center', paddingBottom: 8 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: tok.borderHi, opacity: 0.6 }} />
        </View>

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
              <RPill
                active={draft.type === 'all'}
                onPress={() => setDraft((d) => ({ ...d, type: 'all' }))}
              >
                {lang === 'ar' ? 'الكل' : 'All'}
              </RPill>
              <RPill
                active={draft.type === 'expense'}
                onPress={() => setDraft((d) => ({ ...d, type: 'expense' }))}
              >
                {lang === 'ar' ? 'مصروف' : 'Expense'}
              </RPill>
              <RPill
                active={draft.type === 'income'}
                onPress={() => setDraft((d) => ({ ...d, type: 'income' }))}
              >
                {lang === 'ar' ? 'دخل' : 'Income'}
              </RPill>
            </Row>
          </Section>

          {/* Date range */}
          <Section title={lang === 'ar' ? 'الفترة' : 'Date range'} tok={tok} lang={lang}>
            <Row>
              <RPill onPress={() => applyPreset('this-month')}>
                {lang === 'ar' ? 'هذا الشهر' : 'This month'}
              </RPill>
              <RPill onPress={() => applyPreset('last-month')}>
                {lang === 'ar' ? 'الشهر الماضي' : 'Last month'}
              </RPill>
              <RPill onPress={() => applyPreset('last-7')}>
                {lang === 'ar' ? 'آخر 7 أيام' : 'Last 7 days'}
              </RPill>
              <RPill onPress={() => applyPreset('last-30')}>
                {lang === 'ar' ? 'آخر 30 يوم' : 'Last 30 days'}
              </RPill>
            </Row>
            <View style={{
              flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
              gap: 8, marginTop: 8,
            }}>
              <RField
                label={lang === 'ar' ? 'من' : 'From'}
                value={draft.from ?? ''}
                onChange={(v) => setDraft((d) => ({ ...d, from: v || undefined }))}
                placeholder="YYYY-MM-DD"
                mono ltr
                style={{ flex: 1 }}
              />
              <RField
                label={lang === 'ar' ? 'إلى' : 'To'}
                value={draft.to ?? ''}
                onChange={(v) => setDraft((d) => ({ ...d, to: v || undefined }))}
                placeholder="YYYY-MM-DD"
                mono ltr
                style={{ flex: 1 }}
              />
            </View>
          </Section>

          {/* Categories */}
          {categories.length > 0 && (
            <Section title={lang === 'ar' ? 'الفئات' : 'Categories'} tok={tok} lang={lang}>
              <Row wrap>
                {categories.map((c) => (
                  <RPill
                    key={c._id}
                    active={draft.categoryIds.includes(c._id)}
                    onPress={() => toggleCategory(c._id)}
                  >
                    {c.emoji ? `${c.emoji} ` : ''}{lang === 'ar' && c.nameAr ? c.nameAr : c.nameEn}
                  </RPill>
                ))}
              </Row>
            </Section>
          )}

          {/* Source */}
          <Section title={lang === 'ar' ? 'المصدر' : 'Source'} tok={tok} lang={lang}>
            <Row wrap>
              <RPill
                active={draft.sources.includes('manual')}
                onPress={() => toggleSource('manual')}
              >
                {lang === 'ar' ? 'يدوي' : 'Manual'}
              </RPill>
              <RPill
                active={draft.sources.includes('seshat')}
                onPress={() => toggleSource('seshat')}
              >
                {lang === 'ar' ? 'سيشات' : 'Seshat'}
              </RPill>
              <RPill
                active={draft.sources.includes('voice')}
                onPress={() => toggleSource('voice')}
              >
                {lang === 'ar' ? 'صوت' : 'Voice'}
              </RPill>
              <RPill
                active={draft.sources.includes('receipt-ocr')}
                onPress={() => toggleSource('receipt-ocr')}
              >
                {lang === 'ar' ? 'إيصال' : 'Receipt'}
              </RPill>
              <RPill
                active={draft.sources.includes('bot')}
                onPress={() => toggleSource('bot')}
              >
                {lang === 'ar' ? 'تيليجرام' : 'Telegram'}
              </RPill>
              <RPill
                active={draft.sources.includes('notification')}
                onPress={() => toggleSource('notification')}
              >
                {lang === 'ar' ? 'إشعار' : 'Notification'}
              </RPill>
            </Row>
          </Section>

          {/* Amount range */}
          <Section title={lang === 'ar' ? 'المبلغ' : 'Amount'} tok={tok} lang={lang}>
            <View style={{
              flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
              gap: 8,
            }}>
              <RField
                label={lang === 'ar' ? 'الحد الأدنى' : 'Min'}
                value={minStr}
                onChange={(v) => setMinStr(v.replace(/[^\d.]/g, ''))}
                placeholder="0"
                keyboardType="numeric"
                mono ltr
                style={{ flex: 1 }}
              />
              <RField
                label={lang === 'ar' ? 'الحد الأقصى' : 'Max'}
                value={maxStr}
                onChange={(v) => setMaxStr(v.replace(/[^\d.]/g, ''))}
                placeholder="0"
                keyboardType="numeric"
                mono ltr
                style={{ flex: 1 }}
              />
            </View>
          </Section>
        </ScrollView>

        {/* Apply */}
        <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
          <RButton full onPress={apply} icon={<Check size={16} color={tok.void} />}>
            {lang === 'ar' ? 'تطبيق' : 'Apply'}
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
