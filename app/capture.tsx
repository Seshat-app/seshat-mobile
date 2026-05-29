import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PlanScreen } from '../components/PlanShell';
import { RCard } from '../components/ui';
import { AddTransactionSheet, type AddTxPayload, type AddTxPrefill } from '../components/AddTransactionSheet';
import { useI18n } from '../lib/i18n';
import { apiFetch, newIdempotencyKey, hasToken } from '../lib/api';
import { useAppData } from '../lib/appData';
import { fontBody } from '../lib/fonts';

/**
 * /capture - the landing screen for both iOS (Shortcut deep link) and
 * Android (NotificationListenerService intent) notification captures.
 *
 * Flow:
 *  1. Read `text` (and optional `source`) from query params.
 *  2. POST to /capture/notification - LLM parses, returns structured fields.
 *  3. Open AddTransactionSheet pre-filled. User confirms or edits, saves.
 *  4. After save (or close), navigate back to the home tab.
 *
 * If `text` is empty or the parser rejects, we show a friendly empty state
 * with a "Log manually" button that opens the sheet blank.
 */
type ParseResult = {
  ok: boolean;
  reason?: string;
  type?: 'income' | 'expense';
  amount?: number;
  currency?: string;
  counterparty?: string;
  categoryHint?: string;
  suggestedCategoryId?: string;
  isMonthlyBaselineHint?: boolean;
  raw?: string;
  source?: string;
};

export default function CaptureScreen() {
  const router = useRouter();
  const { tok, lang } = useI18n();
  const { categories, profile, bumpVersion } = useAppData();
  const params = useLocalSearchParams<{ text?: string; source?: string }>();
  const text = typeof params.text === 'string' ? params.text : '';
  const source = typeof params.source === 'string' ? params.source : 'sms';

  const [loading, setLoading] = useState(true);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    (async () => {
      // Auth gate: if no token, kick to the auth flow. The deep link
      // survives a relaunch so once they sign in they can land here again.
      if (!(await hasToken())) {
        router.replace('/');
        return;
      }
      if (!text.trim()) {
        setLoading(false);
        return;
      }
      try {
        const res = await apiFetch<{ data: ParseResult }>('/capture/notification', {
          method: 'POST',
          body: JSON.stringify({ text, source }),
        });
        setParsed(res.data);
        if (res.data?.ok) setSheetOpen(true);
      } catch (err) {
        console.warn('capture parse failed', err);
        setParsed({ ok: false, reason: 'Parser unreachable' });
      } finally {
        setLoading(false);
      }
    })();
  }, [text, source]);

  const onSave = async (p: AddTxPayload) => {
    try {
      await apiFetch('/transactions', {
        method: 'POST',
        body: JSON.stringify(p),
        idempotencyKey: newIdempotencyKey(),
      });
      bumpVersion();
      router.replace('/(tabs)/transactions');
    } catch (err) {
      console.warn('capture save failed', err);
    }
  };

  const sourceLabel = (() => {
    const s = (parsed?.source ?? source).toLowerCase();
    if (s === 'sms') return lang === 'ar' ? 'من رسالة بنكية' : 'from a bank SMS';
    if (s === 'push') return lang === 'ar' ? 'من إشعار بنكي' : 'from a bank notification';
    return lang === 'ar' ? 'من إشعار' : 'from a notification';
  })();

  const prefill: AddTxPrefill | undefined = parsed?.ok ? {
    type: parsed.type,
    amount: parsed.amount,
    categoryId: parsed.suggestedCategoryId,
    description: parsed.counterparty,
    isMonthlyBaseline: parsed.isMonthlyBaselineHint,
    source: 'notification',
    detectionBanner: lang === 'ar'
      ? `رصدت سيشات ${parsed.amount} ${parsed.currency ?? ''} ${sourceLabel}. تأكد وحفظ.`
      : `Seshat detected ${parsed.amount} ${parsed.currency ?? ''} ${sourceLabel}. Confirm and save.`,
  } : undefined;

  return (
    <PlanScreen
      title={lang === 'ar' ? 'رصد المعاملة' : 'Capture'}
      subtitle={lang === 'ar' ? 'تأكيد الإشعار البنكي' : 'Confirm a bank notification'}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        {loading ? (
          <RCard padding={32}><ActivityIndicator color={tok.gold} /></RCard>
        ) : !text.trim() ? (
          <RCard padding={20}>
            <Text style={{
              fontFamily: fontBody(lang), fontSize: 14, color: tok.muted, textAlign: 'center',
            }}>
              {lang === 'ar'
                ? 'لم يصل أي نص. عد للرئيسية وسجّل المعاملة يدوياً.'
                : 'No text was passed in. Head back to home and log the entry manually.'}
            </Text>
          </RCard>
        ) : parsed?.ok ? null : (
          <RCard padding={20}>
            <Text style={{
              fontFamily: fontBody(lang), fontSize: 14, color: tok.muted, textAlign: 'center',
            }}>
              {lang === 'ar'
                ? `لم تتعرف سيشات على هذه الرسالة كمعاملة (${parsed?.reason ?? '—'}).`
                : `Seshat couldn't recognize this as a transaction (${parsed?.reason ?? '—'}).`}
            </Text>
          </RCard>
        )}
      </View>

      <AddTransactionSheet
        visible={sheetOpen}
        onClose={() => { setSheetOpen(false); router.replace('/(tabs)/'); }}
        onSave={onSave}
        categories={categories}
        defaultCurrency={profile?.currency ?? 'EGP'}
        prefill={prefill}
      />
    </PlanScreen>
  );
}
