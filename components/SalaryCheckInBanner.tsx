import { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, X, Wallet } from 'lucide-react-native';
import { useI18n, currencyLabel } from '../lib/i18n';
import { apiFetch } from '../lib/api';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { radius } from '../lib/theme';
import { REyebrow, RButton, RCard, RField } from './ui';
import { useKeyboardHeight } from './useKeyboardHeight';

/**
 * Monthly salary check-in.
 *
 * Once per month, on the home screen, ask the user: "Did you get paid for
 * [Month]?". The check-in serves two purposes:
 *   - Captures variable amounts (raises, bonuses, late paychecks).
 *   - Ends the previous month's "expecting baseline income" state so the
 *     dashboard doesn't keep showing a phantom gap forever.
 *
 * The banner is rendered conditionally by the home tab (after a quick GET
 * /me/salary-checkin). Tapping it opens this sheet. The sheet has a single
 * amount field pre-filled with the user's template, plus a "Skip this month"
 * exit for gap months.
 */
export type CheckInStatus = {
  needed: boolean;
  period?: string;             // "2026-05"
  suggestedAmount?: number;
  currency?: string;
};

export async function fetchSalaryCheckIn(): Promise<CheckInStatus> {
  try {
    const r = await apiFetch<{ data: CheckInStatus }>('/me/salary-checkin');
    return r.data;
  } catch (err) {
    console.warn('salary check-in fetch failed', err);
    return { needed: false };
  }
}

function periodLabel(period: string | undefined, lang: 'en' | 'ar'): string {
  if (!period) return '';
  const [yStr, mStr] = period.split('-');
  const y = Number(yStr); const m = Number(mStr);
  if (!y || !m) return period;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

export function SalaryCheckInBanner({
  status, onPress,
}: { status: CheckInStatus; onPress: () => void }) {
  const { tok, lang } = useI18n();
  if (!status.needed) return null;
  const label = periodLabel(status.period, lang);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      <RCard accent padding={14} style={{ marginHorizontal: 16, marginTop: 6 }}>
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          alignItems: 'center', gap: 12,
        }}>
          <View style={{
            width: 36, height: 36, borderRadius: 10,
            backgroundColor: tok.elevated,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Wallet size={18} color={tok.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{
              color: tok.bone, fontFamily: fontBody(lang, 'semibold'), fontSize: 14,
              textAlign: lang === 'ar' ? 'right' : 'left',
            }}>
              {lang === 'ar' ? `هل استلمت راتب ${label}؟` : `Did you get paid for ${label}?`}
            </Text>
            <Text style={{
              marginTop: 3, color: tok.muted, fontFamily: fontBody(lang), fontSize: 12,
              textAlign: lang === 'ar' ? 'right' : 'left',
            }}>
              {lang === 'ar'
                ? 'سجّل الراتب وأنهِ الشهر، أو تخطى.'
                : 'Log it to close the month, or skip if you didn\'t.'}
            </Text>
          </View>
          <Text style={{ color: tok.gold, fontFamily: fontMono('regular'), fontSize: 14 }}>
            {lang === 'ar' ? '←' : '→'}
          </Text>
        </View>
      </RCard>
    </Pressable>
  );
}

export function SalaryCheckInSheet({
  visible, onClose, onDone, status,
}: {
  visible: boolean;
  onClose: () => void;
  onDone: () => void;
  status: CheckInStatus;
}) {
  const { tok, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const kbHeight = useKeyboardHeight();
  const [amount, setAmount] = useState(status.suggestedAmount ? String(status.suggestedAmount) : '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setAmount(status.suggestedAmount ? String(status.suggestedAmount) : '');
  }, [visible, status.suggestedAmount]);

  const numericAmount = parseFloat(amount) || 0;
  const canConfirm = numericAmount > 0 && !saving;
  const currency = status.currency ?? 'EGP';
  const label = periodLabel(status.period, lang);

  const submit = async (action: 'received' | 'skip') => {
    setSaving(true);
    try {
      await apiFetch('/me/salary-checkin', {
        method: 'POST',
        body: JSON.stringify(action === 'received' ? { action, amount: numericAmount } : { action }),
      });
      onDone();
      onClose();
    } catch (err) {
      console.warn('salary check-in submit failed', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)' }} onPress={onClose} />
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: tok.void,
        borderTopLeftRadius: radius.modal, borderTopRightRadius: radius.modal,
        paddingHorizontal: 18, paddingTop: 10,
        // Seat on the safe-area bottom inset; when the keyboard is open the
        // sheet is lifted above it via marginBottom so the input stays visible.
        paddingBottom: insets.bottom + 18,
        marginBottom: kbHeight,
        borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
        overflow: 'hidden',
        gap: 14,
      }}>
        <View style={{
          alignSelf: 'center',
          width: 36, height: 4, borderRadius: 999,
          backgroundColor: tok.border,
          marginBottom: 4,
        }} />
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          justifyContent: 'space-between', alignItems: 'center',
        }}>
          <View style={{ flex: 1 }}>
            <REyebrow style={{ color: tok.gold, marginBottom: 4 }}>
              {lang === 'ar' ? 'إغلاق الشهر' : 'Close the month'}
            </REyebrow>
            <Text style={{
              fontFamily: fontHead(lang), fontSize: 20, color: tok.bone, letterSpacing: -0.3,
              textAlign: lang === 'ar' ? 'right' : 'left',
            }}>
              {lang === 'ar' ? `راتب ${label}` : `${label} salary`}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color={tok.muted} />
          </Pressable>
        </View>

        <Text style={{
          fontFamily: fontBody(lang), fontSize: 13.5, lineHeight: 20, color: tok.muted,
          textAlign: lang === 'ar' ? 'right' : 'left',
        }}>
          {lang === 'ar'
            ? 'أدخل المبلغ الفعلي الذي استلمته. سيُسجَّل كدخل ضمن أساس راتبك الشهري.'
            : 'Enter the amount you actually received. It\'s logged as income and counted toward your monthly baseline.'}
        </Text>

        <RField
          mono
          value={amount}
          onChange={(v) => setAmount(v.replace(/[^\d.]/g, ''))}
          placeholder={status.suggestedAmount ? String(status.suggestedAmount) : '0'}
          keyboardType="numeric"
          autoFocus
          label={lang === 'ar' ? 'المبلغ' : 'Amount'}
          secondary={
            <Text style={{ color: tok.muted, fontFamily: fontMono('regular'), fontSize: 14 }}>
              {currencyLabel(currency, lang)}
            </Text>
          }
        />

        <RButton full onPress={() => submit('received')} disabled={!canConfirm} loading={saving}>
          <View style={{
            flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
            alignItems: 'center', gap: 6,
          }}>
            <Check size={16} color={tok.void} />
            <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 14, color: tok.void }}>
              {saving
                ? (lang === 'ar' ? 'جارٍ الحفظ…' : 'Saving…')
                : (lang === 'ar' ? 'استلمته - سجّل' : 'Received - log it')}
            </Text>
          </View>
        </RButton>

        <Pressable
          onPress={() => submit('skip')}
          disabled={saving}
          style={({ pressed }) => ({
            paddingVertical: 10,
            alignItems: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ fontFamily: fontBody(lang), fontSize: 13, color: tok.muted }}>
            {lang === 'ar' ? 'تخطى هذا الشهر' : 'Skip this month'}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}
