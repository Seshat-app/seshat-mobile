import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { ChevronLeft, Sparkles, Check } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { apiFetch } from '../lib/api';

/**
 * "Add by Seshat" — focused chat-style view for batch entry.
 *
 * Opens INSIDE the AddTransactionSheet when the user dictates / types
 * multiple amounts (e.g. "food 200, Pepsi 50, coffee 50, car 1000").
 * Sends the input to the Seshat agent (POST /chat), which has tool-call
 * access + same-turn dedup-skip on the API side, so all entries land.
 *
 * Distinct from the main Seshat tab: it's modal-feeling, single-turn,
 * and dismisses back to the keypad / dashboard when done. The user
 * confirms ALL the entries in one tap (or the agent already auto-confirmed
 * them; we just surface what was logged).
 *
 * UI shape: a header eyebrow ("ADD BY SESHAT"), a single user bubble
 * showing the original input, a Seshat bubble showing the agent's
 * confirmation reply, and a row of small chips per created transaction.
 */

type Props = {
  visible: boolean;
  initialText: string;
  onClose: () => void;
  // Fires after the agent successfully logs at least one tx. The parent
  // sheet uses this to also bump its data version + show a toast.
  onLoggedSomething?: () => void;
};

type CreatedTx = { id: string; amount: number; currency: string; category?: string };

export function AddBySeshatPanel({ visible, initialText, onClose, onLoggedSomething }: Props) {
  const { tok, lang } = useI18n();
  const scrollRef = useRef<ScrollView>(null);

  // Local single-turn chat state. We don't share session state with the
  // main Seshat tab - the batch is its own short-lived conversation.
  const [reply, setReply] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedTx[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentRef = useRef(false);

  // Auto-send on first visibility. Reset on close so re-opening with a
  // different prefill starts fresh.
  useEffect(() => {
    if (!visible) {
      setReply(null);
      setCreated([]);
      setError(null);
      setLoading(false);
      sentRef.current = false;
      return;
    }
    if (sentRef.current || !initialText.trim()) return;
    sentRef.current = true;
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch<{
          data: {
            reply: string;
            createdTransactions?: Array<{ id: string; amount: number; currency: string; category?: string }>;
          };
        }>('/chat', {
          method: 'POST',
          body: JSON.stringify({ message: initialText.trim() }),
        });
        setReply(res.data.reply);
        const txs = res.data.createdTransactions ?? [];
        setCreated(txs);
        if (txs.length > 0) onLoggedSomething?.();
      } catch (err) {
        console.warn('[AddBySeshat] chat failed', err);
        setError(err instanceof Error ? err.message : 'Could not reach Seshat');
      } finally {
        setLoading(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
      }
    })();
  }, [visible, initialText, onLoggedSomething]);

  if (!visible) return null;

  return (
    <View
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: tok.void,
      }}
    >
      {/* Header — back chevron + "ADD BY SESHAT" eyebrow */}
      <View style={{
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 18, paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tok.border,
      }}>
        <Pressable onPress={onClose} hitSlop={6} style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row', alignItems: 'center', gap: 6,
        }}>
          <ChevronLeft size={16} color={tok.muted} />
          <Text style={{
            color: tok.muted, fontFamily: fontMono('regular'), fontSize: 10,
            letterSpacing: 1.4, textTransform: 'uppercase',
          }}>{lang === 'ar' ? 'لوحة' : 'keypad'}</Text>
        </Pressable>

        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
        }}>
          <Sparkles size={12} color={tok.gold} />
          <Text style={{
            color: tok.gold, fontFamily: fontMono('regular'),
            fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase',
          }}>
            {lang === 'ar' ? 'إضافة بسيشات' : 'Add by Seshat'}
          </Text>
        </View>

        <View style={{ width: 20 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 96 }}
        showsVerticalScrollIndicator={false}
      >
        {/* User bubble — what they said */}
        <View style={{
          alignSelf: lang === 'ar' ? 'flex-start' : 'flex-end',
          maxWidth: '88%',
          backgroundColor: tok.surface,
          borderRadius: 18,
          borderTopRightRadius: lang === 'ar' ? 18 : 6,
          borderTopLeftRadius: lang === 'ar' ? 6 : 18,
          paddingVertical: 12, paddingHorizontal: 16,
          borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
        }}>
          <Text style={{
            color: tok.bone, fontFamily: fontBody(lang), fontSize: 14, lineHeight: 20,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>{initialText}</Text>
        </View>

        {/* Loading state */}
        {loading && (
          <View style={{
            alignSelf: lang === 'ar' ? 'flex-end' : 'flex-start',
            flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: tok.surface,
            borderRadius: 18,
            borderTopLeftRadius: lang === 'ar' ? 18 : 6,
            borderTopRightRadius: lang === 'ar' ? 6 : 18,
            paddingVertical: 12, paddingHorizontal: 16,
            borderLeftWidth: 2, borderLeftColor: tok.gold,
          }}>
            <ActivityIndicator size="small" color={tok.gold} />
            <Text style={{ color: tok.muted, fontFamily: fontMono('regular'), fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' }}>
              {lang === 'ar' ? 'تفكر' : 'thinking'}
            </Text>
          </View>
        )}

        {/* Seshat reply bubble */}
        {reply && (
          <View style={{
            alignSelf: lang === 'ar' ? 'flex-end' : 'flex-start',
            maxWidth: '90%',
            backgroundColor: tok.surface,
            borderRadius: 18,
            borderTopLeftRadius: lang === 'ar' ? 18 : 6,
            borderTopRightRadius: lang === 'ar' ? 6 : 18,
            paddingVertical: 12, paddingHorizontal: 16,
            borderLeftWidth: 2, borderLeftColor: tok.gold,
          }}>
            <Text style={{
              color: tok.bone, fontFamily: fontBody(lang), fontSize: 14, lineHeight: 20,
              textAlign: lang === 'ar' ? 'right' : 'left',
            }}>{reply}</Text>
          </View>
        )}

        {/* Created transaction chips */}
        {created.length > 0 && (
          <View style={{ marginTop: 4, gap: 8 }}>
            <Text style={{
              color: tok.muted, fontFamily: fontMono('regular'),
              fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase',
              textAlign: lang === 'ar' ? 'right' : 'left',
            }}>
              {lang === 'ar' ? `سُجلت ${created.length}` : `Logged ${created.length}`}
            </Text>
            {created.map((tx) => (
              <View key={tx.id} style={{
                flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                alignItems: 'center', gap: 10,
                backgroundColor: tok.surface,
                borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14,
                borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
              }}>
                <Check size={14} color={tok.gold} strokeWidth={2.2} />
                <Text style={{
                  flex: 1, color: tok.bone, fontFamily: fontBody(lang, 'medium'), fontSize: 13,
                  textAlign: lang === 'ar' ? 'right' : 'left',
                }}>
                  {tx.amount.toLocaleString()} {tx.currency}
                  {tx.category ? ` · ${tx.category}` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Error state */}
        {error && (
          <View style={{
            alignSelf: 'stretch',
            backgroundColor: tok.alertBg, borderRadius: 12,
            paddingVertical: 12, paddingHorizontal: 16,
            borderWidth: StyleSheet.hairlineWidth, borderColor: tok.alertText,
          }}>
            <Text style={{
              color: tok.alertText, fontFamily: fontBody(lang), fontSize: 13,
              textAlign: lang === 'ar' ? 'right' : 'left',
            }}>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* Done button — fixed bottom */}
      <View style={{
        position: 'absolute', bottom: 26, left: 18, right: 18,
      }}>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => ({
            backgroundColor: created.length > 0 ? tok.gold : tok.surface,
            borderRadius: 14, paddingVertical: 14, alignItems: 'center',
            borderWidth: 1, borderColor: created.length > 0 ? tok.gold : tok.border,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{
            color: created.length > 0 ? '#0D0D0D' : tok.bone,
            fontFamily: fontHead(lang),
            fontSize: 14, letterSpacing: 0.4,
          }}>
            {created.length > 0
              ? (lang === 'ar' ? `حفظ ${created.length}` : `Done · ${created.length} logged`)
              : (lang === 'ar' ? 'إغلاق' : 'Close')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
