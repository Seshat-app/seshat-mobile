import { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { useI18n, formatAmount } from '../lib/i18n';
import { fontMono, fontBody } from '../lib/fonts';
import { RAmount } from './ui';

/**
 * Visual blocks rendered beneath a Maat reply (see seshat-api/lib/visualBlocks).
 * Two minimal, glass-on-void surfaces that mirror the dashboard's language so
 * the chat shows what it did rather than only describing it:
 *
 *  - transactions: the entries this turn logged, as compact cards
 *  - summary: a small monthly insight (income / spent / net + a category bar chart)
 *
 * Kept presentation-only and tokenised; the web chat renders the same shapes.
 */

export type TxKind = 'income' | 'expense';
export type VisualTransaction = {
  id: string;
  kind: TxKind;
  amount: number;
  currency: string;
  category: string;
  categoryIcon?: string;
  description?: string;
  date: string;
};
export type CategorySlice = { category: string; total: number };
export type VisualBlock =
  | { type: 'transactions'; items: VisualTransaction[] }
  | {
      type: 'summary';
      period: string;
      currency: string;
      income: number;
      expense: number;
      balance: number;
      topCategories: CategorySlice[];
    };

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
function monthLabel(period: string, lang: string): string {
  const [y, m] = period.split('-').map((n) => parseInt(n, 10));
  const names = lang === 'ar' ? MONTHS_AR : MONTHS_EN;
  const name = names[(m - 1)] ?? '';
  return `${name} ${y || ''}`.trim();
}

export function ChatBlocks({ blocks }: { blocks?: VisualBlock[] }) {
  if (!blocks || blocks.length === 0) return null;
  return (
    <FadeIn>
      <View style={{ gap: 8 }}>
        {blocks.map((b, i) =>
          b.type === 'transactions'
            ? <TransactionsBlockView key={`tx-${i}`} items={b.items} />
            : <SummaryBlockView key={`sum-${i}`} block={b} />,
        )}
      </View>
    </FadeIn>
  );
}

// Gentle mount reveal - the blocks rise + fade in once typing has finished.
function FadeIn({ children }: { children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 360, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

// ── Transactions: compact cards for the entries this turn logged ────────────
function TransactionsBlockView({ items }: { items: VisualTransaction[] }) {
  const { tok, lang } = useI18n();
  const rowDir = lang === 'ar' ? 'row-reverse' : 'row';
  return (
    <View style={{
      backgroundColor: tok.coreBg,
      borderRadius: 14,
      borderWidth: 1, borderColor: tok.shellBorder, borderTopColor: tok.coreSheen,
      overflow: 'hidden',
    }}>
      {/* header */}
      <View style={{
        flexDirection: rowDir, alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingTop: 11, paddingBottom: 9,
      }}>
        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: tok.gold }} />
        <Text style={{
          fontFamily: fontMono('regular'), fontSize: 9.5, letterSpacing: 1.6,
          color: tok.gold, textTransform: 'uppercase',
        }}>
          {lang === 'ar'
            ? `سُجّلت · ${items.length}`
            : `Logged · ${items.length}`}
        </Text>
      </View>
      {items.map((t, i) => (
        <View
          key={t.id}
          style={{
            flexDirection: rowDir, alignItems: 'center', gap: 11,
            paddingHorizontal: 14, paddingVertical: 11,
            borderTopWidth: 1, borderTopColor: tok.shellBorder,
          }}
        >
          <View style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: tok.glowShellBg,
            borderWidth: 1, borderColor: tok.glowShellBorder,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 15 }}>{t.categoryIcon || '•'}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fontBody(lang), fontSize: 14, color: tok.bone,
                textAlign: lang === 'ar' ? 'right' : 'left',
              }}
            >
              {t.category}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: fontMono('regular'), fontSize: 10.5, color: tok.muted,
                marginTop: 2, letterSpacing: 0.3,
                textAlign: lang === 'ar' ? 'right' : 'left',
              }}
            >
              {t.description ? `${t.description} · ${t.date}` : t.date}
            </Text>
          </View>
          <RAmount
            value={t.kind === 'expense' ? -t.amount : t.amount}
            currency={t.currency}
            size={15}
            sign
            decimals={0}
            weight="medium"
          />
        </View>
      ))}
    </View>
  );
}

// ── Summary: a small monthly insight + category bar chart ───────────────────
function SummaryBlockView({ block }: { block: Extract<VisualBlock, { type: 'summary' }> }) {
  const { tok, lang } = useI18n();
  const cats = (block.topCategories ?? []).filter((c) => c.total > 0).slice(0, 5);
  const max = Math.max(1, ...cats.map((c) => c.total));
  const rowDir = lang === 'ar' ? 'row-reverse' : 'row';
  const align: 'right' | 'left' = lang === 'ar' ? 'right' : 'left';

  return (
    <View style={{
      backgroundColor: tok.glowShellBg,
      borderRadius: 14,
      borderWidth: 1, borderColor: tok.glowShellBorder, borderTopColor: tok.glowCoreSheen,
      paddingHorizontal: 14, paddingVertical: 13,
    }}>
      {/* header */}
      <Text style={{
        fontFamily: fontMono('regular'), fontSize: 9.5, letterSpacing: 1.6,
        color: tok.gold, textTransform: 'uppercase', textAlign: align,
      }}>
        {monthLabel(block.period, lang)} · {lang === 'ar' ? 'ملخص' : 'Summary'}
      </Text>

      {/* hero: net balance */}
      <View style={{ marginTop: 9, alignItems: lang === 'ar' ? 'flex-end' : 'flex-start' }}>
        <RAmount value={block.balance} currency={block.currency} size={30} sign decimals={0} />
      </View>

      {/* income / spent */}
      <View style={{ flexDirection: rowDir, gap: 18, marginTop: 8 }}>
        <Stat label={lang === 'ar' ? 'الدخل' : 'Income'} value={block.income} color={tok.posText} align={align} />
        <Stat label={lang === 'ar' ? 'المصروف' : 'Spent'} value={block.expense} color={tok.alertText} align={align} />
      </View>

      {cats.length > 0 && (
        <View style={{
          marginTop: 13, paddingTop: 13,
          borderTopWidth: 1, borderTopColor: tok.glowShellBorder,
          gap: 9,
        }}>
          {cats.map((c) => (
            <View key={c.category}>
              <View style={{ flexDirection: rowDir, justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <Text numberOfLines={1} style={{
                  flex: 1, fontFamily: fontBody(lang), fontSize: 12.5, color: tok.bone, textAlign: align,
                }}>
                  {c.category}
                </Text>
                <Text style={{
                  fontFamily: fontMono('regular'), fontSize: 11.5, color: tok.muted,
                  marginLeft: lang === 'ar' ? 0 : 8, marginRight: lang === 'ar' ? 8 : 0,
                  writingDirection: 'ltr',
                }}>
                  {formatAmount(c.total, { decimals: 0, short: true })}
                </Text>
              </View>
              <View style={{
                height: 6, borderRadius: 3, backgroundColor: tok.shellBg, overflow: 'hidden',
                flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
              }}>
                <View style={{
                  width: `${Math.max(6, (c.total / max) * 100)}%`,
                  backgroundColor: tok.gold, borderRadius: 3,
                }} />
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Stat({ label, value, color, align }: { label: string; value: number; color: string; align: 'right' | 'left' }) {
  const { tok } = useI18n();
  return (
    <View>
      <Text style={{
        fontFamily: fontMono('regular'), fontSize: 9, letterSpacing: 1.2,
        color: tok.muted, textTransform: 'uppercase', textAlign: align,
      }}>
        {label}
      </Text>
      <Text style={{
        fontFamily: fontMono('medium'), fontSize: 14, color, marginTop: 2,
        textAlign: align, writingDirection: 'ltr',
      }}>
        {formatAmount(value, { decimals: 0, short: true })}
      </Text>
    </View>
  );
}
