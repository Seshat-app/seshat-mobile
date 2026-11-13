import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { BellRing, Trash2 } from 'lucide-react-native';
import { apiFetch } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { fontBody, fontMono } from '../lib/fonts';
import { trackEvent } from '../lib/track';
import { RCard, REyebrow, RButton, RField, RPill } from './ui';

const n2 = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 2 });
const num = (s: string) => parseFloat(s.replace(/,/g, '')) || 0;

type Alert = { id: string; label: string; direction: 'above' | 'below'; target: number; currency: string; price: number | null; firedAt: string | null; firedPrice: number | null };

/** "Tell me when gold reaches X": a few targets, each with today's price beside it. They fire once, then stay as history. */
export function PriceTargets() {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const [assets, setAssets] = useState<Array<{ key: string; label: string }>>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [adding, setAdding] = useState(false);
  const [asset, setAsset] = useState('gold:21');
  const [dir, setDir] = useState<'above' | 'below'>('above');
  const [target, setTarget] = useState('');
  const [err, setErr] = useState('');
  const load = useCallback(() => {
    apiFetch<{ data: { assets: Array<{ key: string; label: string }>; alerts: Alert[] } }>('/savings/alerts').then((r) => { setAssets(r.data.assets); setAlerts(r.data.alerts); }).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  const name = (label: string) => (ar ? ({ 'Gold 24k (per gram)': 'ذهب ٢٤ (للجرام)', 'Gold 21k (per gram)': 'ذهب ٢١ (للجرام)', 'Gold 18k (per gram)': 'ذهب ١٨ (للجرام)', 'US dollar': 'الدولار', Euro: 'اليورو', 'Saudi riyal': 'الريال السعودي', 'UAE dirham': 'الدرهم الإماراتي', 'Pound sterling': 'الجنيه الإسترليني', Bitcoin: 'بتكوين', Ethereum: 'إيثريوم' } as Record<string, string>)[label] ?? label : label);

  const add = async () => {
    setErr('');
    try { await apiFetch('/savings/alerts', { method: 'POST', body: JSON.stringify({ asset, direction: dir, target: num(target) }) }); setTarget(''); setAdding(false); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not save'); }
  };
  return (
    <RCard padding={16}>
      <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <REyebrow>{ar ? 'أسعار مستهدفة' : 'Price targets'}</REyebrow>
        <Pressable onPress={() => setAdding((v) => !v)} hitSlop={8} style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
          <BellRing size={14} color={tok.gold} />
          <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 13, color: tok.gold }}>{ar ? 'نبّهني عندما…' : 'Tell me when…'}</Text>
        </Pressable>
      </View>
      {adding && (
        <View style={{ gap: 12, marginBottom: 12 }}>
          <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>{assets.map((a) => <RPill key={a.key} active={asset === a.key} onPress={() => setAsset(a.key)}>{name(a.label)}</RPill>)}</View>
          <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 8 }}>
            <RPill active={dir === 'above'} onPress={() => setDir('above')}>{ar ? 'يرتفع إلى' : 'goes up to'}</RPill>
            <RPill active={dir === 'below'} onPress={() => setDir('below')}>{ar ? 'ينخفض إلى' : 'goes down to'}</RPill>
          </View>
          <RField label={ar ? 'السعر' : 'Price'} value={target} onChange={(v) => setTarget(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" mono />
          {err ? <Text style={{ fontFamily: fontBody(lang), fontSize: 12, color: tok.alertText }}>{err}</Text> : null}
          <RButton full onPress={add} disabled={!(num(target) > 0)}>{ar ? 'احفظ' : 'Save'}</RButton>
        </View>
      )}
      {alerts.length === 0 && !adding ? (
        <Text style={{ fontFamily: fontBody(lang), fontSize: 13, lineHeight: 19, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>{ar ? 'لا أسعار مستهدفة بعد. اختر الذهب أو عملة وسعراً، وسيخبرك سيشات عند بلوغه.' : 'No targets yet. Pick gold or a currency and a price, and Seshat tells you when it is reached.'}</Text>
      ) : null}
      {alerts.map((a) => (
        <View key={a.id} style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fontBody(lang, 'medium'), fontSize: 14, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{name(a.label)} · {a.direction === 'above' ? (ar ? 'ارتفاع إلى' : 'up to') : (ar ? 'انخفاض إلى' : 'down to')} {n2(a.target)} {a.currency}</Text>
            <Text style={{ fontFamily: fontMono('regular'), fontSize: 11.5, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>
              {a.firedAt ? (ar ? `بلغ ${n2(a.firedPrice ?? 0)}` : `Reached at ${n2(a.firedPrice ?? 0)}`) : a.price !== null ? (ar ? `الآن ${n2(a.price)}` : `Now ${n2(a.price)}`) : ''}
            </Text>
          </View>
          <Pressable hitSlop={10} onPress={async () => { await apiFetch(`/savings/alerts/${a.id}`, { method: 'DELETE' }).catch(() => {}); load(); }}><Trash2 size={16} color={tok.muted} /></Pressable>
        </View>
      ))}
    </RCard>
  );
}

type Zakat = { currency: string; nisab: number; wealth: number; reached: boolean; due: number; personalOnly?: boolean };

/** An estimate of zakat from what Seshat knows. It says what it counted and what it cannot know; the person decides. */
export function ZakatCard() {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const [z, setZ] = useState<Zakat | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { trackEvent('screen_zakat'); apiFetch<{ data: Zakat }>('/me/zakat').then((r) => setZ(r.data)).catch(() => {}); }, []);
  if (!z || z.personalOnly) return null;
  const n = (v: number) => Math.round(v).toLocaleString('en-US');
  return (
    <RCard padding={16}>
      <REyebrow style={{ marginBottom: 8, textAlign: ar ? 'right' : 'left' }}>{ar ? 'تقدير الزكاة' : 'Zakat estimate'}</REyebrow>
      {z.nisab > 0 ? (
        <>
          <Text style={{ fontFamily: fontBody(lang), fontSize: 14, lineHeight: 20, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>
            {z.reached
              ? (ar ? `نحو ${n(z.due)} ${z.currency} إذا مرّ على ما تملكه عام هجري كامل.` : `About ${n(z.due)} ${z.currency} if you have held this for a full lunar year.`)
              : (ar ? 'ما تملكه دون النصاب، فلا زكاة عليه الآن.' : 'What you hold is below the nisab, so no zakat is due on it now.')}
          </Text>
          <Pressable onPress={() => setOpen((v) => !v)} hitSlop={8} style={{ marginTop: 8 }}>
            <Text style={{ fontFamily: fontMono('regular'), fontSize: 11, letterSpacing: 0.8, color: tok.gold, textAlign: ar ? 'right' : 'left' }}>{open ? (ar ? 'إخفاء الحساب' : 'HIDE THE WORKING') : (ar ? 'كيف حُسب هذا؟' : 'HOW IS THIS WORKED OUT?')}</Text>
          </Pressable>
          {open && (
            <View style={{ marginTop: 10, gap: 6 }}>
              <Row label={ar ? 'النصاب (٨٥ جراماً من الذهب)' : 'Nisab (85 g of gold)'} value={`${n(z.nisab)} ${z.currency}`} />
              <Row label={ar ? 'ما تملكه (الحسابات والكاش والمدخرات، ناقص الديون)' : 'What you hold (accounts, cash, savings, minus debts)'} value={`${n(z.wealth)} ${z.currency}`} />
              <Text style={{ fontFamily: fontBody(lang), fontSize: 11.5, lineHeight: 17, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>
                {ar ? 'تقدير مما يعرفه سيشات اليوم. لا يعرف إن كان قد مرّ على المال عام هجري كامل، فتأكد من ذلك ومن التفاصيل مع من تثق به.' : 'An estimate from what Seshat knows today. It cannot tell whether you have held this for a full lunar year, so confirm that and the details with someone you trust.'}
              </Text>
            </View>
          )}
        </>
      ) : (
        <Text style={{ fontFamily: fontBody(lang), fontSize: 13, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>{ar ? 'سعر الذهب غير متاح الآن، فلا يمكن حساب النصاب.' : 'The gold price is not available right now, so the nisab cannot be worked out.'}</Text>
      )}
    </RCard>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  return (
    <View style={{ flexDirection: ar ? 'row-reverse' : 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ flex: 1, fontFamily: fontBody(lang), fontSize: 13, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>{label}</Text>
      <Text style={{ fontFamily: fontMono('regular'), fontSize: 13, color: tok.bone }}>{value}</Text>
    </View>
  );
}
