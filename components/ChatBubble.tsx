import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, ActivityIndicator } from 'react-native';
import { Mic } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { fontBody, fontMono } from '../lib/fonts';
import { RChip } from './ui';

/**
 * Shared chat primitives used by the Maat tab session list (TypingDots is
 * reused for the loading state) and the per-session chat view.
 *
 * Bubble language: the assistant (Maat) speaks in a calm glass bubble with a
 * small gold dot + "Maat" label and a bottom tail on its anchored side; the
 * user speaks in a solid gold bubble (on-gold text = tok.void). Both flip
 * their anchor + tail for Arabic.
 */

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  // When true the bubble streams content character-by-character. Tap to skip.
  typing?: boolean;
  // Transient client-only state: an attachment is uploading before its turn
  // is actually sent. Renders a spinner inside the user bubble.
  uploading?: boolean;
  // Transaction _ids the agent created in response to this turn. Renders a
  // small "Logged N entries" chip under the bubble when populated.
  createdTransactionIds?: string[];
};

const BUBBLE_RADIUS = 18;
const TAIL = 5;

export function ChatBubble({ message, onSkipTyping }: { message: Message; onSkipTyping: () => void }) {
  const { tok, lang } = useI18n();
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
      // Reveal in small bursts (~32 chars/sec) so longer replies aren't slow.
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

  // Anchor + tail flip for RTL: assistant on the leading edge, user on the
  // trailing edge, with the tail corner on the bubble's anchored side.
  const anchor: 'flex-start' | 'flex-end' = isAssistant
    ? (lang === 'ar' ? 'flex-end' : 'flex-start')
    : (lang === 'ar' ? 'flex-start' : 'flex-end');
  const tailCorner = anchor === 'flex-start'
    ? { borderBottomLeftRadius: TAIL }
    : { borderBottomRightRadius: TAIL };

  return (
    <Pressable onPress={stillTyping ? onSkipTyping : undefined} style={{ alignSelf: anchor, maxWidth: '84%', marginBottom: 10 }}>
      <View
        style={{
          backgroundColor: isAssistant ? tok.coreBg : tok.gold,
          borderRadius: BUBBLE_RADIUS,
          ...tailCorner,
          paddingHorizontal: 14, paddingVertical: 12,
          ...(isAssistant
            ? {
                borderWidth: 1, borderColor: tok.shellBorder,
                borderTopColor: tok.coreSheen,
              }
            : {
                shadowColor: tok.glowShadow, shadowOpacity: 0.16,
                shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
              }),
        }}
      >
        {isAssistant && (
          <View style={{
            flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
            alignItems: 'center', gap: 6, marginBottom: 5,
          }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: tok.gold }} />
            <Text style={{
              fontFamily: fontMono('regular'), fontSize: 9.5, letterSpacing: 1.6,
              color: tok.gold, textTransform: 'uppercase',
            }}>
              {lang === 'ar' ? 'ماعت' : 'Maat'}
            </Text>
          </View>
        )}
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          alignItems: 'center', gap: 8,
        }}>
          {message.uploading && <ActivityIndicator size="small" color={tok.void} />}
          <Text style={{
            flexShrink: 1,
            color: isAssistant ? tok.bone : tok.void,
            fontFamily: fontBody(lang), fontSize: lang === 'ar' ? 15 : 14, lineHeight: 22,
            textAlign: lang === 'ar' ? 'right' : 'left',
            writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
          }}>
            {shown}
            {stillTyping && <Text style={{ color: tok.gold }}>▍</Text>}
          </Text>
        </View>
        {/* "Logged N entries" breadcrumb that this turn wrote to the ledger. */}
        {isAssistant && !stillTyping && message.createdTransactionIds && message.createdTransactionIds.length > 0 && (
          <View style={{ marginTop: 8, alignSelf: lang === 'ar' ? 'flex-end' : 'flex-start' }}>
            <RChip
              label={lang === 'ar'
                ? `سجّلت ${message.createdTransactionIds.length} معاملة`
                : `Logged ${message.createdTransactionIds.length} ${message.createdTransactionIds.length === 1 ? 'entry' : 'entries'}`}
            />
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
      alignSelf: lang === 'ar' ? 'flex-end' : 'flex-start',
      backgroundColor: tok.coreBg,
      borderRadius: BUBBLE_RADIUS,
      ...(lang === 'ar' ? { borderBottomRightRadius: TAIL } : { borderBottomLeftRadius: TAIL }),
      paddingHorizontal: 16, paddingVertical: 16,
      borderWidth: 1, borderColor: tok.shellBorder, borderTopColor: tok.coreSheen,
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
  const { tok } = useI18n();
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
      <Mic size={18} color={recording ? tok.alertText : muted} strokeWidth={recording ? 2 : 1.5} />
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
