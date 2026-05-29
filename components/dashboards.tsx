import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { ArrowUp, ArrowDown } from 'lucide-react-native';
import { useI18n, monthYear } from '../lib/i18n';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { RCard, REyebrow, RAmount, RProgress, RStatus } from './ui';
import { SectionHeader, RTxRow, type TxRowData } from './shell';
import { RadarMark } from './RadarMark';
import { catIdFromName, catLabel } from '../lib/categoryMap';

export type DashboardData = {
  current: {
    income: { total: number; count: number };
    expense: { total: number; count: number };
    balance: number;
  };
  previous?: {
    income: { total: number; count: number };
    expense: { total: number; count: number };
  };
  categoryBreakdown: Array<{
    categoryId: string;
    nameEn: string;
    nameAr?: string;
    emoji?: string;
    total: number;
  }>;
  recentTransactions: TxRowData[];
};

type SeshatInsightData = {
  // Optional hero number rendered large + gold above the prose, when the
  // insight has a stat worth anchoring on. Skip for prose-only insights.
  hero?: { value: string; label?: string };
  // The main sentence in Seshat's voice. Always present.
  text: string;
};

// Insight pulled from real data. Returns a structured payload so the card
// can render a hero number prominently when one exists, falling back to
// prose-only when nothing's worth anchoring. Seshat's voice stays the same
// either way.
function buildInsight(data: DashboardData, lang: 'en' | 'ar'): SeshatInsightData {
  const top = data.categoryBreakdown[0];
  const prevExp = data.previous?.expense.total ?? 0;
  const curExp = data.current.expense.total;
  if (top && prevExp > 0) {
    const delta = ((curExp - prevExp) / prevExp) * 100;
    if (lang === 'ar') {
      const sign = delta >= 0 ? 'أعلى' : 'أقل';
      return {
        hero: { value: curExp.toLocaleString(), label: lang === 'ar' ? 'إجمالي المصروف' : 'total spent' },
        text: `صرفتِ هذا الشهر ${sign} بـ ${Math.abs(delta).toFixed(0)}٪ من الشهر الماضي.`,
      };
    }
    const sign = delta >= 0 ? 'more' : 'less';
    return {
      hero: { value: curExp.toLocaleString(), label: 'total spent' },
      text: `That's ${Math.abs(delta).toFixed(0)}% ${sign} than last month.`,
    };
  }
  if (top) {
    return {
      hero: { value: top.total.toLocaleString(), label: catLabel(top, lang) },
      text: lang === 'ar'
        ? 'أكبر فئة هذا الشهر — تابعيها.'
        : 'Your biggest category this month — watch it.',
    };
  }
  return {
    text: lang === 'ar'
      ? 'لا شيء مسجَّل بعد. أضف معاملة وسأبدأ.'
      : 'Nothing recorded yet. Add a transaction and I begin.',
  };
}

/**
 * Seshat insight card - the conversational "noticed by your AI coach"
 * block that lives on every dashboard layout. One implementation, used
 * everywhere, so the design stays consistent and any future tweak
 * propagates once.
 *
 * When the insight has a hero value, it's rendered in big gold type so
 * the card has a stat anchor. Without one (prose-only insights like "no
 * data yet"), the prose carries the card alone.
 */
function SeshatInsightCard({ data, currency }: { data: DashboardData; currency: string }) {
  const { tok, lang } = useI18n();
  const insight = buildInsight(data, lang);
  return (
    <RCard padding={16}>
      <View style={{
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', gap: 8, marginBottom: 10,
      }}>
        <RadarMark size={16} gold={tok.gold} lightRing animate={false} />
        <Text style={{
          fontFamily: fontMono('regular'), fontSize: 10, letterSpacing: 2,
          color: tok.gold, textTransform: 'uppercase',
        }}>
          {lang === 'ar' ? 'سيشات لاحظت' : 'Seshat noticed'}
        </Text>
      </View>

      {insight.hero ? (
        <View style={{ marginBottom: 10 }}>
          <Text style={{
            fontFamily: fontHead(lang), fontSize: 30, color: tok.gold,
            letterSpacing: -0.5, lineHeight: 36,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>
            {insight.hero.value}
            <Text style={{ fontFamily: fontMono('regular'), fontSize: 13, color: tok.muted }}>
              {'  '}{currency}
            </Text>
          </Text>
          {insight.hero.label ? (
            <Text style={{
              marginTop: 2,
              fontFamily: fontBody(lang), fontSize: 12, color: tok.muted,
              textAlign: lang === 'ar' ? 'right' : 'left',
            }}>
              {insight.hero.label}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Text style={{
        fontFamily: fontBody(lang),
        fontSize: lang === 'ar' ? 14.5 : 14,
        lineHeight: 21, color: tok.bone,
        textAlign: lang === 'ar' ? 'right' : 'left',
        writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
      }}>
        {insight.text}
      </Text>
    </RCard>
  );
}

// ─────────────────────────────────────────────────────────────
// Numbers-first (Dashboard A) — canonical numbers-as-hero layout
// ─────────────────────────────────────────────────────────────
export function DashboardNumbers({ data, currency }: { data: DashboardData; currency: string }) {
  const { tok, lang, t } = useI18n();
  const max = data.categoryBreakdown[0]?.total ?? 1;
  const list = data.recentTransactions.slice(0, 5);

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 120 }}>
      {/* Hero net balance */}
      <RCard large>
        <REyebrow>{t('netBalance')}</REyebrow>
        <View style={{ marginTop: 10 }}>
          <RAmount value={data.current.balance} size={lang === 'ar' ? 40 : 44} currency={currency} decimals={0} />
        </View>
        <View style={{ flexDirection: 'row', gap: 22, marginTop: 22 }}>
          <View style={{ flex: 1 }}>
            <REyebrow>{t('income')}</REyebrow>
            <View style={{ marginTop: 4 }}>
              <RAmount value={data.current.income.total} size={16} currency={currency} sign decimals={0} />
            </View>
          </View>
          <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: tok.border }} />
          <View style={{ flex: 1 }}>
            <REyebrow>{t('expenses')}</REyebrow>
            <View style={{ marginTop: 4 }}>
              <RAmount value={-data.current.expense.total} size={16} currency={currency} sign decimals={0} />
            </View>
          </View>
        </View>
      </RCard>

      {/* Seshat insight */}
      <View style={{ marginTop: 12 }}>
        <SeshatInsightCard data={data} currency={currency} />
      </View>

      {/* Spend by category */}
      {data.categoryBreakdown.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <SectionHeader label={t('spendByCategory')} />
          <RCard style={{ marginTop: 8 }}>
            {data.categoryBreakdown.slice(0, 5).map((cat, i) => {
              const pct = (cat.total / max) * 100;
              return (
                <View key={cat.categoryId} style={{ marginTop: i === 0 ? 0 : 14 }}>
                  <View style={{
                    flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                    justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6,
                  }}>
                    <Text style={{
                      color: tok.bone, fontFamily: fontBody(lang, 'medium'), fontSize: 13,
                    }}>{catLabel(cat, lang)}</Text>
                    <RAmount value={-cat.total} size={12} currency={currency} weight="regular" decimals={0} />
                  </View>
                  <RProgress value={pct} color={i === 0 ? tok.gold : tok.borderHi} height={3} />
                </View>
              );
            })}
          </RCard>
        </View>
      )}

      {/* Recent activity */}
      {list.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <SectionHeader label={t('recentActivity')} action={t('seeAll')} />
          <RCard style={{ marginTop: 8, paddingHorizontal: 18, paddingVertical: 6 }}>
            {list.map((tx, i) => <RTxRow key={tx._id} tx={tx} last={i === list.length - 1} />)}
          </RCard>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// HUD (Dashboard B) — the radar mark scaled to a full instrument
// ─────────────────────────────────────────────────────────────
export function DashboardHud({ data, currency }: { data: DashboardData; currency: string }) {
  const { tok, lang, t } = useI18n();
  const list = data.recentTransactions.slice(0, 4);
  const top = data.categoryBreakdown.slice(0, 6);
  const hasEnough = top.length >= 3;
  const max = top[0]?.total ?? 1;

  const SIZE = 320;
  const cx = SIZE / 2, cy = SIZE / 2;
  const blips = top.map((cat, i) => {
    const angle = -Math.PI / 2 + (i / Math.max(top.length, 1)) * Math.PI * 2 + 0.3;
    const radius = 56 + (i / Math.max(top.length - 1, 1)) * 80;
    return {
      cat,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      size: 4 + (cat.total / max) * 6,
    };
  });

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 120 }}>
      <View style={{
        backgroundColor: tok.surface,
        borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
        borderRadius: 16, padding: 16, overflow: 'hidden',
      }}>
        {/* HUD eyebrows */}
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <REyebrow>{t('detected')} · {monthYear(lang)}</REyebrow>
          <REyebrow color={tok.gold}>● live</REyebrow>
        </View>

        {/* Radar SVG */}
        <View style={{ height: SIZE, marginTop: 4, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ position: 'absolute', top: 0, left: 0 }}>
            {/* rings */}
            {[60, 100, 140].map((r) => (
              <Circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke={tok.border} strokeWidth={0.6} />
            ))}
            {/* crosshairs */}
            <Line x1={cx - 140} y1={cy} x2={cx + 140} y2={cy} stroke={tok.border} strokeWidth={0.6} />
            <Line x1={cx} y1={cy - 140} x2={cx} y2={cy + 140} stroke={tok.border} strokeWidth={0.6} />
            {/* NE quadrant arc + rays */}
            <Path d={`M ${cx + 140} ${cy} A 140 140 0 0 0 ${cx} ${cy - 140}`} stroke={tok.gold} strokeWidth={1.5} fill="none" opacity={0.4} strokeLinecap="round" />
            <Line x1={cx} y1={cy} x2={cx + 140} y2={cy} stroke={tok.gold} strokeWidth={0.8} opacity={0.3} />
            <Line x1={cx} y1={cy} x2={cx} y2={cy - 140} stroke={tok.gold} strokeWidth={0.8} opacity={0.3} />
            {/* diagonal hint lines */}
            <Line x1={cx} y1={cy} x2={cx + 99} y2={cy - 99} stroke={tok.border} strokeWidth={0.4} />
            <Line x1={cx} y1={cy} x2={cx - 99} y2={cy - 99} stroke={tok.border} strokeWidth={0.4} />
            <Line x1={cx} y1={cy} x2={cx + 99} y2={cy + 99} stroke={tok.border} strokeWidth={0.4} />
            <Line x1={cx} y1={cy} x2={cx - 99} y2={cy + 99} stroke={tok.border} strokeWidth={0.4} />
            {/* blips */}
            {hasEnough && blips.map((b, i) => (
              <Circle key={b.cat.categoryId} cx={b.x} cy={b.y} r={b.size} fill={tok.gold} opacity={1 - i * 0.1} />
            ))}
            {hasEnough && blips.map((b) => (
              <Circle key={`ring-${b.cat.categoryId}`} cx={b.x} cy={b.y} r={b.size + 4} fill="none" stroke={tok.gold} strokeWidth={0.4} opacity={0.3} />
            ))}
          </Svg>
          {/* center text */}
          <View pointerEvents="none" style={{
            position: 'absolute', alignItems: 'center', justifyContent: 'center',
          }}>
            {hasEnough ? (
              <>
                <REyebrow>{t('netBalance')}</REyebrow>
                <View style={{ marginTop: 6 }}>
                  <RAmount value={data.current.balance} size={lang === 'ar' ? 28 : 32} currency={currency} decimals={0} />
                </View>
              </>
            ) : (
              <View style={{ alignItems: 'center', paddingHorizontal: 40 }}>
                <Text style={{
                  fontFamily: fontMono('regular'), fontSize: 13, color: tok.bone, letterSpacing: 0.4,
                }}>{t('notEnoughData')}</Text>
                <Text style={{
                  marginTop: 8, fontFamily: fontMono('regular'), fontSize: 10, color: tok.muted,
                  letterSpacing: 0.8, lineHeight: 16, textAlign: 'center',
                }}>{t('notEnoughDataSub')}</Text>
              </View>
            )}
          </View>
        </View>

        {/* HUD footer row */}
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          justifyContent: 'space-between', alignItems: 'center',
          paddingTop: 12,
          borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tok.border,
        }}>
          <View>
            <REyebrow>{t('income')}</REyebrow>
            <View style={{ marginTop: 2 }}>
              <RAmount value={data.current.income.total} size={14} currency={currency} sign decimals={0} />
            </View>
          </View>
          <View>
            <REyebrow>{t('expenses')}</REyebrow>
            <View style={{ marginTop: 2 }}>
              <RAmount value={-data.current.expense.total} size={14} currency={currency} sign decimals={0} />
            </View>
          </View>
          <View>
            <REyebrow>{t('detected')}</REyebrow>
            <Text style={{
              marginTop: 2,
              fontFamily: fontMono('medium'), fontSize: 14, color: tok.gold,
            }}>
              {data.categoryBreakdown.length}
              <Text style={{ fontSize: 10, color: tok.muted }}>  cat.</Text>
            </Text>
          </View>
        </View>
      </View>

      {/* Seshat insight */}
      <View style={{ marginTop: 14 }}>
        <SeshatInsightCard data={data} currency={currency} />
      </View>

      {/* Recent */}
      {list.length > 0 && (
        <View style={{ marginTop: 14 }}>
          <SectionHeader label={t('recentActivity')} />
          <RCard style={{ marginTop: 8, paddingHorizontal: 18, paddingVertical: 6 }}>
            {list.map((tx, i) => <RTxRow key={tx._id} tx={tx} last={i === list.length - 1} />)}
          </RCard>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Bento (Dashboard C) — canonical default per the production brief
// ─────────────────────────────────────────────────────────────
export function DashboardBento({ data, currency }: { data: DashboardData; currency: string }) {
  const { tok, lang, t } = useI18n();
  const list = data.recentTransactions.slice(0, 3);
  const topCat = data.categoryBreakdown[0];
  const incomeDelta = useMemo(() => {
    if (!data.previous || data.previous.income.total === 0) return null;
    return ((data.current.income.total - data.previous.income.total) / data.previous.income.total) * 100;
  }, [data]);
  const expenseDelta = useMemo(() => {
    if (!data.previous || data.previous.expense.total === 0) return null;
    return ((data.current.expense.total - data.previous.expense.total) / data.previous.expense.total) * 100;
  }, [data]);

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 120 }}>
      {/* Hero net */}
      <RCard large>
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <REyebrow>{t('netBalance')}</REyebrow>
          {/* Hero badge reflects net balance, NOT per-category budget status.
              "Deficit" means expenses exceeded income this month. The
              "over budget" label is reserved for actual per-category caps
              (see the Budgets screen). */}
          {data.current.balance >= 0
            ? <RStatus kind="positive">{t('onTrack')}</RStatus>
            : <RStatus kind="alert">{t('deficit')}</RStatus>}
        </View>
        <View style={{ marginTop: 14 }}>
          <RAmount value={data.current.balance} size={lang === 'ar' ? 38 : 42} currency={currency} decimals={0} />
        </View>
        {/* Sparkbar — 30 days */}
        <View style={{ flexDirection: 'row', gap: 3, alignItems: 'flex-end', height: 32, marginTop: 18 }}>
          {Array.from({ length: 30 }).map((_, i) => {
            const v = 0.3 + Math.abs(Math.sin(i * 0.7 + 1.4)) * 0.7;
            const isToday = i === 27;
            return (
              <View
                key={i}
                style={{
                  flex: 1, height: `${v * 100}%`,
                  backgroundColor: isToday ? tok.gold : tok.borderHi,
                  borderRadius: 1,
                  opacity: isToday ? 1 : 0.5 + (i / 30) * 0.5,
                }}
              />
            );
          })}
        </View>
        <REyebrow style={{ marginTop: 8 }}>30 {lang === 'ar' ? 'يوماً' : 'days'} · {lang === 'ar' ? 'الصافي اليومي' : 'daily net'}</REyebrow>
      </RCard>

      {/* 2-col grid */}
      <View style={{
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        gap: 10, marginTop: 10,
      }}>
        <RCard padding={16} style={{ flex: 1 }}>
          <REyebrow>{t('income')}</REyebrow>
          <View style={{ marginTop: 6 }}>
            <RAmount value={data.current.income.total} short size={20} currency={currency} decimals={0} />
          </View>
          {incomeDelta !== null && (
            <View style={{
              marginTop: 8, flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
              alignItems: 'center', gap: 4,
            }}>
              {incomeDelta >= 0
                ? <ArrowUp size={11} color={tok.posText} strokeWidth={2} />
                : <ArrowDown size={11} color={tok.alertText} strokeWidth={2} />}
              <Text style={{
                color: incomeDelta >= 0 ? tok.posText : tok.alertText,
                fontFamily: fontMono('regular'), fontSize: 10, letterSpacing: 0.6,
              }}>{incomeDelta >= 0 ? '+' : ''}{incomeDelta.toFixed(0)}% mom</Text>
            </View>
          )}
        </RCard>
        <RCard padding={16} style={{ flex: 1 }}>
          <REyebrow>{t('expenses')}</REyebrow>
          <View style={{ marginTop: 6 }}>
            <RAmount value={-data.current.expense.total} short size={20} currency={currency} decimals={0} />
          </View>
          {expenseDelta !== null && (
            <View style={{
              marginTop: 8, flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
              alignItems: 'center', gap: 4,
            }}>
              {expenseDelta >= 0
                ? <ArrowUp size={11} color={tok.alertText} strokeWidth={2} />
                : <ArrowDown size={11} color={tok.posText} strokeWidth={2} />}
              <Text style={{
                color: expenseDelta >= 0 ? tok.alertText : tok.posText,
                fontFamily: fontMono('regular'), fontSize: 10, letterSpacing: 0.6,
              }}>{expenseDelta >= 0 ? '+' : ''}{expenseDelta.toFixed(0)}% mom</Text>
            </View>
          )}
        </RCard>
      </View>

      {/* Top category — wide tile */}
      {topCat && (
        <View style={{ marginTop: 10 }}>
          <RCard padding={16}>
            <View style={{
              flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
              justifyContent: 'space-between', alignItems: 'center',
            }}>
              <View>
                <REyebrow>{t('topCategory')}</REyebrow>
                <Text style={{
                  marginTop: 6,
                  fontFamily: fontHead(lang),
                  fontSize: lang === 'ar' ? 19 : 17, color: tok.bone,
                  textAlign: lang === 'ar' ? 'right' : 'left',
                }}>{catLabel(topCat, lang)}</Text>
              </View>
              <RAmount value={-topCat.total} size={20} currency={currency} decimals={0} />
            </View>
            <View style={{ marginTop: 12 }}>
              <RProgress value={topCat.total} max={topCat.total * 1.3} color={tok.gold} height={3} />
              <View style={{
                flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                justifyContent: 'space-between', marginTop: 5,
              }}>
                <REyebrow>{Math.round(topCat.total / Math.max(data.current.expense.total, 1) * 100)}% of {t('expenses').toLowerCase()}</REyebrow>
                <REyebrow color={tok.warnText}>{t('near')}</REyebrow>
              </View>
            </View>
          </RCard>
        </View>
      )}

      {/* Seshat */}
      <View style={{ marginTop: 14 }}>
        <SeshatInsightCard data={data} currency={currency} />
      </View>

      {/* Recent */}
      {list.length > 0 && (
        <View style={{ marginTop: 14 }}>
          <SectionHeader label={t('recentActivity')} />
          <RCard style={{ marginTop: 8, paddingHorizontal: 18, paddingVertical: 6 }}>
            {list.map((tx, i) => <RTxRow key={tx._id} tx={tx} last={i === list.length - 1} />)}
          </RCard>
        </View>
      )}
    </View>
  );
}
