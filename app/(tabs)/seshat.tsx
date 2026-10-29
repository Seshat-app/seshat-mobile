import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable, RefreshControl,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import { ScrollView as ScreenScroll } from '../../components/Scroll';
import { FrostedHeader } from '../../components/FrostedHeader';
import { ScreenScaffold } from '../../components/Screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus, Sparkles, ChevronRight, Search, X, Pin, PinOff, Check } from 'lucide-react-native';
import { hasToken } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useAppData } from '../../lib/appData';
import { fontBody, fontHead, fontMono } from '../../lib/fonts';
import { REyebrow, RCard, RButton } from '../../components/ui';
import { usePersona, PERSONAS } from '../../lib/persona';
import {
  listSessions, renameSession, setSessionPinned, deleteSession,
  groupSessions, type SessionSummary, type SessionGroupKey,
} from '../../lib/chatSessions';

/**
 * Seshat tab landing screen - a real conversation browser for the current
 * persona: search (server-side ?q=), inline rename, pin toggle, and
 * Pinned / Today / Previous 7 days / Older grouping. Tap a row to enter the
 * chat view; "+" creates a new session and routes into it.
 */

export default function SeshatSessionsScreen() {
  const router = useRouter();
  const { tok, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const { activeLedgerId, setUnreadMaatTotal } = useAppData();
  // The active persona scopes the whole screen: threads are listed per persona
  // and a new chat inherits it. Persisted + set from the chat header's switcher
  // (this list has no switcher of its own — it just follows the active persona).
  const [persona] = usePersona();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);

  // Search — the input is uncontrolled-fast; `query` is debounced (~250ms)
  // before it hits the server via ?q=.
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQuery(searchInput.trim()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Inline rename state.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!(await hasToken())) return;
    if (mode === 'initial') setLoading(true); else setRefreshing(true);
    try {
      const data = await listSessions(persona, query);
      setSessions(data);
      // Propagate the total unread count to the tab bar badge. Only meaningful
      // for the unfiltered list, but a filtered count is still a lower bound.
      const total = data.reduce((sum, s) => sum + (s.unreadCount ?? 0), 0);
      setUnreadMaatTotal(total);
    } catch (err) {
      console.warn('load sessions failed', err);
    } finally {
      if (mode === 'initial') setLoading(false); else setRefreshing(false);
    }
  }, [setUnreadMaatTotal, persona, query]);

  // Refresh whenever the tab regains focus (e.g. after returning from a
  // chat view that may have changed lastMessageAt or created a session).
  // Also re-runs when the active workspace changes.
  useFocusEffect(useCallback(() => {
    load();
    return () => {};
  }, [load, activeLedgerId]));

  // Re-scope the list when the persona toggles (skip the mount run — the focus
  // effect above already loaded once).
  const firstPersonaRun = useRef(true);
  useEffect(() => {
    if (firstPersonaRun.current) { firstPersonaRun.current = false; return; }
    setSessions([]);
    load('initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona]);

  // Re-query when the debounced search term changes (skip the mount run).
  const firstQueryRun = useRef(true);
  useEffect(() => {
    if (firstQueryRun.current) { firstQueryRun.current = false; return; }
    load('initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const startNew = () => {
    // Use the literal "new" segment - the chat view treats it as "no
    // session yet" and the first send creates one server-side. The new chat
    // inherits the active persona so the backend applies the right capability.
    router.push({ pathname: '/seshat/[id]', params: { id: 'new', persona } });
  };

  const openSession = (id: string) => {
    router.push({ pathname: '/seshat/[id]', params: { id } });
  };

  const confirmDelete = (s: SessionSummary) => {
    Alert.alert(
      lang === 'ar' ? 'حذف المحادثة' : 'Delete chat',
      lang === 'ar'
        ? `هل تريد حذف "${s.title}"؟ لا يمكن التراجع.`
        : `Delete "${s.title}"? This can't be undone.`,
      [
        { text: lang === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'ar' ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(s.id);
            try {
              await deleteSession(s.id);
              setSessions((prev) => prev.filter((x) => x.id !== s.id));
            } catch (err) {
              console.warn('delete session failed', err);
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  // ── row actions menu (long-press) ──
  const openRowMenu = (s: SessionSummary) => {
    Alert.alert(
      s.title,
      undefined,
      [
        {
          text: s.pinned
            ? (lang === 'ar' ? 'إلغاء التثبيت' : 'Unpin')
            : (lang === 'ar' ? 'تثبيت' : 'Pin'),
          onPress: () => togglePin(s),
        },
        {
          text: lang === 'ar' ? 'إعادة تسمية' : 'Rename',
          onPress: () => beginRename(s),
        },
        {
          text: lang === 'ar' ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: () => confirmDelete(s),
        },
        { text: lang === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
      ],
    );
  };

  // ── pin toggle (optimistic, then refetch to re-sort) ──
  const togglePin = async (s: SessionSummary) => {
    const pinned = !s.pinned;
    setPinningId(s.id);
    setSessions((prev) => prev.map((x) => (x.id === s.id ? { ...x, pinned } : x)));
    try {
      await setSessionPinned(s.id, pinned);
      await load('refresh');
    } catch (err) {
      console.warn('pin toggle failed', err);
      // Revert on failure.
      setSessions((prev) => prev.map((x) => (x.id === s.id ? { ...x, pinned: !pinned } : x)));
    } finally {
      setPinningId(null);
    }
  };

  // ── inline rename ──
  const beginRename = (s: SessionSummary) => {
    setRenamingId(s.id);
    setRenameDraft(s.title || '');
  };
  const cancelRename = () => {
    setRenamingId(null);
    setRenameDraft('');
  };
  const commitRename = async (id: string) => {
    const title = renameDraft.trim().slice(0, 80);
    const current = sessions.find((s) => s.id === id);
    setRenamingId(null);
    setRenameDraft('');
    // Empty or unchanged → no-op (backend also ignores a blank title).
    if (!title || title === (current?.title ?? '')) return;
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));
    try {
      await renameSession(id, title);
    } catch (err) {
      console.warn('rename failed', err);
      load('refresh'); // reconcile
    }
  };

  const groups = useMemo(() => groupSessions(sessions), [sessions]);

  const groupLabel = (key: SessionGroupKey): string => {
    if (lang === 'ar') {
      return key === 'pinned' ? 'مثبتة'
        : key === 'today' ? 'اليوم'
        : key === 'week' ? 'آخر ٧ أيام'
        : 'أقدم';
    }
    return key === 'pinned' ? 'Pinned'
      : key === 'today' ? 'Today'
      : key === 'week' ? 'Previous 7 days'
      : 'Older';
  };

  const searching = query.length > 0;

  return (
    <ScreenScaffold>
      {/* Header */}
      <FrostedHeader style={{
        paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10,
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <View style={{ flexShrink: 1, flex: 1 }}>
          <Text style={{
            fontFamily: fontHead(lang), fontSize: 24, color: tok.bone, letterSpacing: -0.4,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>
            {PERSONAS[persona].name[lang]}
          </Text>
          <REyebrow style={{ marginTop: 4, textAlign: lang === 'ar' ? 'right' : 'left' }}>
            {lang === 'ar' ? 'محادثاتك' : 'Your conversations'}
          </REyebrow>
        </View>
        <RButton
          onPress={startNew}
          icon={<Plus size={16} color={tok.void} strokeWidth={2.2} />}
        >
          {lang === 'ar' ? 'محادثة جديدة' : 'New chat'}
        </RButton>
      </FrostedHeader>

      {/* Search */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          alignItems: 'center', gap: 8,
          paddingHorizontal: 12, height: 42, borderRadius: 12,
          backgroundColor: tok.surface, borderWidth: 1, borderColor: tok.border,
        }}>
          <Search size={15} color={tok.muted} />
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder={lang === 'ar' ? 'ابحث في المحادثات' : 'Search conversations'}
            placeholderTextColor={tok.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={{
              flex: 1, color: tok.bone, fontFamily: fontBody(lang), fontSize: 14,
              paddingVertical: 0,
              textAlign: lang === 'ar' ? 'right' : 'left',
              writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
            }}
          />
          {searchInput.length > 0 && (
            <Pressable onPress={() => setSearchInput('')} hitSlop={8}>
              <X size={15} color={tok.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <RCard padding={32}><ActivityIndicator color={tok.gold} /></RCard>
        </View>
      ) : (
        <ScreenScroll
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 90, paddingTop: 4 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load('refresh')}
              tintColor={tok.gold}
              colors={[tok.gold]}
              progressBackgroundColor={tok.surface}
            />
          }
        >
          {sessions.length === 0 ? (
            searching ? (
              <RCard padding={28}>
                <View style={{ alignItems: 'center', gap: 10 }}>
                  <View style={{
                    width: 48, height: 48, borderRadius: 24,
                    backgroundColor: tok.surface, borderWidth: 1, borderColor: tok.border,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Search size={20} color={tok.muted} />
                  </View>
                  <Text style={{
                    fontFamily: fontHead(lang), fontSize: 16, color: tok.bone,
                    textAlign: 'center', letterSpacing: -0.2,
                  }}>
                    {lang === 'ar' ? 'لا توجد نتائج' : 'No matches'}
                  </Text>
                  <Text style={{
                    fontFamily: fontBody(lang), fontSize: 13, lineHeight: 19, color: tok.muted,
                    textAlign: 'center', paddingHorizontal: 6,
                  }}>
                    {lang === 'ar'
                      ? `لا توجد محادثات تطابق "${query}".`
                      : `No conversations match "${query}".`}
                  </Text>
                </View>
              </RCard>
            ) : (
              <RCard padding={28}>
                <View style={{ alignItems: 'center', gap: 12 }}>
                  <View style={{
                    width: 48, height: 48, borderRadius: 24,
                    backgroundColor: tok.surface, borderWidth: 1, borderColor: tok.gold,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Sparkles size={20} color={tok.gold} />
                  </View>
                  <Text style={{
                    fontFamily: fontHead(lang), fontSize: 17, color: tok.bone,
                    textAlign: 'center', letterSpacing: -0.2,
                  }}>
                    {lang === 'ar' ? 'لا توجد محادثات بعد' : 'No conversations yet'}
                  </Text>
                  <Text style={{
                    fontFamily: fontBody(lang), fontSize: 13.5, lineHeight: 20, color: tok.muted,
                    textAlign: 'center', paddingHorizontal: 6,
                  }}>
                    {persona === 'maat'
                      ? (lang === 'ar'
                          ? 'ابدأ محادثة جديدة — اسأل ماعت عن تقرير أو تحليل لشهرك.'
                          : 'Start a new chat. Ask Maat for a report, a breakdown or a verdict on your month.')
                      : (lang === 'ar'
                          ? 'ابدأ محادثة جديدة - اكتب، تحدث، أو ارفع إيصالاً.'
                          : 'Start a new chat. Type, talk, or attach a receipt and I\'ll handle the rest.')}
                  </Text>
                  <RButton
                    onPress={startNew}
                    style={{ marginTop: 4 }}
                    icon={<Plus size={14} color={tok.void} strokeWidth={2.2} />}
                  >
                    {lang === 'ar' ? 'ابدأ' : 'Start a chat'}
                  </RButton>
                </View>
              </RCard>
            )
          ) : (
            groups.map((group) => (
              <View key={group.key} style={{ marginBottom: 12 }}>
                <Text style={{
                  fontFamily: fontMono(), fontSize: 10, letterSpacing: 1.2,
                  color: tok.muted, textTransform: 'uppercase',
                  marginBottom: 6, marginHorizontal: 4,
                  textAlign: lang === 'ar' ? 'right' : 'left',
                }}>
                  {groupLabel(group.key)}
                </Text>
                <RCard padding={0} style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
                  {group.items.map((s, i) => (
                    <SessionRow
                      key={s.id}
                      s={s}
                      last={i === group.items.length - 1}
                      lang={lang}
                      tok={tok}
                      renaming={renamingId === s.id}
                      renameDraft={renameDraft}
                      onRenameDraft={setRenameDraft}
                      onCommitRename={() => commitRename(s.id)}
                      onCancelRename={cancelRename}
                      busy={deletingId === s.id || pinningId === s.id}
                      onOpen={() => openSession(s.id)}
                      onMenu={() => openRowMenu(s)}
                      onTogglePin={() => togglePin(s)}
                    />
                  ))}
                </RCard>
              </View>
            ))
          )}

          {sessions.length > 0 && (
            <Text style={{
              marginTop: 6, fontFamily: fontMono(), fontSize: 10, color: tok.muted,
              textAlign: 'center',
            }}>
              {lang === 'ar' ? 'اضغط مطولاً على محادثة للمزيد' : 'Long-press a chat for more'}
            </Text>
          )}
        </ScreenScroll>
      )}
    </ScreenScaffold>
  );
}

// ─────────────────────────────────────────────────────────────
// One session row — icon, title (or inline rename field), meta line,
// pin toggle, unread dot, chevron. Long-press opens the actions menu.
// ─────────────────────────────────────────────────────────────
function SessionRow({
  s, last, lang, tok, renaming, renameDraft, onRenameDraft, onCommitRename,
  onCancelRename, busy, onOpen, onMenu, onTogglePin,
}: {
  s: SessionSummary;
  last: boolean;
  lang: 'en' | 'ar';
  tok: any;
  renaming: boolean;
  renameDraft: string;
  onRenameDraft: (v: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  busy: boolean;
  onOpen: () => void;
  onMenu: () => void;
  onTogglePin: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', gap: 12,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: tok.border,
      }}
    >
      <Pressable
        onPress={renaming ? undefined : onOpen}
        onLongPress={renaming ? undefined : onMenu}
        delayLongPress={350}
        disabled={busy || renaming}
        style={({ pressed }) => ({
          flex: 1, minWidth: 0,
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          alignItems: 'center', gap: 12,
          paddingVertical: 14,
          opacity: pressed || busy ? 0.6 : 1,
        })}
      >
        <View style={{
          width: 36, height: 36, borderRadius: 12,
          backgroundColor: tok.surface,
          alignItems: 'center', justifyContent: 'center',
        }}>
          {s.pinned
            ? <Pin size={15} color={tok.gold} fill={tok.gold} />
            : <Sparkles size={16} color={tok.gold} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {renaming ? (
            <TextInput
              value={renameDraft}
              onChangeText={onRenameDraft}
              autoFocus
              maxLength={80}
              onSubmitEditing={onCommitRename}
              onBlur={onCommitRename}
              returnKeyType="done"
              placeholder={lang === 'ar' ? 'عنوان المحادثة' : 'Chat title'}
              placeholderTextColor={tok.muted}
              style={{
                fontFamily: fontBody(lang, 'medium'), fontSize: 14, color: tok.bone,
                padding: 0, paddingVertical: 2,
                borderBottomWidth: 1, borderBottomColor: tok.gold,
                textAlign: lang === 'ar' ? 'right' : 'left',
                writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
              }}
            />
          ) : (
            <>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: fontBody(lang, 'medium'), fontSize: 14, color: tok.bone,
                  textAlign: lang === 'ar' ? 'right' : 'left',
                }}
              >
                {s.title}
              </Text>
              <Text style={{
                marginTop: 2,
                fontFamily: fontMono(), fontSize: 10.5, color: tok.muted,
                textAlign: lang === 'ar' ? 'right' : 'left',
              }}>
                {formatRelative(s.lastMessageAt, lang)} · {s.messageCount} {lang === 'ar' ? 'رسالة' : 'msgs'}
              </Text>
            </>
          )}
        </View>
      </Pressable>

      {renaming ? (
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row', alignItems: 'center', gap: 4,
        }}>
          <Pressable onPress={onCommitRename} hitSlop={8} style={({ pressed }) => ({
            width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}>
            <Check size={16} color={tok.gold} strokeWidth={2.4} />
          </Pressable>
          <Pressable onPress={onCancelRename} hitSlop={8} style={({ pressed }) => ({
            width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}>
            <X size={16} color={tok.muted} strokeWidth={2.2} />
          </Pressable>
        </View>
      ) : (
        <>
          {(s.unreadCount ?? 0) > 0 && (
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tok.gold }} />
          )}
          <Pressable
            onPress={onTogglePin}
            disabled={busy}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={s.pinned
              ? (lang === 'ar' ? 'إلغاء التثبيت' : 'Unpin')
              : (lang === 'ar' ? 'تثبيت' : 'Pin')}
            style={({ pressed }) => ({
              width: 30, height: 30, borderRadius: 8,
              alignItems: 'center', justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            {s.pinned
              ? <Pin size={15} color={tok.gold} fill={tok.gold} />
              : <PinOff size={15} color={tok.muted} />}
          </Pressable>
          <ChevronRight
            size={16} color={tok.muted}
            style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }}
          />
        </>
      )}
    </View>
  );
}

function formatRelative(iso: string, lang: 'en' | 'ar'): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (lang === 'ar') {
    if (min < 1) return 'الآن';
    if (min < 60) return `${min} د`;
    if (hr < 24) return `${hr} س`;
    if (day < 7) return `${day} ي`;
    return d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
  }
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
