import { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useI18n } from '../lib/i18n';
import { apiFetch } from '../lib/api';
import { fontBody, fontMono } from '../lib/fonts';
import { REyebrow, RButton, RField, RPill } from './ui';
import { Sheet } from './MoneySheets';
import { emitDataChanged } from '../lib/dataEvents';

export type Holding = {
  id: string; type: 'gold' | 'currency' | 'crypto' | 'other'; name: string; symbol: string | null; karat: number | null; unit: string; premiumPct: number;
  currency: string; quantity: number; cost: number; avgPrice: number; realized: number; unitPrice: number | null; priceSource: 'feed' | 'manual' | 'none'; priceAt: string | null;
  value: number | null; gain: number | null; gainPct: number | null; goalId?: string | null;
  lots: Array<{ kind: 'buy' | 'sell'; date: string; quantity: number; unitPrice: number; fees: number }>;
};
type Acct = { id: string; name: string };

const TYPES = ['gold', 'currency', 'crypto', 'other'] as const;
const CURRENCIES = ['USD', 'EUR', 'SAR', 'AED', 'GBP'];
const COINS = ['BTC', 'ETH', 'USDT'];
const today = () => new Date().toISOString().slice(0, 10);
const num = (s: string) => parseFloat(s.replace(/,/g, '')) || 0;

function useAccounts(visible: boolean) {
  const [accts, setAccts] = useState<Acct[]>([]);
  useEffect(() => { if (visible) apiFetch<{ data: Acct[] }>('/cards').then((r) => setAccts(r.data)).catch(() => {}); }, [visible]);
  return accts;
}

/** Add something you bought: gold, foreign currency, crypto, or anything priced by hand. */
export function AddHoldingSheet({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: () => void }) {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const accts = useAccounts(visible);
  const [type, setType] = useState<(typeof TYPES)[number]>('gold');
  const [karat, setKarat] = useState(21);
  const [premium, setPremium] = useState('');
  const [symbol, setSymbol] = useState('USD');
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(today());
  const [acct, setAcct] = useState<string | null>(null);
  const [move, setMove] = useState(true);
  const [quote, setQuote] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (visible) { setType('gold'); setKarat(21); setPremium(''); setSymbol('USD'); setName(''); setQty(''); setPrice(''); setDate(today()); setAcct(null); setMove(true); } }, [visible]);
  useEffect(() => {
    if (!visible || type === 'other') { setQuote(null); return; }
    const q = type === 'gold' ? `type=gold&karat=${karat}&premiumPct=${num(premium)}` : `type=${type}&symbol=${symbol}`;
    let alive = true;
    apiFetch<{ data: { unitPrice: number | null } }>(`/savings/quote?${q}`).then((r) => { if (alive) setQuote(r.data.unitPrice); }).catch(() => { if (alive) setQuote(null); });
    return () => { alive = false; };
  }, [visible, type, karat, premium, symbol]);

  const unitLabel = type === 'gold' ? (ar ? 'جرام' : 'grams') : type === 'other' ? (ar ? 'وحدات' : 'units') : symbol;
  const ok = num(qty) > 0 && num(price) > 0 && (type !== 'other' || !!name.trim()) && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const save = async () => {
    if (!ok) return;
    setBusy(true);
    try {
      await apiFetch('/savings', { method: 'POST', body: JSON.stringify({
        type, name: name.trim() || undefined, symbol: type === 'currency' || type === 'crypto' ? symbol : undefined, karat: type === 'gold' ? karat : undefined,
        premiumPct: type === 'gold' && premium ? num(premium) : undefined, quantity: num(qty), unitPrice: num(price), date, cardId: acct ?? undefined, moveMoney: move,
      }) });
      emitDataChanged(); onDone();
    } catch (err) { Alert.alert(ar ? 'تعذّر الحفظ' : 'Could not save', err instanceof Error ? err.message : undefined); }
    finally { setBusy(false); }
  };
  const typeLabel = (t: string) => ({ gold: ar ? 'ذهب' : 'Gold', currency: ar ? 'عملة' : 'Currency', crypto: ar ? 'كريبتو' : 'Crypto', other: ar ? 'أخرى' : 'Other' } as Record<string, string>)[t];

  return (
    <Sheet visible={visible} onClose={onClose} title={ar ? 'أضف ادخاراً' : 'Add a saving'}
      hint={ar ? 'ما اشتريته بفلوسك: ذهب أو دولار أو غيره. يتتبّع سيشات قيمته ومكسبك أو خسارتك.' : 'Something you bought with your money. Seshat tracks its value and what you gained or lost.'}>
      <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
        {TYPES.map((t) => <RPill key={t} active={type === t} onPress={() => setType(t)}>{typeLabel(t)}</RPill>)}
      </View>
      {type === 'gold' && (
        <View style={{ gap: 12 }}>
          <View style={{ gap: 8 }}>
            <REyebrow>{ar ? 'العيار' : 'Karat'}</REyebrow>
            <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 8 }}>{[24, 22, 21, 18].map((k) => <RPill key={k} active={karat === k} onPress={() => setKarat(k)}>{`${k}k`}</RPill>)}</View>
          </View>
          <RField label={ar ? 'زيادة سعر المحل % (اختياري)' : 'Shop price above the world price, % (optional)'} value={premium} onChange={(v) => setPremium(v.replace(/[^0-9.\-]/g, ''))} keyboardType="decimal-pad" mono />
        </View>
      )}
      {type === 'currency' && (
        <View style={{ gap: 8 }}>
          <REyebrow>{ar ? 'العملة' : 'Currency'}</REyebrow>
          <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>{CURRENCIES.map((c) => <RPill key={c} active={symbol === c} onPress={() => setSymbol(c)}>{c}</RPill>)}</View>
        </View>
      )}
      {type === 'crypto' && (
        <View style={{ gap: 8 }}>
          <REyebrow>{ar ? 'العملة الرقمية' : 'Coin'}</REyebrow>
          <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>{COINS.map((c) => <RPill key={c} active={symbol === c} onPress={() => setSymbol(c)}>{c}</RPill>)}</View>
        </View>
      )}
      {type === 'other' && <RField label={ar ? 'الاسم (شهادة، سهم، صندوق…)' : 'Name (certificate, share, fund...)'} value={name} onChange={setName} />}
      <RField label={ar ? `الكمية (${unitLabel})` : `Quantity (${unitLabel})`} value={qty} onChange={(v) => setQty(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" mono />
      <View style={{ gap: 6 }}>
        <RField label={ar ? `سعر الوحدة عند الشراء` : 'Price per unit when you bought'} value={price} onChange={(v) => setPrice(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" mono />
        {quote !== null && (
          <Pressable onPress={() => setPrice(String(quote))}>
            <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 13, color: '#C9A84C', textAlign: ar ? 'right' : 'left' }}>
              {ar ? `سعر اليوم ${quote.toLocaleString('en-US')} (اضغط للاستخدام)` : `Today's price ${quote.toLocaleString('en-US')} (tap to use)`}
            </Text>
          </Pressable>
        )}
      </View>
      <RField label={ar ? 'تاريخ الشراء (YYYY-MM-DD)' : 'Bought on (YYYY-MM-DD)'} value={date} onChange={(v) => setDate(v.replace(/[^0-9-]/g, '').slice(0, 10))} keyboardType="numeric" mono />
      <View style={{ gap: 8 }}>
        <REyebrow>{ar ? 'خُصم من' : 'Paid from'}</REyebrow>
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
          <RPill active={!move} onPress={() => setMove(false)}>{ar ? 'لا تخصم من حساب' : 'Do not deduct'}</RPill>
          <RPill active={move && acct === null} onPress={() => { setMove(true); setAcct(null); }}>{ar ? 'كاش' : 'Cash'}</RPill>
          {accts.filter((a) => a.name !== 'Cash').map((a) => <RPill key={a.id} active={move && acct === a.id} onPress={() => { setMove(true); setAcct(a.id); }}>{a.name}</RPill>)}
        </View>
      </View>
      {ok && <Text style={{ fontFamily: fontMono('regular'), fontSize: 12, color: '#9C9A92', textAlign: ar ? 'right' : 'left' }}>
        {ar ? `التكلفة ${Math.round(num(qty) * num(price)).toLocaleString('en-US')}` : `Cost ${Math.round(num(qty) * num(price)).toLocaleString('en-US')}`}
      </Text>}
      <RButton full onPress={save} disabled={!ok} loading={busy}>{ar ? 'احفظ' : 'Save'}</RButton>
    </Sheet>
  );
}

/** Buy more or sell some of a holding. */
export function TradeSheet({ visible, kind, holding, onClose, onDone }: { visible: boolean; kind: 'buy' | 'sell'; holding: Holding | null; onClose: () => void; onDone: () => void }) {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const accts = useAccounts(visible);
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [acct, setAcct] = useState<string | null>(null);
  const [move, setMove] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible && holding) { setQty(''); setPrice(holding.unitPrice ? String(holding.unitPrice) : ''); setAcct(null); setMove(true); } }, [visible, holding?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!holding) return <Sheet visible={false} onClose={onClose} title="">{null}</Sheet>;
  const ok = num(qty) > 0 && num(price) > 0 && (kind === 'buy' || num(qty) <= holding.quantity);
  const save = async () => {
    setBusy(true);
    try {
      await apiFetch(`/savings/${holding.id}/${kind}`, { method: 'POST', body: JSON.stringify({ quantity: num(qty), unitPrice: num(price), cardId: acct ?? undefined, moveMoney: move }) });
      emitDataChanged(); onDone();
    } catch (err) { Alert.alert(ar ? 'تعذّر الحفظ' : 'Could not save', err instanceof Error ? err.message : undefined); }
    finally { setBusy(false); }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={kind === 'buy' ? (ar ? `اشترِ المزيد · ${holding.name}` : `Buy more · ${holding.name}`) : (ar ? `بيع · ${holding.name}` : `Sell · ${holding.name}`)}
      hint={kind === 'sell' ? (ar ? `لديك ${holding.quantity} ${holding.unit}` : `You hold ${holding.quantity} ${holding.unit}`) : undefined}>
      <RField label={ar ? `الكمية (${holding.unit})` : `Quantity (${holding.unit})`} value={qty} onChange={(v) => setQty(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" mono />
      <RField label={ar ? 'سعر الوحدة' : 'Price per unit'} value={price} onChange={(v) => setPrice(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" mono />
      <View style={{ gap: 8 }}>
        <REyebrow>{kind === 'buy' ? (ar ? 'خُصم من' : 'Paid from') : (ar ? 'دخل إلى' : 'Received into')}</REyebrow>
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
          <RPill active={!move} onPress={() => setMove(false)}>{ar ? 'بدون حساب' : 'No account'}</RPill>
          <RPill active={move && acct === null} onPress={() => { setMove(true); setAcct(null); }}>{ar ? 'كاش' : 'Cash'}</RPill>
          {accts.filter((a) => a.name !== 'Cash').map((a) => <RPill key={a.id} active={move && acct === a.id} onPress={() => { setMove(true); setAcct(a.id); }}>{a.name}</RPill>)}
        </View>
      </View>
      <RButton full onPress={save} disabled={!ok} loading={busy}>{kind === 'buy' ? (ar ? 'سجّل الشراء' : 'Record the purchase') : (ar ? 'سجّل البيع' : 'Record the sale')}</RButton>
    </Sheet>
  );
}
