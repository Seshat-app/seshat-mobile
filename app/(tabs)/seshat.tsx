import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus, Sparkles, ChevronRight, Trash2 } from 'lucide-react-native';
import { apiFetch, hasToken } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useAppData } from '../../lib/appData';
import { fontBody, fontHead, fontMono } from '../../lib/fonts';
import { REyebrow, RCard } from '../../components/ui';

/**
 * Seshat tab landing screen - shows the list of chat sessions in the
 * current workspace. Tap a row to enter the chat view; "+" creates a new
 * session and routes into it.
 *
 * Replaces the older single-stream chat UX. Each session is its own
 * conversation thread with its own LLM memory.
 */

type SessionSummary = {
  id: string;
  title: string;
  lastMessageAt: string;
  createdAt: string;
  messageCount: number;
};

export default function SeshatSessionsScreen() {
  const router = useRouter();
  const { tok, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const { activeLedgerId } = useAppData();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!(await hasToken())) return;
    if (mode === 'initial') setLoading(true); else setRefreshing(true);
    try {
      const r = await apiFetch<{ data: SessionSummary[] }>('/chat/sessions');
      setSessions(r.data ?? []);
    } catch (err) {
      console.warn('load sessions failed', err);
    } finally {
      if (mode === 'initial') setLoading(false); else setRefreshing(false);
    }
  }, []);

  // Refresh whenever the tab regains focus (e.g. after returning from a
  // chat view that may have changed lastMessageAt or created a session).
  // Also re-runs when the active workspace changes.
  useFocusEffect(useCallback(() => {
    load();
    return () => {};
  }, [load, activeLedgerId]));

  const startNew = () => {
    // Use the literal "new" segment - the chat view treats it as "no
    // session yet" and the first send creates one server-side.
    router.push('/seshat/new');
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
              await apiFetch(`/chat/sessions/${s.id}`, { method: 'DELETE' });
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

  return (
    <View style={{ flex: 1, backgroundColor: tok.void, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{
        paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10,
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <View style={{ flexShrink: 1, flex: 1 }}>
          <Text style={{
            fontFamily: fontHead(lang), fontSize: 24, color: tok.bone, letterSpacing: -0.4,
          }}>
            {lang === 'ar' ? 'سيشات' : 'Seshat'}
          </Text>
          <REyebrow style={{ marginTop: 4, textAlign: lang === 'ar' ? 'right' : 'left' }}>
            {lang === 'ar' ? 'محادثاتك' : 'Your conversations'}
          </REyebrow>
        </View>
        <Pressable
          onPress={startNew}
          hitSlop={8}
          style={({ pressed }) => ({
            flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
            alignItems: 'center', gap: 6,
            paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
            backgroundColor: pressed ? tok.goldLight : tok.gold,
          })}
        >
          <Plus size={16} color={tok.void} strokeWidth={2.2} />
          <Text style={{
            fontFamily: fontBody(lang, 'semibold'), fontSize: 13, color: tok.void,
          }}>
            {lang === 'ar' ? 'محادثة جديدة' : 'New chat'}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <RCard padding={32}><ActivityIndicator color={tok.gold} /></RCard>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
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
                  {lang === 'ar'
                    ? 'ابدأ محادثة جديدة - اكتب، تحدث، أو ارفع إيصالاً.'
                    : 'Start a new chat — type, talk, or attach a receipt and I\'ll handle the rest.'}
                </Text>
                <Pressable
                  onPress={startNew}
                  style={({ pressed }) => ({
                    marginTop: 4,
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
                    backgroundColor: pressed ? tok.goldLight : tok.gold,
                  })}
                >
                  <Plus size={14} color={tok.void} strokeWidth={2.2} />
                  <Text style={{
                    fontFamily: fontBody(lang, 'semibold'), fontSize: 13, color: tok.void,
                  }}>
                    {lang === 'ar' ? 'ابدأ' : 'Start a chat'}
                  </Text>
                </Pressable>
              </View>
            </RCard>
          ) : (
            <RCard padding={0} style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
              {sessions.map((s, i) => (
                <Pressable
                  key={s.id}
                  onPress={() => openSession(s.id)}
                  onLongPress={() => confirmDelete(s)}
                  delayLongPress={400}
                  disabled={deletingId === s.id}
                  style={({ pressed }) => ({
                    flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                    alignItems: 'center', gap: 12,
                    paddingVertical: 14,
                    borderBottomWidth: i === sessions.length - 1 ? 0 : StyleSheet.hairlineWidth,
                    borderBottomColor: tok.border,
                    opacity: pressed || deletingId === s.id ? 0.6 : 1,
                  })}
                >
                  <View style={{
                    width: 36, height: 36, borderRadius: 12,
                    backgroundColor: tok.surface,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Sparkles size={16} color={tok.gold} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
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
                  </View>
                  <ChevronRight
                    size={16} color={tok.muted}
                    style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }}
                  />
                </Pressable>
              ))}
            </RCard>
          )}

          {sessions.length > 0 && (
            <Text style={{
              marginTop: 14, fontFamily: fontMono(), fontSize: 10, color: tok.muted,
              textAlign: 'center',
            }}>
              {lang === 'ar' ? 'اضغط مطولاً لحذف محادثة' : 'Long-press a chat to delete'}
            </Text>
          )}
        </ScrollView>
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
