import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, RefreshControl, ScrollView as RNScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronUp, MessageCircle, CheckCircle2, Users } from 'lucide-react-native';
import { ScrollView as ScreenScroll } from '../../components/Scroll';
import { PlanScreen } from '../../components/PlanShell';
import { RCard, RPill, RField, RButton } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { fontBody, fontMono } from '../../lib/fonts';
import { apiFetch } from '../../lib/api';
import { TAGS, tagLabel, timeAgo, type CQuestion } from '../../lib/community';

type Sort = 'new' | 'top' | 'unanswered';
type Page = { items: CQuestion[]; hasMore: boolean; page: number };

/** Community: members ask money questions and answer each other. */
export default function CommunityScreen() {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sort, setSort] = useState<Sort>('new');
  const [tag, setTag] = useState<string | null>(null);
  const [mine, setMine] = useState(false);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<CQuestion[] | null>(null);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async (p: number, replace: boolean) => {
    const my = ++seq.current;
    setBusy(true);
    try {
      const params = new URLSearchParams({ sort, page: String(p) });
      if (tag) params.set('tag', tag);
      if (mine) params.set('mine', '1');
      if (q.trim()) params.set('q', q.trim());
      const r = await apiFetch<{ data: Page }>(`/community/questions?${params.toString()}`);
      if (my !== seq.current) return;
      setItems((cur) => (replace || !cur ? r.data.items : [...cur, ...r.data.items]));
      setPage(r.data.page); setMore(r.data.hasMore);
    } catch { if (my === seq.current) setItems((cur) => cur ?? []); }
    finally { if (my === seq.current) { setBusy(false); setRefreshing(false); } }
  }, [sort, tag, mine, q]);

  // Reload when a filter changes (the search waits a moment for typing to stop).
  useEffect(() => { const t = setTimeout(() => { void load(1, true); }, q ? 350 : 0); return () => clearTimeout(t); }, [load, q]);
  // And when coming back from a question, so counts are current.
  useFocusEffect(useCallback(() => { if (items !== null) void load(1, true); }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  const Stat = ({ icon: Icon, n, hot }: { icon: typeof ChevronUp; n: number; hot?: boolean }) => (
    <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 }}>
      <Icon size={14} color={hot ? tok.gold : tok.muted} />
      <Text style={{ fontFamily: fontMono('regular'), fontSize: 12, color: hot ? tok.gold : tok.muted }}>{n}</Text>
    </View>
  );

  return (
    <PlanScreen
      title={ar ? 'المجتمع' : 'Community'}
      subtitle={ar ? 'اسأل وأجب في أمور المال' : 'Ask and answer money questions'}
      onAdd={() => router.push('/community/new' as never)}
      refreshing={refreshing}
    >
      <ScreenScroll
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100, paddingTop: 8, gap: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(1, true); }} tintColor={tok.gold} colors={[tok.gold]} progressBackgroundColor={tok.surface} />}
        onScroll={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          if (more && !busy && layoutMeasurement.height + contentOffset.y > contentSize.height - 400) void load(page + 1, false);
        }}
        scrollEventThrottle={200}
      >
        <RField value={q} onChange={setQ} placeholder={ar ? 'ابحث في الأسئلة' : 'Search questions'} />

        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 8, flexWrap: 'wrap' }}>
          {([['new', ar ? 'الأحدث' : 'New'], ['top', ar ? 'الأعلى' : 'Top'], ['unanswered', ar ? 'بلا إجابة' : 'Unanswered']] as const).map(([k, label]) => (
            <RPill key={k} active={sort === k && !mine} onPress={() => { setMine(false); setSort(k); }}>{label}</RPill>
          ))}
          <RPill active={mine} onPress={() => setMine((v) => !v)}>{ar ? 'أسئلتي' : 'My questions'}</RPill>
        </View>
        <RNScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: ar ? 'row-reverse' : 'row' }} style={{ flexGrow: 0 }}>
          <RPill active={tag === null} onPress={() => setTag(null)}>{ar ? 'الكل' : 'All'}</RPill>
          {TAGS.map((t) => <RPill key={t} active={tag === t} onPress={() => setTag(tag === t ? null : t)}>{tagLabel(t, ar)}</RPill>)}
        </RNScrollView>

        {items === null ? (
          <View style={{ paddingTop: 40 }}><ActivityIndicator color={tok.gold} /></View>
        ) : items.length === 0 ? (
          <View style={{ paddingTop: 40, alignItems: 'center', gap: 8 }}>
            <Users size={28} color={tok.muted} />
            <Text style={{ color: tok.bone, fontFamily: fontBody(lang, 'medium'), fontSize: 16, textAlign: 'center' }}>
              {q || tag || mine ? (ar ? 'لا نتائج.' : 'Nothing here.') : (ar ? 'لا أسئلة بعد.' : 'No questions yet.')}
            </Text>
            <Text style={{ color: tok.muted, fontFamily: fontBody(lang), fontSize: 13, textAlign: 'center', maxWidth: 290, lineHeight: 19 }}>
              {ar ? 'كن أول من يسأل. سؤالك قد يفيد غيرك أيضاً.' : 'Be the first to ask. Your question may help someone else too.'}
            </Text>
            <View style={{ marginTop: 14, alignSelf: 'center' }}><RButton onPress={() => router.push('/community/new' as never)}>{ar ? 'اطرح سؤالاً' : 'Ask a question'}</RButton></View>
          </View>
        ) : items.map((it) => (
          <Pressable key={it.id} onPress={() => router.push(`/community/${it.id}` as never)} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
            <RCard padding={16}>
              <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 15.5, lineHeight: 22, color: tok.bone, textAlign: it.lang === 'ar' ? 'right' : 'left', writingDirection: it.lang === 'ar' ? 'rtl' : 'ltr' }}>{it.title}</Text>
              {it.body ? (
                <Text numberOfLines={3} style={{ marginTop: 6, fontFamily: fontBody(lang), fontSize: 13.5, lineHeight: 20, color: tok.muted, textAlign: it.lang === 'ar' ? 'right' : 'left', writingDirection: it.lang === 'ar' ? 'rtl' : 'ltr' }}>{it.body}</Text>
              ) : null}
              <View style={{ marginTop: 10, flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 14 }}>
                <Stat icon={ChevronUp} n={it.votes} hot={it.myVote} />
                <Stat icon={MessageCircle} n={it.answers} />
                {it.accepted ? <CheckCircle2 size={15} color="#6FCF97" /> : null}
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: fontMono('regular'), fontSize: 11, color: tok.muted, textAlign: ar ? 'left' : 'right' }}>
                  {tagLabel(it.tag, ar)} · {it.mine ? (ar ? 'أنت' : 'You') : it.authorName} · {timeAgo(it.createdAt, ar)}
                </Text>
              </View>
              {it.status === 'hidden' ? (
                <Text style={{ marginTop: 8, fontFamily: fontBody(lang), fontSize: 12, color: tok.alertText, textAlign: ar ? 'right' : 'left' }}>{ar ? 'مخفي حتى تراجعه الإدارة.' : 'Hidden until the team reviews it.'}</Text>
              ) : null}
            </RCard>
          </Pressable>
        ))}
        {busy && items && items.length > 0 ? <ActivityIndicator color={tok.gold} /> : null}
        <Pressable onPress={() => router.push('/community/blocked' as never)} style={{ alignSelf: 'center', paddingVertical: 8 }}>
          <Text style={{ fontFamily: fontBody(lang), fontSize: 12.5, color: tok.muted }}>{ar ? 'الأعضاء المحظورون' : 'Blocked members'}</Text>
        </Pressable>
      </ScreenScroll>
    </PlanScreen>
  );
}
