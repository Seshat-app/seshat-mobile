import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, StyleSheet, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUp, Mic } from 'lucide-react-native';
import { apiFetch, hasToken } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { fontBody, fontHead } from '../../lib/fonts';
import { RadarMark } from '../../components/RadarMark';
import { REyebrow } from '../../components/ui';
import { useRecorder } from '../../components/useRecorder';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  // When true the bubble streams content character-by-character. Tap to skip.
  typing?: boolean;
  // Transaction _ids the agent created in response to this turn. We render
  // a small "Seshat logged N entries" chip under the bubble when populated.
  createdTransactionIds?: string[];
};

const QUICK_CHIPS_EN = ['Month summary', 'Where do I spend most?', 'How am I doing?'];
const QUICK_CHIPS_AR = ['ملخص الشهر', 'أين أنفق أكثر؟', 'كم متبقي؟'];

export default function SeshatScreen() {
  const { tok, lang, t } = useI18n();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'assistant', content: t('seshatTabIntro') },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const recorder = useRecorder();

  // Load persisted chat history on mount. Server returns oldest-first so
  // we can render the array as-is. If there's any history, replace the
  // welcome message - that's a first-launch state, not a returning user.
  useEffect(() => {
    (async () => {
      try {
        if (!(await hasToken())) return;
        const r = await apiFetch<{ data: Array<{
          id: string; role: 'user' | 'assistant'; content: string;
          createdAt: string; createdTransactionIds?: string[];
        }> }>('/chat');
        if (r.data?.length) {
          setMessages(r.data.map((m) => ({
            id: m.id, role: m.role, content: m.content,
            createdTransactionIds: m.createdTransactionIds,
          })));
          // Jump to bottom after layout settles.
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 80);
        }
      } catch (err) {
        console.warn('chat history load failed', err);
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, []);

  // Voice flow: tap-and-hold mic → record → release → upload audio → render
  // both the user's transcript bubble and Seshat's typed reply.
  const sendVoice = async () => {
    const res = await recorder.stop();
    if (!res || sending) return;
    const has = await hasToken();
    if (!has) {
      setMessages((prev) => [...prev, { id: String(Date.now()), role: 'assistant', content: t('signInFirst'), typing: true }]);
      return;
    }
    setSending(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    try {
      const r = await apiFetch<{ data: { transcript: string; reply: string; createdTransactionIds?: string[] } }>('/voice/chat', {
        method: 'POST',
        body: JSON.stringify({ audio_base64: res.base64, format: res.format, language: lang }),
      });
      const ts = Date.now();
      setMessages((prev) => [
        ...prev,
        { id: String(ts), role: 'user', content: r.data.transcript || '🎙️' },
        {
          id: String(ts + 1), role: 'assistant', content: r.data.reply, typing: true,
          createdTransactionIds: r.data.createdTransactionIds,
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('somethingWrong');
      setMessages((prev) => [...prev, { id: String(Date.now()), role: 'assistant', content: msg, typing: true }]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;

    const has = await hasToken();
    if (!has) {
      setMessages((prev) => [...prev, { id: String(Date.now()), role: 'assistant', content: t('signInFirst') }]);
      return;
    }

    const userMsg: Message = { id: String(Date.now()), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      const res = await apiFetch<{ data: { reply: string; createdTransactionIds?: string[] } }>('/chat', {
        method: 'POST', body: JSON.stringify({ message: text }),
      });
      setMessages((prev) => [...prev, {
        id: String(Date.now() + 1), role: 'assistant', content: res.data.reply, typing: true,
        createdTransactionIds: res.data.createdTransactionIds,
      }]);
    } catch {
      setMessages((prev) => [...prev, { id: String(Date.now() + 1), role: 'assistant', content: t('somethingWrong'), typing: true }]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  const chips = lang === 'ar' ? QUICK_CHIPS_AR : QUICK_CHIPS_EN;

  return (
    <KeyboardAvoidingView
      // 'padding' on both platforms. On Android with edge-to-edge enabled,
      // the previous `undefined` behavior leaned on adjust-resize, which is
      // a no-op when the activity is drawing under the system bars - the
      // chat input ended up hidden beneath the keyboard with no way to see
      // what you were typing.
      behavior="padding"
      style={{ flex: 1, backgroundColor: tok.void, paddingTop: insets.top }}
    >
      <View style={{
        paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8,
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', gap: 10,
      }}>
        <RadarMark size={22} gold={tok.gold} lightRing />
        <View>
          <Text style={{
            fontFamily: fontHead(lang), fontSize: 18,
            color: tok.bone, letterSpacing: -0.4,
          }}>{t('seshat')}</Text>
          <REyebrow color={tok.posText} style={{ marginTop: 2 }}>● {t('seshatAvailable')}</REyebrow>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((m) => (
          <ChatBubble
            key={m.id}
            message={m}
            onSkipTyping={() => setMessages((prev) => prev.map((p) => p.id === m.id ? { ...p, typing: false } : p))}
          />
        ))}
        {sending && <TypingDots />}

        {/* Quick chips — only on the welcome screen, before any send. */}
        {messages.length === 1 && (
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, marginTop: 8 }}
            contentContainerStyle={{ gap: 8, alignItems: 'center' }}
          >
            {chips.map((c) => (
              <Pressable
                key={c}
                onPress={() => send(c)}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? tok.elevated : tok.surface,
                  borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
                  borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7,
                })}
              >
                <Text style={{ color: tok.muted, fontFamily: fontBody(lang), fontSize: 12 }}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </ScrollView>

      <View style={{
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        paddingHorizontal: 16, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 28 : 12,
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tok.border,
        backgroundColor: tok.navBg,
        alignItems: 'center', gap: 8,
      }}>
        <View style={{
          flex: 1, minHeight: 44,
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          alignItems: 'center', gap: 8,
          backgroundColor: tok.surface, borderWidth: 1, borderColor: tok.border,
          borderRadius: 14, paddingHorizontal: 12,
        }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send()}
            placeholder={recorder.isRecording ? (lang === 'ar' ? 'يتم التسجيل…' : 'Recording…') : t('message')}
            placeholderTextColor={recorder.isRecording ? tok.gold : tok.muted}
            returnKeyType="send"
            multiline
            editable={!sending && !recorder.isRecording}
            style={{
              flex: 1, color: tok.bone, fontFamily: fontBody(lang), fontSize: 14,
              paddingVertical: Platform.OS === 'ios' ? 12 : 8,
              maxHeight: 100,
              writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
              textAlign: lang === 'ar' ? 'right' : 'left',
            }}
          />
          {/* Tap-and-hold mic. Press in → start recording. Press out → stop +
              upload to /voice/chat. Drag off cancels (we don't track that
              precisely here — release always sends). */}
          <Pressable
            onPressIn={() => { if (!sending) recorder.start(); }}
            onPressOut={() => { if (recorder.isRecording) sendVoice(); }}
            disabled={sending}
            hitSlop={8}
            style={{
              padding: 4,
              opacity: sending ? 0.4 : 1,
            }}
            accessibilityLabel="Hold to record"
          >
            <RecordingMicIcon recording={recorder.isRecording} muted={tok.muted} gold={tok.gold} />
          </Pressable>
        </View>
        <Pressable
          onPress={() => send()}
          disabled={!input.trim() || sending}
          style={({ pressed }) => ({
            backgroundColor: input.trim() && !sending ? tok.gold : tok.elevated,
            width: 44, height: 44, borderRadius: 14,
            alignItems: 'center', justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <ArrowUp size={18} color={input.trim() && !sending ? '#0D0D0D' : tok.muted} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────
// ChatBubble — renders one message. Assistant replies marked as
// typing reveal characters at ~32 chars/sec; tapping skips.
// ─────────────────────────────────────────────────────────────
function ChatBubble({ message, onSkipTyping }: { message: Message; onSkipTyping: () => void }) {
  const { tok, lang, t } = useI18n();
  const [visibleLen, setVisibleLen] = useState(message.typing ? 0 : message.content.length);

  useEffect(() => {
    if (!message.typing) {
      setVisibleLen(message.content.length);
      return;
    }
    setVisibleLen(0);
    const total = message.content.length;
    let i = 0;
    const tick = () => {
      // Reveal in small bursts so longer replies don't take forever.
      // Roughly 32 chars/sec; bumps by 2 chars per 16ms tick.
      i = Math.min(total, i + 2);
      setVisibleLen(i);
      if (i < total) timer = setTimeout(tick, 30);
    };
    let timer = setTimeout(tick, 30);
    return () => clearTimeout(timer);
  }, [message.id, message.typing]);

  const isAssistant = message.role === 'assistant';
  const shown = message.content.slice(0, visibleLen);
  const stillTyping = isAssistant && visibleLen < message.content.length;

  return (
    <Pressable onPress={stillTyping ? onSkipTyping : undefined}>
      <View
        style={{
          maxWidth: '82%',
          alignSelf: isAssistant ? 'flex-start' : 'flex-end',
          backgroundColor: isAssistant ? tok.surface : tok.elevated,
          borderRadius: 14, padding: 12,
          marginBottom: 10,
          ...(isAssistant
            ? {
                borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
                ...(lang === 'ar'
                  ? { borderRightWidth: 2, borderRightColor: tok.gold }
                  : { borderLeftWidth: 2, borderLeftColor: tok.gold }),
              }
            : {}),
        }}
      >
        {isAssistant && (
          <REyebrow color={tok.gold} style={{ marginBottom: 4 }}>{t('seshat')}</REyebrow>
        )}
        <Text style={{
          color: tok.bone, fontFamily: fontBody(lang), fontSize: lang === 'ar' ? 15 : 14, lineHeight: 22,
          textAlign: lang === 'ar' ? 'right' : 'left',
          writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
        }}>
          {shown}
          {stillTyping && <Text style={{ color: tok.gold }}>▍</Text>}
        </Text>
        {/* "Seshat logged N entries" chip appears under the assistant bubble
            when this turn created transactions. Visual breadcrumb so the
            user knows the chat actually did something to their data. */}
        {isAssistant && !stillTyping && message.createdTransactionIds && message.createdTransactionIds.length > 0 && (
          <View style={{
            marginTop: 8,
            paddingHorizontal: 10, paddingVertical: 6,
            borderRadius: 8,
            backgroundColor: tok.elevated,
            borderWidth: StyleSheet.hairlineWidth, borderColor: tok.gold,
            alignSelf: lang === 'ar' ? 'flex-end' : 'flex-start',
          }}>
            <Text style={{
              fontFamily: fontBody(lang), fontSize: 11, color: tok.gold,
            }}>
              {lang === 'ar'
                ? `سجّلت ${message.createdTransactionIds.length} معاملة`
                : `Logged ${message.createdTransactionIds.length} ${message.createdTransactionIds.length === 1 ? 'entry' : 'entries'}`}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// TypingDots — three pulsing dots while Seshat is computing
// (before any text has arrived).
// ─────────────────────────────────────────────────────────────
function TypingDots() {
  const { tok, lang } = useI18n();
  return (
    <View style={{
      alignSelf: 'flex-start',
      backgroundColor: tok.surface,
      borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
      borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
      ...(lang === 'ar'
        ? { borderRightWidth: 2, borderRightColor: tok.gold }
        : { borderLeftWidth: 2, borderLeftColor: tok.gold }),
      flexDirection: 'row', alignItems: 'center', gap: 6,
      marginBottom: 10,
    }}>
      <Dot delay={0} />
      <Dot delay={180} />
      <Dot delay={360} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// RecordingMicIcon — gold mic when idle, pulsing red mic when
// the recorder is live so the user knows audio is being captured.
// ─────────────────────────────────────────────────────────────
function RecordingMicIcon({ recording, muted, gold }: { recording: boolean; muted: string; gold: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!recording) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [recording]);
  return (
    <Animated.View style={{ opacity: pulse }}>
      <Mic size={18} color={recording ? '#E05555' : muted} strokeWidth={recording ? 2 : 1.5} />
    </Animated.View>
  );
}

function Dot({ delay }: { delay: number }) {
  const { tok } = useI18n();
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 360, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      style={{
        width: 7, height: 7, borderRadius: 4,
        backgroundColor: tok.gold,
        opacity,
      }}
    />
  );
}
