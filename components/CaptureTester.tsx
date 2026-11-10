import { useState } from 'react';
import { View, Text } from 'react-native';
import { useI18n } from '../lib/i18n';
import { apiFetch } from '../lib/api';
import { fontBody, fontMono } from '../lib/fonts';
import { RCard, REyebrow, RButton, RField } from './ui';

type Preview =
  | { wouldLog: false; reason: string }
  | { wouldLog: true; type: 'income' | 'expense'; amount: number; currency: string | null; merchant: string | null; cardDigits: string | null; bank: string | null; account: string; cashWithdrawal: boolean; salary: boolean };

/**
 * Paste a bank message and see what Seshat would do with it, without saving anything. The quickest way to find out
 * why a bank's messages do not turn into entries or accounts.
 */
export function CaptureTester() {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Preview | null>(null);
  const [err, setErr] = useState('');

  const check = async () => {
    setBusy(true); setErr(''); setRes(null);
    try { const r = await apiFetch<{ data: Preview }>('/capture/preview', { method: 'POST', body: JSON.stringify({ text }) }); setRes(r.data); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not check it'); }
    finally { setBusy(false); }
  };
  const line = (k: string, v: string | null) => v ? (
    <View key={k} style={{ flexDirection: ar ? 'row-reverse' : 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ fontFamily: fontBody(lang), fontSize: 13, color: tok.muted }}>{k}</Text>
      <Text style={{ flex: 1, textAlign: ar ? 'left' : 'right', fontFamily: fontMono('regular'), fontSize: 13, color: tok.bone }}>{v}</Text>
    </View>
  ) : null;

  return (
    <RCard padding={16} style={{ marginBottom: 14 }}>
      <REyebrow style={{ marginBottom: 6, textAlign: ar ? 'right' : 'left' }}>{ar ? 'جرّب رسالة' : 'Try a message'}</REyebrow>
      <Text style={{ fontFamily: fontBody(lang), fontSize: 13, lineHeight: 19, color: tok.muted, marginBottom: 10, textAlign: ar ? 'right' : 'left' }}>
        {ar ? 'الصق رسالة من بنكك لترى ماذا سيفعل بها سيشات، دون حفظ أي شيء.' : "Paste a message from your bank to see what Seshat would do with it. Nothing is saved."}
      </Text>
      <RField value={text} onChange={setText} multiline minHeight={90} placeholder={ar ? 'الصق الرسالة هنا' : 'Paste the message here'} />
      <View style={{ marginTop: 10 }}><RButton full onPress={check} disabled={!text.trim()} loading={busy}>{ar ? 'افحص' : 'Check it'}</RButton></View>
      {err ? <Text style={{ marginTop: 10, color: tok.alertText, fontFamily: fontBody(lang), fontSize: 13 }}>{err}</Text> : null}
      {res && (
        <View style={{ marginTop: 14, gap: 8 }}>
          {!res.wouldLog ? (
            <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 14, color: tok.alertText, textAlign: ar ? 'right' : 'left' }}>
              {ar ? 'لن يُسجَّل شيء: ' : 'Nothing would be logged: '}{res.reason}
            </Text>
          ) : (
            <>
              <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 14, color: tok.gold, textAlign: ar ? 'right' : 'left' }}>
                {res.cashWithdrawal ? (ar ? 'سيُسجَّل كسحب نقدي (يُنقل إلى الكاش، لا مصروف)' : 'Logged as a cash withdrawal (moved to Cash, not spending)') : res.type === 'income' ? (ar ? 'سيُسجَّل كدخل' : 'Logged as income') : (ar ? 'سيُسجَّل كمصروف' : 'Logged as an expense')}
              </Text>
              {line(ar ? 'المبلغ' : 'Amount', `${res.amount}${res.currency ? ' ' + res.currency : ''}`)}
              {line(ar ? 'الجهة' : 'Merchant', res.merchant)}
              {line(ar ? 'أرقام البطاقة' : 'Card digits', res.cardDigits)}
              {line(ar ? 'البنك' : 'Bank', res.bank)}
              {line(ar ? 'الحساب' : 'Account', res.account)}
            </>
          )}
        </View>
      )}
    </RCard>
  );
}
