import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet, RefreshControl, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, SlidersHorizontal, X as XIcon } from 'lucide-react-native';
import { apiFetch, hasToken } from '../../lib/api';
import { useI18n, monthYear } from '../../lib/i18n';
import { useAppData } from '../../lib/appData';
import { fontBody, fontHead, fontMono } from '../../lib/fonts';
import { RCard, REyebrow, RPill, RHScroll, RAmount } from '../../components/ui';
import { RTxRow, RefreshSpinner, type TxRowData } from '../../components/shell';
import { SkeletonRow } from '../../components/Skeleton';
import { EditTransactionSheet, type EditingTx } from '../../components/EditTransactionSheet';
import { TxFiltersSheet, EMPTY_FILTERS, type TxFilters } from '../../components/TxFiltersSheet';

export default function TransactionsScreen() {
  const { tok, lang, t } = useI18n();
  const { dataVersion, categories, bumpVersion } = useAppData();
  const insets = useSafeAreaInsets();
  const [txs, setTxs] = useState<TxRowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<TxFilters>(EMPTY_FILTERS);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<EditingTx | null>(null);

  const onRowAction = (tx: TxRowData) => {
    Alert.alert(
      tx.description || (lang === 'ar' ? 'المعاملة' : 'Transaction'),
      lang === 'ar' ? 'ماذا تريد أن تفعل؟' : 'What do you want to do?',
      [
        {
          text: lang === 'ar' ? 'تعديل' : 'Edit',
          onPress: () => setEditing({
            _id: tx._id,
            type: tx.type,
            amount: tx.amount,
            currency: tx.currency,
            description: tx.description,
            date: tx.date,
            categoryId: tx.categoryId as EditingTx['categoryId'],
          }),
        },
        {
          text: lang === 'ar' ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              lang === 'ar' ? 'تأكيد الحذف' : 'Delete this entry?',
              tx.description || '',
              [
                { text: lang === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
                {
                  text: lang === 'ar' ? 'حذف' : 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await apiFetch(`/transactions/${tx._id}`, { method: 'DELETE' });
                      bumpVersion();
                    } catch (e) { console.warn('delete tx', e); }
                  },
                },
              ],
            );
          },
        },
        { text: lang === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
      ],
    );
  };

  const fetchTxs = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    const has = await hasToken();
    if (!has) return;
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (filters.type === 'income' || filters.type === 'expense') params.set('type', filters.type);
      if (filters.categoryIds.length) params.set('categoryIds', filters.categoryIds.join(','));
      if (filters.sources.length) params.set('sources', filters.sources.join(','));
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (typeof filters.minAmount === 'number') params.set('minAmount', String(filters.minAmount));
      if (typeof filters.maxAmount === 'number') params.set('maxAmount', String(filters.maxAmount));
      params.set('limit', '100');
      if (query.trim()) params.set('search', query.trim());
      const res = await apiFetch<{ data: TxRowData[] }>(`/transactions?${params.toString()}`);
      setTxs(res.data);
    } catch (err) {
      console.warn('tx fetch failed', err);
    } finally {
      if (mode === 'initial') setLoading(false);
      else setRefreshing(false);
    }
  }, [filters, query]);

  useEffect(() => { fetchTxs('initial'); }, [fetchTxs, dataVersion]);

  // Group by relative day for the section headers (Today / Yesterday / older).
  const groups = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const map = new Map<string, TxRowData[]>();
    for (const tx of txs) {
      const d = new Date(tx.date); d.setHours(0, 0, 0, 0);
      const diff = Math.round((now.getTime() - d.getTime()) / 86_400_000);
      let key: string;
      if (diff === 0) key = t('today');
      else if (diff === 1) key = t('yesterday');
      else key = d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' });
      const arr = map.get(key) ?? [];
      arr.push(tx);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [txs, lang, t]);

  return (
    <View style={{ flex: 1, backgroundColor: tok.void, paddingTop: insets.top }}>
      <View style={{
        paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8,
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{
            fontFamily: fontHead(lang),
            fontSize: 22, color: tok.bone, letterSpacing: -0.4,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>{t('transactions')}</Text>
          <REyebrow style={{ marginTop: 4, textAlign: lang === 'ar' ? 'right' : 'left' }}>
            {txs.length} {t('records')} · {monthYear(lang)}
          </REyebrow>
        </View>
        <RefreshSpinner refreshing={refreshing} />
      </View>

      <View style={{ paddingHorizontal: 16, flex: 1 }}>
        {/* Search + filter */}
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          gap: 8, marginBottom: 14,
        }}>
          <View style={{
            flex: 1, backgroundColor: tok.surface,
            borderWidth: 1, borderColor: tok.border, borderRadius: 10,
            paddingHorizontal: 12, paddingVertical: 10,
            flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
            alignItems: 'center', gap: 8,
          }}>
            <Search size={16} color={tok.muted} />
            <TextInput
              placeholder={t('search')}
              placeholderTextColor={tok.muted}
              value={query}
              onChangeText={setQuery}
              style={{
                flex: 1, color: tok.bone, fontFamily: fontBody(lang), fontSize: 13,
                writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
                textAlign: lang === 'ar' ? 'right' : 'left',
                padding: 0,
              }}
            />
          </View>
          <Pressable
            onPress={() => setFilterSheetOpen(true)}
            style={{
              backgroundColor: hasActiveFilters(filters) ? tok.gold : tok.surface,
              borderWidth: 1,
              borderColor: hasActiveFilters(filters) ? tok.gold : tok.border, borderRadius: 10,
              paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center',
            }}
          >
            <SlidersHorizontal size={16} color={hasActiveFilters(filters) ? '#0D0D0D' : tok.muted} />
          </Pressable>
        </View>

        {/* Active filter chips - one chip per active filter dimension. Tap an
            x on a chip to drop just that filter. Type segmented stays as the
            quick top-level toggle. */}
        <RHScroll style={{ marginBottom: 14 }}>
          <RPill active={filters.type === 'all'} onPress={() => setFilters((f) => ({ ...f, type: 'all' }))}>{t('all')}</RPill>
          <RPill active={filters.type === 'expense'} onPress={() => setFilters((f) => ({ ...f, type: 'expense' }))}>{t('expense')}</RPill>
          <RPill active={filters.type === 'income'} onPress={() => setFilters((f) => ({ ...f, type: 'income' }))}>{t('earned')}</RPill>
          {summarizeFilters(filters, categories, lang).map((chip) => (
            <Pressable
              key={chip.key}
              onPress={() => setFilters(chip.remove)}
              style={({ pressed }) => ({
                flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                alignItems: 'center', gap: 4,
                paddingLeft: lang === 'ar' ? 8 : 10,
                paddingRight: lang === 'ar' ? 10 : 8,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: pressed ? tok.elevated : tok.surface,
                borderWidth: StyleSheet.hairlineWidth, borderColor: tok.gold,
              })}
            >
              <Text style={{
                fontFamily: fontBody(lang, 'medium'), fontSize: 11, color: tok.gold,
              }}>
                {chip.label}
              </Text>
              <XIcon size={11} color={tok.gold} />
            </Pressable>
          ))}
        </RHScroll>

        {loading ? (
          <RCard padding={18}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
          </RCard>
        ) : txs.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
            <Text style={{
              color: tok.bone, fontFamily: fontBody(lang, 'medium'), fontSize: 16,
              textAlign: 'center', lineHeight: 24,
            }}>{t('noRecords')}</Text>
            <Text style={{
              marginTop: 8, color: tok.muted, fontFamily: fontBody(lang), fontSize: 13,
              textAlign: 'center',
            }}>{t('noRecordsSub')}</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            // Bottom padding sits inside contentContainerStyle so it pads the
            // END of scrollable content (clearing the FAB + tab bar) without
            // shrinking the visible scroll area from the top.
            contentContainerStyle={{ paddingBottom: 140 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchTxs('refresh')}
                tintColor={tok.gold}
                colors={[tok.gold]}
                progressBackgroundColor={tok.surface}
              />
            }
          >
            {groups.map(([day, list]) => {
              const total = list.reduce((s, tx) => s + (tx.type === 'income' ? tx.amount : -tx.amount), 0);
              return (
                <View key={day} style={{ marginBottom: 14 }}>
                  <View style={{
                    flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                    justifyContent: 'space-between', alignItems: 'baseline',
                    paddingHorizontal: 4, paddingBottom: 8,
                  }}>
                    <REyebrow>{day}</REyebrow>
                    <RAmount value={total} size={11} weight="regular" currency={list[0]?.currency ?? 'EGP'} sign={total > 0} decimals={0} />
                  </View>
                  <RCard padding={0} style={{ paddingHorizontal: 18 }}>
                    {list.map((tx, i) => (
                      <RTxRow
                        key={tx._id}
                        tx={tx}
                        last={i === list.length - 1}
                        onLongPress={() => onRowAction(tx)}
                      />
                    ))}
                  </RCard>
                </View>
              );
            })}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>

      <EditTransactionSheet
        visible={!!editing}
        editing={editing}
        categories={categories}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); bumpVersion(); }}
      />

      <TxFiltersSheet
        visible={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        initial={filters}
        categories={categories}
        onApply={(next) => setFilters(next)}
      />
    </View>
  );
}

/** Returns true when any filter beyond the default type=all is in effect. */
function hasActiveFilters(f: TxFilters): boolean {
  return f.type !== 'all'
    || f.categoryIds.length > 0
    || f.sources.length > 0
    || !!f.from || !!f.to
    || typeof f.minAmount === 'number'
    || typeof f.maxAmount === 'number';
}

/**
 * Turn the filter shape into a flat list of dismissible chips. Type isn't
 * included here - it has its own RPill row above.
 */
function summarizeFilters(
  f: TxFilters,
  categories: { _id: string; nameEn: string; nameAr?: string; emoji?: string }[],
  lang: 'en' | 'ar',
): Array<{ key: string; label: string; remove: (cur: TxFilters) => TxFilters }> {
  const chips: Array<{ key: string; label: string; remove: (cur: TxFilters) => TxFilters }> = [];

  if (f.from || f.to) {
    const label = `${f.from ?? '…'} → ${f.to ?? '…'}`;
    chips.push({
      key: 'date',
      label,
      remove: (cur) => ({ ...cur, from: undefined, to: undefined }),
    });
  }
  for (const id of f.categoryIds) {
    const cat = categories.find((c) => c._id === id);
    const name = cat ? ((lang === 'ar' && cat.nameAr) ? cat.nameAr : cat.nameEn) : '?';
    chips.push({
      key: `cat-${id}`,
      label: cat?.emoji ? `${cat.emoji} ${name}` : name,
      remove: (cur) => ({ ...cur, categoryIds: cur.categoryIds.filter((x) => x !== id) }),
    });
  }
  const sourceLabel: Record<string, string> = lang === 'ar'
    ? { manual: 'يدوي', seshat: 'سيشات', voice: 'صوت', bot: 'تيليجرام', notification: 'إشعار', 'receipt-ocr': 'إيصال' }
    : { manual: 'manual', seshat: 'seshat', voice: 'voice', bot: 'telegram', notification: 'notification', 'receipt-ocr': 'receipt' };
  for (const s of f.sources) {
    chips.push({
      key: `src-${s}`,
      label: sourceLabel[s] ?? s,
      remove: (cur) => ({ ...cur, sources: cur.sources.filter((x) => x !== s) }),
    });
  }
  if (typeof f.minAmount === 'number' || typeof f.maxAmount === 'number') {
    const label = `${f.minAmount ?? '…'} – ${f.maxAmount ?? '…'}`;
    chips.push({
      key: 'amount',
      label,
      remove: (cur) => ({ ...cur, minAmount: undefined, maxAmount: undefined }),
    });
  }
  return chips;
}
