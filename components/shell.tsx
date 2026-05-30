import { ReactNode, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { BarChart3, Crosshair, LayoutGrid, Mic, Plus } from 'lucide-react-native';
import { useI18n, formatAmount, currencyLabel, monthYear, greeting } from '../lib/i18n';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { RadarMark } from './RadarMark';
import { REyebrow, RAmount } from './ui';
import { WorkspaceChip } from './WorkspaceSwitcher';
import { CategoryIcon, CategoryIconByKey } from './icons';
import { iconKeyForCategory } from '../lib/categoryMap';
import type { CatId } from '../lib/categoryMap';
import { catIdFromName, catLabel } from '../lib/categoryMap';

// ─────────────────────────────────────────────────────────────
// View switcher — three small icons (Numbers / HUD / Bento)
// ─────────────────────────────────────────────────────────────
export type DashView = 'numbers' | 'hud' | 'bento';

export function RViewSwitcher({ value, onChange }: { value: DashView; onChange: (v: DashView) => void }) {
  const { tok } = useI18n();
  const views: Array<{ id: DashView; Icon: any }> = [
    { id: 'numbers', Icon: BarChart3 },
    { id: 'hud', Icon: Crosshair },
    { id: 'bento', Icon: LayoutGrid },
  ];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {views.map((v) => {
        const a = v.id === value;
        return (
          <Pressable key={v.id} onPress={() => onChange(v.id)} hitSlop={6} style={{ padding: 2 }}>
            <v.Icon size={16} color={a ? tok.gold : tok.muted} strokeWidth={a ? 1.8 : 1.5} />
          </Pressable>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Home header — greeting + view switcher + animated Radar mark
// ─────────────────────────────────────────────────────────────
export function RHomeHeader({
  userName, view, onViewChange, refreshing,
}: { userName: string; view: DashView; onViewChange: (v: DashView) => void; refreshing?: boolean }) {
  const { tok, lang, t } = useI18n();
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>
      {/* Workspace chip sits as a one-line band above the greeting so the
          user always knows which ledger feeds the numbers below, and can
          switch in one tap. */}
      <View style={{
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', marginBottom: 10,
      }}>
        <WorkspaceChip />
      </View>
      <View style={{
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <View style={{ flexShrink: 1, flex: 1 }}>
          <Text style={{
            fontFamily: fontHead(lang),
            fontSize: lang === 'ar' ? 21 : 20, color: tok.bone, letterSpacing: -0.4,
            writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
          }}>
            {greeting(lang, userName)}
          </Text>
          <REyebrow style={{ marginTop: 6, writingDirection: lang === 'ar' ? 'rtl' : 'ltr' }}>
            {monthYear(lang)} · {t('detected')}
          </REyebrow>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <RViewSwitcher value={view} onChange={onViewChange} />
          <View style={{ width: 1, height: 18, backgroundColor: tok.border }} />
          <RadarMark
            size={28}
            gold={tok.gold}
            lightRing
            // One-shot scan on mount; switches to a continuous spin while data
            // is refreshing so the mark itself is the loading indicator.
            animate={!refreshing}
            spinning={refreshing}
          />
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// RefreshSpinner — small spinning RadarMark used as a refresh
// indicator on screens that don't already have a header mark.
// Drop it next to the screen title; pass `refreshing` from state.
// ─────────────────────────────────────────────────────────────
export function RefreshSpinner({ refreshing, size = 22 }: { refreshing: boolean; size?: number }) {
  const { tok } = useI18n();
  if (!refreshing) return null;
  return <RadarMark size={size} gold={tok.gold} lightRing spinning />;
}

// ─────────────────────────────────────────────────────────────
// Category chip — icon in a rounded surface tile
// ─────────────────────────────────────────────────────────────
export function RCatChip({
  cat, iconKey, size = 38, dim = false,
}: { cat?: CatId; iconKey?: string; size?: number; dim?: boolean }) {
  const { tok } = useI18n();
  return (
    <View style={{
      width: size, height: size, borderRadius: 10,
      backgroundColor: tok.elevated,
      borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
      alignItems: 'center', justifyContent: 'center',
      opacity: dim ? 0.6 : 1,
    }}>
      {iconKey
        ? <CategoryIconByKey iconKey={iconKey} size={size * 0.5} color={tok.bone} />
        : <CategoryIcon cat={cat ?? 'other'} size={size * 0.5} color={tok.bone} />}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Transaction row — used in dashboards and the records list
// ─────────────────────────────────────────────────────────────
export type TxRowData = {
  _id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  description?: string;
  date: string;
  categoryId?: { nameEn?: string; nameAr?: string; emoji?: string; icon?: string };
  // Origin of the transaction. Renders as a tiny chip on the row when
  // anything other than 'manual'. Lets the user spot AI-created, voice,
  // receipt, or bot-created entries at a glance.
  source?: 'manual' | 'voice' | 'seshat' | 'bot' | 'notification' | 'receipt-ocr';
};

function sourceChipLabel(source: TxRowData['source'], lang: 'en' | 'ar'): string | null {
  if (!source || source === 'manual') return null;
  if (lang === 'ar') {
    return ({
      voice: 'صوت',
      seshat: 'سيشات',
      bot: 'تيليجرام',
      notification: 'إشعار',
      'receipt-ocr': 'إيصال',
    } as const)[source] ?? null;
  }
  return ({
    voice: 'voice',
    seshat: 'seshat',
    bot: 'telegram',
    notification: 'notification',
    'receipt-ocr': 'receipt',
  } as const)[source] ?? null;
}

export function RTxRow({
  tx, last, onPress, onLongPress,
}: {
  tx: TxRowData;
  last?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const { tok, lang } = useI18n();
  const iconKey = iconKeyForCategory(tx.categoryId);
  const desc = tx.description || catLabel(tx.categoryId, lang);
  const signed = tx.type === 'income' ? tx.amount : -tx.amount;
  const dateLabel = new Date(tx.date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  const content = (
    <View style={{
      flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
      alignItems: 'center', gap: 12, paddingVertical: 12,
      borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
      borderBottomColor: tok.border,
    }}>
      <RCatChip iconKey={iconKey} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          alignItems: 'center', gap: 6,
        }}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontFamily: fontBody(lang, 'medium'), fontSize: lang === 'ar' ? 15 : 14,
              color: tok.bone, writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
              textAlign: lang === 'ar' ? 'right' : 'left',
            }}
          >{desc}</Text>
          {(() => {
            const label = sourceChipLabel(tx.source, lang);
            if (!label) return null;
            return (
              <View style={{
                paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
                backgroundColor: tok.elevated,
                borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
              }}>
                <Text style={{
                  fontFamily: fontMono('regular'), fontSize: 9,
                  color: tok.gold, letterSpacing: 0.8,
                  textTransform: 'lowercase',
                }}>
                  {label}
                </Text>
              </View>
            );
          })()}
        </View>
        <REyebrow style={{ marginTop: 3, textAlign: lang === 'ar' ? 'right' : 'left' }}>
          {catLabel(tx.categoryId, lang)} · {dateLabel}
        </REyebrow>
      </View>
      <RAmount value={signed} currency={tx.currency} size={15} sign={signed > 0} decimals={signed % 1 === 0 ? 0 : 2} />
    </View>
  );

  if (!onPress && !onLongPress) return content;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {content}
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// Floating Add button — gold disc, bottom-corner, always reachable
// ─────────────────────────────────────────────────────────────
/**
 * RFAB - the bottom-right floating add button.
 *
 * Tap (onPress)          -> opens the add-options chooser (manual / receipt)
 * Long-press hold        -> opens Seshat chat AND starts the mic; recording
 *                            runs while finger is down. Releasing the finger
 *                            fires onVoiceRelease with the recorded audio.
 *
 * The long-press path skips the keypad entirely and lets the user just speak
 * to Seshat. Matches the "the game is over" capture promise: the fastest
 * possible path from impulse to logged transaction.
 */
export function RFAB({
  onPress,
  onVoiceStart,
  onVoiceRelease,
  onVoiceCancel,
  bottomOffset = 92,
}: {
  onPress: () => void;
  // Called when the long-press is detected (~280 ms hold). The caller should
  // navigate to the Seshat tab and begin a recording. If absent, long-press
  // falls back to the normal tap.
  onVoiceStart?: () => void;
  // Called when the finger lifts after a long-press recording. The recorder
  // should stop, the audio should be sent to Seshat, and the FAB returns to
  // its idle state.
  onVoiceRelease?: () => void;
  // Called if the press is cancelled (e.g. finger slides off the button)
  // so the caller can abort the recording without sending.
  onVoiceCancel?: () => void;
  bottomOffset?: number;
}) {
  const { tok, lang } = useI18n();
  const side = lang === 'ar' ? { left: 20 } : { right: 20 };

  // recording = true between onLongPress and onPressOut. While recording the
  // FAB doubles in shadow and shows a small pulse ring so the user has a
  // clear visual confirmation the mic is hot.
  const recordingRef = useRef(false);
  const [recording, setRecording] = useState(false);

  const handleLongPress = () => {
    if (!onVoiceStart) return;
    recordingRef.current = true;
    setRecording(true);
    onVoiceStart();
  };

  const handlePressOut = () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setRecording(false);
    onVoiceRelease?.();
  };

  // If the user's finger leaves the button while recording, treat it as a
  // cancel. Avoids accidental sends when the user lifts off-screen.
  const handlePressCancel = () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setRecording(false);
    onVoiceCancel?.();
  };

  return (
    <Pressable
      onPress={() => {
        // Don't fire onPress if the long-press already kicked in.
        if (recordingRef.current) return;
        onPress();
      }}
      onLongPress={handleLongPress}
      onPressOut={handlePressOut}
      onResponderTerminate={handlePressCancel}
      delayLongPress={280}
      style={({ pressed }) => ({
        position: 'absolute', bottom: bottomOffset, ...side,
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: recording ? tok.alertText : tok.gold,
        alignItems: 'center', justifyContent: 'center',
        transform: [{ scale: pressed || recording ? 0.95 : 1 }],
        shadowColor: recording ? tok.alertText : tok.gold,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: recording ? 0.5 : 0.32,
        shadowRadius: recording ? 22 : 16,
        elevation: 8,
        zIndex: 30,
      })}
      accessibilityLabel={recording ? 'Recording — release to send' : 'Add transaction'}
      accessibilityHint={onVoiceStart ? 'Tap to choose, long-press to speak to Seshat' : undefined}
    >
      {recording
        ? <Mic size={26} color="#0D0D0D" strokeWidth={2.2} />
        : <Plus size={26} color="#0D0D0D" strokeWidth={2.2} />}
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// Section header — eyebrow + optional right action ("See all")
// ─────────────────────────────────────────────────────────────
export function SectionHeader({
  label, action, onActionPress,
}: { label: string; action?: string; onActionPress?: () => void }) {
  const { tok, lang } = useI18n();
  return (
    <View style={{
      flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
      justifyContent: 'space-between', alignItems: 'baseline',
      paddingHorizontal: 4,
    }}>
      <REyebrow>{label}</REyebrow>
      {action && (
        <Pressable onPress={onActionPress} hitSlop={6}>
          <Text style={{
            color: tok.gold, fontFamily: fontMono('regular'), fontSize: 10,
            letterSpacing: 1.4, textTransform: 'uppercase',
          }}>{action} →</Text>
        </Pressable>
      )}
    </View>
  );
}
