import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { Polyline, Line } from 'react-native-svg';
import { apiFetch } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { fontBody, fontMono } from '../lib/fonts';
import { RPill } from './ui';

type Point = { date: string; value: number; cost: number };
type Range = '1m' | '3m' | '6m' | '1y' | 'all';

/** "12 Aug", with the year when it is not this year. */
const shortDate = (iso: string, ar: boolean) => {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(ar ? 'ar-EG' : 'en-GB', d.getFullYear() === new Date().getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Value over time for what you hold: the gold line is what it is worth, the dashed one what you put in. The range
 * buttons sit above it and the first date is written under it. `path` is the history endpoint (the whole portfolio, or
 * one holding); `refreshKey` reloads it when what you hold changes.
 */
export function RangeChart({ path, refreshKey }: { path: string; refreshKey?: string | number }) {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const [range, setRange] = useState<Range>('3m');
  const [pts, setPts] = useState<Point[]>([]);

  useEffect(() => {
    let alive = true;
    apiFetch<{ data: { points: Point[] } }>(`${path}?range=${range}`).then((h) => { if (alive) setPts(h.data.points); }).catch(() => { if (alive) setPts([]); });
    return () => { alive = false; };
  }, [path, range, refreshKey]);

  const W = 300; const H = 70;
  const line = (() => {
    if (pts.length < 2) return null;
    const vals = pts.flatMap((p) => [p.value, p.cost]);
    const lo = Math.min(...vals); const hi = Math.max(...vals); const span = Math.max(1, hi - lo);
    const xy = (v: number, i: number) => `${(i / (pts.length - 1)) * W},${H - ((v - lo) / span) * (H - 8) - 4}`;
    return { value: pts.map((p, i) => xy(p.value, i)).join(' '), cost: pts.map((p, i) => xy(p.cost, i)).join(' ') };
  })();
  const label = ({ '1m': ar ? 'شهر' : '1M', '3m': ar ? '٣ أشهر' : '3M', '6m': ar ? '٦ أشهر' : '6M', '1y': ar ? 'سنة' : '1Y', all: ar ? 'الكل' : 'All' }) as Record<Range, string>;

  return (
    <View style={{ marginTop: 14 }}>
      <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 6, marginBottom: 10 }}>
        {(['1m', '3m', '6m', '1y', 'all'] as const).map((r) => <RPill key={r} active={range === r} onPress={() => setRange(r)}>{label[r]}</RPill>)}
      </View>
      {line ? (
        <>
          <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <Line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke={tok.border} strokeWidth="1" />
            <Polyline points={line.cost} fill="none" stroke={tok.muted} strokeWidth="1.5" strokeDasharray="4 4" />
            <Polyline points={line.value} fill="none" stroke={tok.gold} strokeWidth="2.2" />
          </Svg>
          <View style={{ flexDirection: ar ? 'row-reverse' : 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={{ fontFamily: fontMono('regular'), fontSize: 10, color: tok.muted }}>{shortDate(pts[0].date, ar)}</Text>
            <Text style={{ fontFamily: fontMono('regular'), fontSize: 10, color: tok.muted }}>{ar ? 'اليوم' : 'Today'}</Text>
          </View>
          <Text style={{ fontFamily: fontBody(lang), fontSize: 11, color: tok.muted, marginTop: 6, textAlign: ar ? 'right' : 'left' }}>{ar ? 'الخط الذهبي قيمتها، والمنقّط ما دفعت.' : 'Gold line is what it is worth, dashed is what you put in.'}</Text>
        </>
      ) : (
        <Text style={{ fontFamily: fontBody(lang), fontSize: 12, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>{ar ? 'لا بيانات كافية لهذه الفترة بعد.' : 'Not enough history for this period yet.'}</Text>
      )}
    </View>
  );
}
