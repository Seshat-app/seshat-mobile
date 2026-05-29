import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { Mic } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { fontBody } from '../lib/fonts';
import { REyebrow } from './ui';

/**
 * Shared chat primitives used by the Seshat tab session list (TypingDots
 * is reused for the loading state) and the per-session chat view.
 * Extracted from the original single-file Seshat tab so the new sessions
 * route can render bubbles with the same look + animation behavior.
 */

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  // When true the bubble streams content character-by-character. Tap to skip.
  typing?: boolean;
  // Transaction _ids the agent created in response to this turn. Renders a
  // small "Logged N entries" chip under the bubble when populated.
  createdTransactionIds?: string[];
};

export function ChatBubble({ message, onSkipTyping }: { message: Message; onSkipTyping: () => void }) {
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
        {/* "Logged N entries" chip - visible breadcrumb that this turn
            wrote to the user's data. */}
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

export function TypingDots() {
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

export function RecordingMicIcon({
  recording, muted, gold,
}: { recording: boolean; muted: string; gold: string }) {
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
  void gold;
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
