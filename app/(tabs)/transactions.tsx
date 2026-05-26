import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, SlidersHorizontal } from 'lucide-react-native';
import { apiFetch, hasToken } from '../../lib/api';
import { useI18n, monthYear } from '../../lib/i18n';
import { useAppData } from '../../lib/appData';
import { fontBody, fontHead, fontMono } from '../../lib/fonts';
import { RCard, REyebrow, RPill, RHScroll, RAmount } from '../../components/ui';
import { RTxRow, RefreshSpinner, type TxRowData } from '../../components/shell';
import { SkeletonRow } from '../../components/Skeleton';

type Filter = 'all' | 'income' | 'expense' | { categoryId: string };

export default function TransactionsScreen() {
  const { tok, lang, t } = useI18n();
  const { dataVersion, categories } = useAppData();
  const insets = useSafeAreaInsets();
  const [txs, setTxs] = useState<TxRowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [query, setQuery] = useState('');

  const fetchTxs = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    const has = await hasToken();
    if (!has) return;
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (filter === 'income' || filter === 'expense') params.set('type', filter);
      else if (typeof filter === 'object') params.set('categoryId', filter.categoryId);
      if (query.trim()) params.set('search', query.trim());
      const res = await apiFetch<{ data: TxRowData[] }>(`/transactions?${params.toString()}`);
      setTxs(res.data);
    } catch (err) {
      console.warn('tx fetch failed', err);
    } finally {
      if (mode === 'initial') setLoading(false);
      else setRefreshing(false);
    }
  }, [filter, query]);

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
            onPress={() => setFilterExpanded((x) => !x)}
            style={{
              backgroundColor: filterExpanded ? tok.gold : tok.surface,
              borderWidth: 1, borderColor: filterExpanded ? tok.gold : tok.border, borderRadius: 10,
              paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center',
            }}
          >
            <SlidersHorizontal size={16} color={filterExpanded ? '#0D0D0D' : tok.muted} />
          </Pressable>
        </View>

        {/* Filter pills — base trio always visible; categories revealed by the filter icon */}
        <RHScroll style={{ marginBottom: 14 }}>
          <RPill active={filter === 'all'} onPress={() => setFilter('all')}>{t('all')}</RPill>
          <RPill active={filter === 'expense'} onPress={() => setFilter('expense')}>{t('expense')}</RPill>
          <RPill active={filter === 'income'} onPress={() => setFilter('income')}>{t('earned')}</RPill>
          {filterExpanded && categories.map((c) => {
            const isActive = typeof filter === 'object' && filter.categoryId === c._id;
            return (
              <RPill
                key={c._id}
                active={isActive}
                onPress={() => setFilter(isActive ? 'all' : { categoryId: c._id })}
              >
                {lang === 'ar' && c.nameAr ? c.nameAr : c.nameEn}
              </RPill>
            );
          })}
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
                    {list.map((tx, i) => <RTxRow key={tx._id} tx={tx} last={i === list.length - 1} />)}
                  </RCard>
                </View>
              );
            })}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    </View>
  );
}
