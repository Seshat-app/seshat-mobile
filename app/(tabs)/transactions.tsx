import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, Alert } from 'react-native';
// Search + filter chips sit between the header and this list, so it must clip (not slide under them).
import { FlatList as ScreenFlatList } from 'react-native';
import { FrostedHeader } from '../../components/FrostedHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SlidersHorizontal } from 'lucide-react-native';
import { apiFetch, hasToken } from '../../lib/api';
import { useI18n, monthYear } from '../../lib/i18n';
import { useAppData } from '../../lib/appData';
import { fontBody, fontHead } from '../../lib/fonts';
import { RCard, REyebrow, RPill, RHScroll, RAmount, RField, RChip } from '../../components/ui';
import { ScreenScaffold } from '../../components/Screen';
import { RTxRow, RefreshSpinner, type TxRowData } from '../../components/shell';
import { SkeletonRow } from '../../components/Skeleton';
import { EditTransactionSheet, type EditingTx } from '../../components/EditTransactionSheet';
import { TxFiltersSheet, EMPTY_FILTERS, type TxFilters } from '../../components/TxFiltersSheet';

export default function TransactionsScreen() {
  const { tok, lang, t } = useI18n();
  const { dataVersion, categories, projects, bumpVersion } = useAppData();
  const insets = useSafeAreaInsets();
  const [txs, setTxs] = useState<TxRowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<TxFilters>(EMPTY_FILTERS);
  // Project filter is single-select and lives outside the FiltersSheet for
  // quick switching: null = no filter, 'none' = only untagged tx, else id.
  const [projectFilter, setProjectFilter] = useState<string | 'none' | null>(null);
  // Whenever the workspace switches off an org ledger (projects becomes
  // empty), drop any in-flight project filter so we don't ship a stale id.
  useEffect(() => {
    if (projects.length === 0 && projectFilter !== null) setProjectFilter(null);
  }, [projects.length, projectFilter]);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Debounce the search box so we fetch once the user pauses, not on every
  // keystroke (which also avoids out-of-order responses).
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(id);
  }, [query]);
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
      if (projectFilter) params.set('projectId', projectFilter);
      params.set('limit', '100');
      if (debouncedQuery.trim()) params.set('search', debouncedQuery.trim());
      const res = await apiFetch<{ data: TxRowData[] }>(`/transactions?${params.toString()}`);
      setTxs(res.data);
    } catch (err) {
      console.warn('tx fetch failed', err);
    } finally {
      if (mode === 'initial') setLoading(false);
      else setRefreshing(false);
    }
  }, [filters, debouncedQuery, projectFilter]);

  useEffect(() => { fetchTxs('initial'); }, [fetchTxs, dataVersion]);

  // Group by relative day for the section headers (Today / Yesterday / older).
  // Each entry also carries a precomputed dayTotal so the render loop can read
  // it directly instead of calling .reduce() per group on every render pass.
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
    return Array.from(map.entries()).map(([day, list]) => ({
      day,
      list,
      dayTotal: list.reduce((s, tx) => s + (tx.type === 'income' ? tx.amount : -tx.amount), 0),
    }));
  }, [txs, lang, t]);

  return (
    <ScreenScaffold>
      <FrostedHeader style={{
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
      </FrostedHeader>

      <View style={{ paddingHorizontal: 16, flex: 1 }}>
        {/* Search + filter */}
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          gap: 8, marginBottom: 14, alignItems: 'center',
        }}>
          <RField
            value={query}
            onChange={setQuery}
            placeholder={t('search')}
            style={{ flex: 1 }}
          />
          <RPill
            active={hasActiveFilters(filters)}
            onPress={() => setFilterSheetOpen(true)}
            icon={<SlidersHorizontal size={16} color={hasActiveFilters(filters) ? tok.void : tok.muted} />}
            style={{ paddingVertical: 12, paddingHorizontal: 12, gap: 0 }}
          >
            {''}
          </RPill>
        </View>

        {/* Project filter row - only rendered when the active workspace has
            projects (an org ledger). Single-select: "All", "No project"
            (untagged), then one chip per active project. */}
        {projects.length > 0 ? (
          <RHScroll style={{ marginBottom: 8 }}>
            <RPill active={projectFilter === null} onPress={() => setProjectFilter(null)}>
              {lang === 'ar' ? 'كل المشاريع' : 'All projects'}
            </RPill>
            <RPill active={projectFilter === 'none'} onPress={() => setProjectFilter('none')}>
              {lang === 'ar' ? 'بدون مشروع' : 'No project'}
            </RPill>
            {projects.map((p) => (
              <RPill
                key={p._id}
                active={projectFilter === p._id}
                onPress={() => setProjectFilter(p._id)}
              >
                {p.name}
              </RPill>
            ))}
          </RHScroll>
        ) : null}

        {/* Active filter chips - one chip per active filter dimension. Tap an
            x on a chip to drop just that filter. Type segmented stays as the
            quick top-level toggle. */}
        <RHScroll style={{ marginBottom: 14 }}>
          <RPill active={filters.type === 'all'} onPress={() => setFilters((f) => ({ ...f, type: 'all' }))}>{t('all')}</RPill>
          <RPill active={filters.type === 'expense'} onPress={() => setFilters((f) => ({ ...f, type: 'expense' }))}>{t('expense')}</RPill>
          <RPill active={filters.type === 'income'} onPress={() => setFilters((f) => ({ ...f, type: 'income' }))}>{t('earned')}</RPill>
          {summarizeFilters(filters, categories, lang).map((chip) => (
            <RChip
              key={chip.key}
              label={chip.label}
              onRemove={() => setFilters(chip.remove)}
            />
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
          <ScreenFlatList
            data={groups}
            keyExtractor={(g) => g.day}
            showsVerticalScrollIndicator={false}
            // Bottom padding pads the END of scrollable content (clearing the
            // FAB + tab bar): safe-area inset plus tab-bar + FAB clearance.
            contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchTxs('refresh')}
                tintColor={tok.gold}
                colors={[tok.gold]}
                progressBackgroundColor={tok.surface}
              />
            }
            renderItem={({ item: { day, list, dayTotal } }) => (
              <View style={{ marginBottom: 14 }}>
                <View style={{
                  flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                  justifyContent: 'space-between', alignItems: 'baseline',
                  paddingHorizontal: 4, paddingBottom: 8,
                }}>
                  <REyebrow>{day}</REyebrow>
                  <RAmount value={dayTotal} size={11} weight="regular" currency={list[0]?.currency ?? 'EGP'} sign decimals={0} />
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
            )}
          />
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
    </ScreenScaffold>
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
    // Mirror the range arrow for Arabic (RTL) so it points start->end visually.
    const arrow = lang === 'ar' ? '←' : '→';
    const label = `${f.from ?? '…'} ${arrow} ${f.to ?? '…'}`;
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
      label: name,
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
