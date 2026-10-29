import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { View, Text, Pressable, Animated, ActivityIndicator, Image } from 'react-native';
import { Mic, Copy, Check, RefreshCw, Pencil, Trash2 } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useI18n } from '../lib/i18n';
import { fontBody, fontMono } from '../lib/fonts';
import { RChip } from './ui';
import { Markdown } from './Markdown';
import { ChatBlocks, type VisualBlock } from './ChatVisuals';
import { ActivityTrace } from './ActivityTrace';
import { hapticSelection } from './press';
import type { ActivityStep } from '../lib/chatStream';

/**
 * Shared chat primitives used by the Seshat tab session list (TypingDots is
 * reused for the loading state) and the per-session chat view.
 *
 * Bubble language: the assistant (Seshat) speaks in a calm glass bubble with a
 * small gold dot + "Seshat" label and a bottom tail on its anchored side; the
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
  // A receipt/attachment image sent with this turn. Rendered as a tappable
  // thumbnail inside the bubble that opens the full-screen image viewer.
  imageUrl?: string;
  // Transaction _ids the agent created in response to this turn. Renders a
  // small "Logged N entries" chip under the bubble when populated.
  createdTransactionIds?: string[];
  // Structured visuals from the backend (logged-transaction cards + a monthly
  // insight chart). Rendered beneath the bubble once typing finishes.
  blocks?: VisualBlock[];
  // Live-activity trace (the assistant's thinking/doing steps). Streamed in
  // frame-by-frame during a turn and finalized on `done`. Rendered above the
  // reply text via <ActivityTrace/>.
  activity?: ActivityStep[];
  // True while the assistant reply is still streaming (empty/partial content, a
  // growing activity trace). Cleared on the terminal done/error frame or abort.
  pending?: boolean;
};

const BUBBLE_RADIUS = 18;
const TAIL = 5;

function ChatBubbleInner({
  message, onSkipTyping, onPressImage, onRegenerate, onDelete, onEdit, busy,
}: {
  message: Message;
  onSkipTyping: (id: string) => void;
  onPressImage?: (uri: string) => void;
  onRegenerate?: () => void;
  onDelete?: (m: Message) => void;
  onEdit?: (m: Message) => void;
  busy?: boolean;
}) {
  const { tok, lang } = useI18n();
  const [visibleLen, setVisibleLen] = useState(message.typing ? 0 : message.content.length);
  const [copied, setCopied] = useState(false);

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
  // Assistant replies render markdown once fully typed; while typing (or user
  // messages) we show plain sliced text so partial markdown never flickers.
  const showMarkdown = isAssistant && !stillTyping && !message.pending && !!message.content;

  // Copy the message body, flashing a check for ~1.4s.
  const doCopy = () => {
    if (!message.content) return;
    Clipboard.setStringAsync(message.content).then(
      () => {
        hapticSelection();
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      },
      () => {},
    );
  };

  // The small per-message action row appears once a bubble has settled (not
  // pending/typing/uploading) and carries text.
  const showActions = !message.pending && !message.uploading && !stillTyping && !!message.content;

  // Anchor + tail flip for RTL: assistant on the leading edge, user on the
  // trailing edge, with the tail corner on the bubble's anchored side.
  const anchor: 'flex-start' | 'flex-end' = isAssistant
    ? (lang === 'ar' ? 'flex-end' : 'flex-start')
    : (lang === 'ar' ? 'flex-start' : 'flex-end');
  const tailCorner = anchor === 'flex-start'
    ? { borderBottomLeftRadius: TAIL }
    : { borderBottomRightRadius: TAIL };

  // Visual blocks render beneath the text once typing finishes. When present
  // the column widens so the cards + insight chart have room to breathe; the
  // text bubble itself stays content-width, anchored on its side.
  const hasBlocks = isAssistant && !!message.blocks && message.blocks.length > 0;
  const hasTxBlock = !!message.blocks?.some((b) => b.type === 'transactions');
  const showBlocks = hasBlocks && !stillTyping;

  return (
    // While a turn streams, the bubble holds a fixed width (and the inner
    // bubble stretches to fill it) so the trace can't squeeze into a narrow box
    // that breaks labels mid-word — and so the shape doesn't jump when the
    // reply lands.
    <View style={{ alignSelf: anchor, marginBottom: 10, ...(hasBlocks ? { width: '92%' } : message.pending ? { width: '84%' } : { maxWidth: '84%' }) }}>
    <Pressable onPress={stillTyping ? () => onSkipTyping(message.id) : undefined} style={{ alignSelf: message.pending ? 'stretch' : anchor, maxWidth: '100%' }}>
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
              {lang === 'ar' ? 'سيشات' : 'Seshat'}
            </Text>
          </View>
        )}
        {isAssistant && (message.pending || (message.activity && message.activity.length > 0)) && (
          <ActivityTrace steps={message.activity} active={message.pending} />
        )}
        {message.imageUrl && (
          <Pressable
            onPress={() => onPressImage?.(message.imageUrl!)}
            style={({ pressed }) => ({ marginBottom: 8, opacity: pressed ? 0.85 : 1, alignSelf: anchor })}
            accessibilityRole="imagebutton"
            accessibilityLabel={lang === 'ar' ? 'عرض الإيصال' : 'View receipt'}
          >
            <Image
              source={{ uri: message.imageUrl }}
              style={{
                width: 180, height: 200, borderRadius: 12,
                backgroundColor: 'rgba(0,0,0,0.12)',
                borderWidth: 1, borderColor: isAssistant ? tok.shellBorder : 'rgba(0,0,0,0.16)',
              }}
              resizeMode="cover"
            />
          </Pressable>
        )}
        {showMarkdown ? (
          <Markdown content={message.content} />
        ) : (
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
              {(stillTyping || (message.pending && !shown)) && <Text style={{ color: tok.gold }}>▍</Text>}
            </Text>
          </View>
        )}
        {/* "Logged N entries" breadcrumb - only when there's no richer
            transactions block (which already lists the entries as cards). */}
        {isAssistant && !stillTyping && !hasTxBlock && message.createdTransactionIds && message.createdTransactionIds.length > 0 && (
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
      {showActions && (
        <View style={{
          // Anchor the row on the bubble's side; order icons leading→trailing
          // (reversed for the user so Copy sits nearest the trailing edge, like web).
          flexDirection: isAssistant
            ? (lang === 'ar' ? 'row-reverse' : 'row')
            : (lang === 'ar' ? 'row' : 'row-reverse'),
          alignSelf: anchor, alignItems: 'center', gap: 1, marginTop: 3,
        }}>
          <ActionButton
            onPress={doCopy}
            label={lang === 'ar' ? 'نسخ' : 'Copy'}
          >
            {copied
              ? <Check size={14} color={tok.posText} strokeWidth={2} />
              : <Copy size={14} color={tok.muted} strokeWidth={1.8} />}
          </ActionButton>
          {isAssistant && onRegenerate && (
            <ActionButton
              onPress={onRegenerate}
              disabled={busy}
              label={lang === 'ar' ? 'إعادة توليد' : 'Regenerate'}
            >
              <RefreshCw size={14} color={tok.muted} strokeWidth={1.8} />
            </ActionButton>
          )}
          {!isAssistant && onEdit && (
            <ActionButton
              onPress={() => onEdit(message)}
              disabled={busy}
              label={lang === 'ar' ? 'تعديل' : 'Edit'}
            >
              <Pencil size={14} color={tok.muted} strokeWidth={1.8} />
            </ActionButton>
          )}
          {onDelete && (
            <ActionButton
              onPress={() => onDelete(message)}
              disabled={busy}
              label={lang === 'ar' ? 'حذف' : 'Delete'}
            >
              <Trash2 size={14} color={tok.muted} strokeWidth={1.8} />
            </ActionButton>
          )}
        </View>
      )}
      {showBlocks && (
        <View style={{ marginTop: 8 }}>
          <ChatBlocks blocks={message.blocks} />
        </View>
      )}
    </View>
  );
}

function ActionButton({
  onPress, disabled, label, children,
}: { onPress?: () => void; disabled?: boolean; label: string; children: ReactNode }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={disabled ? undefined : hapticSelection}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        paddingHorizontal: 7, paddingVertical: 5, borderRadius: 8,
        opacity: disabled ? 0.3 : pressed ? 0.5 : 0.7,
      })}
    >
      {children}
    </Pressable>
  );
}

export const ChatBubble = memo(ChatBubbleInner);

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
