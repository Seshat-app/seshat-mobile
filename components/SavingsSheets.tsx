import { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useI18n } from '../lib/i18n';
import { apiFetch } from '../lib/api';
import { fontBody, fontMono } from '../lib/fonts';
import { REyebrow, RButton, RField, RPill } from './ui';
import { Sheet } from './MoneySheets';
import { DateField } from './DateField';
import { emitDataChanged } from '../lib/dataEvents';

export type Holding = {
  id: string; type: 'gold' | 'currency' | 'crypto' | 'stock' | 'other'; name: string; symbol: string | null; karat: number | null; unit: string; premiumPct: number;
  currency: string; quantity: number; cost: number; avgPrice: number; realized: number; making: number; avgPriceNoFees: number; unitPrice: number | null; priceSource: 'feed' | 'manual' | 'none'; priceAt: string | null;
  value: number | null; gain: number | null; gainPct: number | null; goalId?: string | null;
  lots: Array<{ kind: 'buy' | 'sell'; date: string; quantity: number; unitPrice: number; fees: number }>;
};
type Acct = { id: string; name: string; kind?: string };

const TYPES = ['gold', 'currency', 'crypto', 'stock', 'other'] as const;
const TICKERS = ['COMI.CA', 'TMGH.CA', 'HRHO.CA', 'AAPL', 'NVDA'];
const CURRENCIES = ['USD', 'EUR', 'SAR', 'AED', 'GBP'];
const COINS = ['BTC', 'ETH', 'USDT'];
const today = () => new Date().toISOString().slice(0, 10);
const num = (s: string) => parseFloat(s.replace(/,/g, '')) || 0;
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Gold only: the masna3ya, what the shop charged to shape the gold. Per gram or for the whole piece. */
function MakingField({ value, onChange, per, onPer }: { value: string; onChange: (v: string) => void; per: 'gram' | 'total'; onPer: (p: 'gram' | 'total') => void }) {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  return (
    <View style={{ gap: 8 }}>
      <RField label={ar ? 'المصنعية (اختياري)' : 'Masna3ya, the making charge (optional)'} value={value} onChange={(v) => onChange(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" mono />
      <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 8 }}>
        <RPill active={per === 'gram'} onPress={() => onPer('gram')}>{ar ? 'للجرام' : 'per gram'}</RPill>
        <RPill active={per === 'total'} onPress={() => onPer('total')}>{ar ? 'إجمالي' : 'in total'}</RPill>
      </View>
    </View>
  );
}

/** Today's price, or the price on a past day, for the "tap to use" hint. */
function useQuote(on: boolean, query: string, day: string | null) {
  const [q, setQ] = useState<number | null>(null);
  useEffect(() => {
    if (!on) { setQ(null); return; }
    let alive = true;
    apiFetch<{ data: { unitPrice: number | null } }>(`/savings/quote?${query}${day ? `&date=${day}` : ''}`).then((r) => { if (alive) setQ(r.data.unitPrice); }).catch(() => { if (alive) setQ(null); });
    return () => { alive = false; };
  }, [on, query, day]);
  return q;
}

function useAccounts(visible: boolean) {
  const [accts, setAccts] = useState<Acct[]>([]);
  useEffect(() => { if (visible) apiFetch<{ data: Acct[] }>('/cards').then((r) => setAccts(r.data)).catch(() => {}); }, [visible]);
  return accts;
}

/** The form for adding something you bought: gold, foreign currency, crypto, or anything priced by hand. Lives on its own screen. */
export function HoldingForm({ onDone }: { onDone: () => void }) {
  const visible = true;
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const accts = useAccounts(visible);
  const [type, setType] = useState<(typeof TYPES)[number]>('gold');
  const [karat, setKarat] = useState(21);
  const [symbol, setSymbol] = useState('USD');
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(today());
  const [acct, setAcct] = useState<string | null>(null);
  const [move, setMove] = useState(true);
  // Something you already owned before using Seshat: it keeps its real date and never touches an account balance.
  const [owned, setOwned] = useState(false);
  const [making, setMaking] = useState('');
  const [makingPer, setMakingPer] = useState<'gram' | 'total'>('gram');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (visible) { setType('gold'); setKarat(21); setSymbol('USD'); setName(''); setQty(''); setPrice(''); setDate(today()); setAcct(null); setMove(true); setOwned(false); setMaking(''); setMakingPer('gram'); } }, [visible]);
  const quote = useQuote(type !== 'other', type === 'gold' ? `type=gold&karat=${karat}` : `type=${type}&symbol=${symbol}`, owned && isDay(date) ? date : null);

  const unitLabel = type === 'gold' ? (ar ? 'جرام' : 'grams') : type === 'stock' ? (ar ? 'أسهم' : 'shares') : type === 'other' ? (ar ? 'وحدات' : 'units') : symbol;
  const ok = num(qty) > 0 && num(price) > 0 && (type !== 'other' || !!name.trim()) && (type !== 'stock' || /^[A-Z0-9.^=\-]{1,14}$/.test(symbol)) && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const fees = type === 'gold' ? Math.round((makingPer === 'gram' ? num(making) * num(qty) : num(making)) * 100) / 100 : 0;
  const save = async () => {
    if (!ok) return;
    setBusy(true);
    try {
      await apiFetch('/savings', { method: 'POST', body: JSON.stringify({
        type, name: name.trim() || undefined, symbol: type === 'currency' || type === 'crypto' || type === 'stock' ? symbol : undefined, karat: type === 'gold' ? karat : undefined,
        quantity: num(qty), unitPrice: num(price), date, fees: fees || undefined, cardId: owned ? undefined : acct ?? undefined, moveMoney: owned ? false : move,
      }) });
      emitDataChanged(); onDone();
    } catch (err) { Alert.alert(ar ? 'تعذّر الحفظ' : 'Could not save', err instanceof Error ? err.message : undefined); }
    finally { setBusy(false); }
  };
  const typeLabel = (t: string) => ({ gold: ar ? 'ذهب' : 'Gold', currency: ar ? 'عملة' : 'Currency', crypto: ar ? 'كريبتو' : 'Crypto', stock: ar ? 'أسهم' : 'Stock', other: ar ? 'أخرى' : 'Other' } as Record<string, string>)[t];

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
          <RPill active={!owned} onPress={() => { setOwned(false); setDate(today()); }}>{ar ? 'أشتريه الآن' : 'I am buying it now'}</RPill>
          <RPill active={owned} onPress={() => { setOwned(true); setPrice(''); }}>{ar ? 'أملكه من قبل' : 'I already own it'}</RPill>
        </View>
        {owned && <Text style={{ fontFamily: fontBody(lang), fontSize: 12, color: '#9C9A92', lineHeight: 18, textAlign: ar ? 'right' : 'left' }}>{ar ? 'يُحسب من تاريخ شرائه ولا يتغير أي رصيد حساب. إن اشتريته على دفعات بأسعار مختلفة فأضف كل دفعة على حدة.' : 'It is counted from the date you bought it, and no account balance changes. If you bought it in several parts at different prices, add each part separately.'}</Text>}
      </View>
      <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
        {TYPES.map((t) => <RPill key={t} active={type === t} onPress={() => { setType(t); if (t === 'stock') setSymbol('COMI.CA'); else if (t === 'crypto') setSymbol('BTC'); else if (t === 'currency') setSymbol('USD'); }}>{typeLabel(t)}</RPill>)}
      </View>
      {type === 'gold' && (
        <View style={{ gap: 12 }}>
          <View style={{ gap: 8 }}>
            <REyebrow>{ar ? 'العيار' : 'Karat'}</REyebrow>
            <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 8 }}>{[24, 22, 21, 18].map((k) => <RPill key={k} active={karat === k} onPress={() => setKarat(k)}>{`${k}k`}</RPill>)}</View>
          </View>
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
      {type === 'stock' && (
        <View style={{ gap: 8 }}>
          <RField label={ar ? 'رمز السهم (البورصة المصرية تنتهي بـ .CA)' : 'Ticker (Egyptian stocks end in .CA)'} value={symbol} onChange={(v) => setSymbol(v.toUpperCase().replace(/[^A-Z0-9.^=\-]/g, '').slice(0, 14))} mono />
          <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>{TICKERS.map((c) => <RPill key={c} active={symbol === c} onPress={() => setSymbol(c)}>{c}</RPill>)}</View>
        </View>
      )}
      {type === 'other' && <RField label={ar ? 'الاسم (شهادة، سهم، صندوق…)' : 'Name (certificate, share, fund...)'} value={name} onChange={setName} />}
      <RField label={ar ? `الكمية (${unitLabel})` : `Quantity (${unitLabel})`} value={qty} onChange={(v) => setQty(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" mono />
      <DateField label={owned ? (ar ? 'تاريخ الشراء تقريباً' : 'Bought on, roughly is fine') : (ar ? 'تاريخ الشراء' : 'Bought on')} value={date} onChange={setDate} maximumDate={new Date()} />
      <View style={{ gap: 6 }}>
        <RField label={type === 'gold' ? (ar ? 'سعر جرام الذهب عند الشراء (بدون المصنعية)' : 'Gold price per gram when you bought (without masna3ya)') : (ar ? `سعر الوحدة عند الشراء` : 'Price per unit when you bought')} value={price} onChange={(v) => setPrice(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" mono />
        {quote !== null && (
          <Pressable onPress={() => setPrice(String(quote))}>
            <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 13, color: '#C9A84C', textAlign: ar ? 'right' : 'left' }}>
              {owned ? (ar ? `السعر يوم ${date}: ${quote.toLocaleString('en-US')} (اضغط للاستخدام)` : `Price on ${date}: ${quote.toLocaleString('en-US')} (tap to use)`) : (ar ? `سعر اليوم ${quote.toLocaleString('en-US')} (اضغط للاستخدام)` : `Today's price ${quote.toLocaleString('en-US')} (tap to use)`)}
            </Text>
          </Pressable>
        )}
      </View>
      {type === 'gold' && <MakingField value={making} onChange={setMaking} per={makingPer} onPer={setMakingPer} />}
      {!owned && <View style={{ gap: 8 }}>
        <REyebrow>{ar ? 'خُصم من' : 'Paid from'}</REyebrow>
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
          <RPill active={!move} onPress={() => setMove(false)}>{ar ? 'لا تخصم من حساب' : 'Do not deduct'}</RPill>
          <RPill active={move && acct === null} onPress={() => { setMove(true); setAcct(null); }}>{ar ? 'كاش' : 'Cash'}</RPill>
          {accts.filter((a) => a.kind !== 'cash').map((a) => <RPill key={a.id} active={move && acct === a.id} onPress={() => { setMove(true); setAcct(a.id); }}>{a.name}</RPill>)}
        </View>
      </View>}
      {ok && <Text style={{ fontFamily: fontMono('regular'), fontSize: 12, color: '#9C9A92', textAlign: ar ? 'right' : 'left' }}>
        {ar ? `التكلفة ${Math.round(num(qty) * num(price) + fees).toLocaleString('en-US')}${fees > 0 ? ` · منها مصنعية ${Math.round(fees).toLocaleString('en-US')}` : ''}` : `Cost ${Math.round(num(qty) * num(price) + fees).toLocaleString('en-US')}${fees > 0 ? ` · masna3ya ${Math.round(fees).toLocaleString('en-US')} of it` : ''}`}
      </Text>}
      <RButton full onPress={save} disabled={!ok} loading={busy}>{ar ? 'احفظ' : 'Save'}</RButton>
    </View>
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
  const [owned, setOwned] = useState(false);
  const [date, setDate] = useState(today());
  const [making, setMaking] = useState('');
  const [makingPer, setMakingPer] = useState<'gram' | 'total'>('gram');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible && holding) { setQty(''); setPrice(holding.unitPrice ? String(holding.unitPrice) : ''); setAcct(null); setMove(true); setOwned(false); setDate(today()); setMaking(''); setMakingPer('gram'); } }, [visible, holding?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const old = kind === 'buy' && owned;
  const pastQuote = useQuote(!!holding && old && isDay(date) && holding.type !== 'other',
    holding ? (holding.type === 'gold' ? `type=gold&karat=${holding.karat ?? 21}&premiumPct=${holding.premiumPct || 0}` : `type=${holding.type}&symbol=${holding.symbol ?? ''}`) : '', old && isDay(date) ? date : null);
  if (!holding) return <Sheet visible={false} onClose={onClose} title="">{null}</Sheet>;
  const ok = num(qty) > 0 && num(price) > 0 && (kind === 'buy' || num(qty) <= holding.quantity);
  const save = async () => {
    setBusy(true);
    try {
      const fees = holding.type === 'gold' && kind === 'buy' ? (makingPer === 'gram' ? num(making) * num(qty) : num(making)) : 0;
      await apiFetch(`/savings/${holding.id}/${kind}`, { method: 'POST', body: JSON.stringify({ quantity: num(qty), unitPrice: num(price), fees: fees || undefined, date: old ? date : undefined, cardId: old ? undefined : acct ?? undefined, moveMoney: old ? false : move }) });
      emitDataChanged(); onDone();
    } catch (err) { Alert.alert(ar ? 'تعذّر الحفظ' : 'Could not save', err instanceof Error ? err.message : undefined); }
    finally { setBusy(false); }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={kind === 'buy' ? (ar ? `اشترِ المزيد · ${holding.name}` : `Buy more · ${holding.name}`) : (ar ? `بيع · ${holding.name}` : `Sell · ${holding.name}`)}
      hint={kind === 'sell' ? (ar ? `لديك ${holding.quantity} ${holding.unit}` : `You hold ${holding.quantity} ${holding.unit}`) : undefined}>
      {kind === 'buy' && (
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
          <RPill active={!owned} onPress={() => { setOwned(false); setDate(today()); }}>{ar ? 'أشتريه الآن' : 'Buying now'}</RPill>
          <RPill active={owned} onPress={() => setOwned(true)}>{ar ? 'شراء سابق' : 'An earlier purchase'}</RPill>
        </View>
      )}
      <RField label={ar ? `الكمية (${holding.unit})` : `Quantity (${holding.unit})`} value={qty} onChange={(v) => setQty(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" mono />
      {old && <DateField label={ar ? 'تاريخ الشراء تقريباً' : 'Bought on, roughly is fine'} value={date} onChange={setDate} maximumDate={new Date()} />}
      <View style={{ gap: 6 }}>
        <RField label={ar ? 'سعر الوحدة' : 'Price per unit'} value={price} onChange={(v) => setPrice(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" mono />
        {old && pastQuote !== null && (
          <Pressable onPress={() => setPrice(String(pastQuote))}>
            <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 13, color: '#C9A84C', textAlign: ar ? 'right' : 'left' }}>{ar ? `السعر يوم ${date}: ${pastQuote.toLocaleString('en-US')} (اضغط للاستخدام)` : `Price on ${date}: ${pastQuote.toLocaleString('en-US')} (tap to use)`}</Text>
          </Pressable>
        )}
      </View>
      {kind === 'buy' && holding.type === 'gold' && <MakingField value={making} onChange={setMaking} per={makingPer} onPer={setMakingPer} />}
      {!old && <View style={{ gap: 8 }}>
        <REyebrow>{kind === 'buy' ? (ar ? 'خُصم من' : 'Paid from') : (ar ? 'دخل إلى' : 'Received into')}</REyebrow>
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
          <RPill active={!move} onPress={() => setMove(false)}>{ar ? 'بدون حساب' : 'No account'}</RPill>
          <RPill active={move && acct === null} onPress={() => { setMove(true); setAcct(null); }}>{ar ? 'كاش' : 'Cash'}</RPill>
          {accts.filter((a) => a.kind !== 'cash').map((a) => <RPill key={a.id} active={move && acct === a.id} onPress={() => { setMove(true); setAcct(a.id); }}>{a.name}</RPill>)}
        </View>
      </View>}
      <RButton full onPress={save} disabled={!ok} loading={busy}>{kind === 'buy' ? (ar ? 'سجّل الشراء' : 'Record the purchase') : (ar ? 'سجّل البيع' : 'Record the sale')}</RButton>
    </Sheet>
  );
}
