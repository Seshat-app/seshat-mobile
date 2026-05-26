import { ReactNode, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, ViewStyle, TextStyle, Animated, ScrollView,
} from 'react-native';
import { useI18n, formatAmount, currencyLabel } from '../lib/i18n';
import { fontBody, fontHead, fontMono } from '../lib/fonts';

// ─────────────────────────────────────────────────────────────
// Card — surface with hair-line border, 12/16 radius. No shadows.
// ─────────────────────────────────────────────────────────────
export function RCard({
  children, style, large, accent, padding,
}: { children: ReactNode; style?: ViewStyle | ViewStyle[]; large?: boolean; accent?: boolean; padding?: number }) {
  const { tok, dir } = useI18n();
  const sizing = padding !== undefined
    ? { padding }
    : large
      ? { padding: 24 }
      // Design RCard small default: '20px 22px' = 20 vertical, 22 horizontal.
      : { paddingVertical: 20, paddingHorizontal: 22 };
  return (
    <View
      style={[
        {
          backgroundColor: tok.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: tok.border,
          borderRadius: large ? 16 : 12,
        },
        sizing,
        accent && (dir === 'rtl'
          ? { borderRightWidth: 2, borderRightColor: tok.gold }
          : { borderLeftWidth: 2, borderLeftColor: tok.gold }),
        style as any,
      ]}
    >
      {children}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Eyebrow — DM Mono uppercase label, the small all-caps text
// scattered around the design as section/metadata headers.
// ─────────────────────────────────────────────────────────────
export function REyebrow({
  children, color, size = 10, style,
}: { children: ReactNode; color?: string; size?: number; style?: TextStyle }) {
  const { tok, lang } = useI18n();
  // Design uses CSS em-relative letter-spacing (0.14em for EN, 0.04em for AR).
  // React Native's letterSpacing is in absolute points, so we multiply by size
  // so a size=12 eyebrow doesn't have the same px-spacing as size=10.
  const letterSpacing = (lang === 'ar' ? 0.04 : 0.14) * size;
  return (
    <Text
      style={[
        {
          fontFamily: fontMono('regular'),
          fontSize: size,
          letterSpacing,
          textTransform: lang === 'ar' ? 'none' : 'uppercase',
          color: color ?? tok.muted,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ─────────────────────────────────────────────────────────────
// Amount — DM Mono, always LTR, optional sign + short formatting.
// `value` is signed (negative = expense).
// ─────────────────────────────────────────────────────────────
export function RAmount({
  value, currency = 'EGP', size = 32, color, sign = false, decimals = 2, short = false, weight = 'medium', style,
}: {
  value: number;
  currency?: string;
  size?: number;
  color?: string;
  sign?: boolean;
  decimals?: number;
  short?: boolean;
  weight?: 'light' | 'regular' | 'medium';
  style?: TextStyle;
}) {
  const { tok, lang } = useI18n();
  const isPos = value > 0, isNeg = value < 0;
  const c = color ?? (sign ? (isPos ? tok.posText : isNeg ? tok.alertText : tok.bone) : tok.bone);
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'baseline' }, style as any]}>
      <Text
        style={{
          fontFamily: fontMono(weight),
          fontSize: size,
          letterSpacing: -0.2,
          color: c,
          writingDirection: 'ltr',
        }}
      >
        {formatAmount(value, { sign, decimals, short })}
      </Text>
      <Text
        style={{
          fontFamily: fontMono('regular'),
          fontSize: size * 0.45,
          color: tok.muted,
          marginLeft: size * 0.2,
          writingDirection: 'ltr',
        }}
      >
        {currencyLabel(currency, lang)}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Pill — rounded button, active = gold fill, inactive = bordered
// ─────────────────────────────────────────────────────────────
export function RPill({
  active, onPress, children, style,
}: { active?: boolean; onPress?: () => void; children: ReactNode; style?: ViewStyle }) {
  const { tok, lang } = useI18n();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: active ? tok.gold : 'transparent',
          borderColor: active ? 'transparent' : tok.border,
          borderWidth: active ? 0 : 1,
          borderRadius: 999,
          paddingHorizontal: 14,
          paddingVertical: 8,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: active ? '#0D0D0D' : tok.bone,
          fontFamily: fontBody(lang, 'semibold'),
          fontSize: 13,
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// Segmented — 2-3 inline pills sharing a track.
// ─────────────────────────────────────────────────────────────
export function RSegmented<T extends string>({
  value, options, onChange,
}: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }) {
  const { tok, lang } = useI18n();
  return (
    <View style={{
      flexDirection: 'row', backgroundColor: tok.elevated,
      borderRadius: 10, padding: 3, gap: 2, alignSelf: 'center',
    }}>
      {options.map((o) => {
        const a = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => ({
              backgroundColor: a ? tok.gold : 'transparent',
              borderRadius: 8,
              paddingHorizontal: 16,
              paddingVertical: 8,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{
              color: a ? '#0D0D0D' : tok.bone,
              fontFamily: fontBody(lang, 'semibold'),
              fontSize: 13,
            }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Status badge — colored pill for tx status / categories
// ─────────────────────────────────────────────────────────────
export function RStatus({
  kind = 'positive', children,
}: { kind?: 'positive' | 'alert' | 'warning' | 'info' | 'draft'; children: ReactNode }) {
  const { tok } = useI18n();
  const map = {
    positive: [tok.posBg, tok.posText],
    alert: [tok.alertBg, tok.alertText],
    warning: [tok.warnBg, tok.warnText],
    info: [tok.infoBg, tok.infoText],
    draft: [tok.elevated, tok.muted],
  } as const;
  const [bg, fg] = map[kind];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{
        color: fg, fontFamily: fontMono('regular'), fontSize: 9.5,
        letterSpacing: 1.2, textTransform: 'uppercase',
      }}>{children}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Progress — slim 3-4px bar; the brand bans corner radius > 2px
// ─────────────────────────────────────────────────────────────
export function RProgress({
  value, max = 100, color, height = 4, bgColor,
}: { value: number; max?: number; color?: string; height?: number; bgColor?: string }) {
  const { tok } = useI18n();
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <View style={{
      width: '100%', height,
      backgroundColor: bgColor ?? tok.elevated,
      borderRadius: 2, overflow: 'hidden',
    }}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color ?? tok.gold, borderRadius: 2 }} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Button — primary (gold), secondary (bordered), ghost
// ─────────────────────────────────────────────────────────────
export function RButton({
  variant = 'primary', onPress, children, full, icon, disabled, style,
}: {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  onPress?: () => void;
  children: ReactNode;
  full?: boolean;
  icon?: ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const { tok, lang } = useI18n();
  const base: ViewStyle = {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: full ? 'stretch' : 'flex-start',
  };
  let bg = tok.gold, fg: string = '#0D0D0D', border: ViewStyle = {};
  if (variant === 'secondary') { bg = 'transparent'; fg = tok.bone; border = { borderWidth: 1, borderColor: tok.borderHi }; }
  if (variant === 'ghost') { bg = 'transparent'; fg = tok.muted; }
  if (variant === 'destructive') { bg = 'transparent'; fg = tok.alertText; }
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        base, border, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.9 : 1 }, style,
      ]}
    >
      {icon}
      <Text style={{
        color: fg,
        fontFamily: fontBody(lang, 'semibold'),
        fontSize: 14,
      }}>{children}</Text>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// Toast — slides up from bottom, gold-accent
// ─────────────────────────────────────────────────────────────
export function RToast({ visible, children, bottomOffset = 110 }: { visible: boolean; children: ReactNode; bottomOffset?: number }) {
  const { tok, lang } = useI18n();
  const translate = useRef(new Animated.Value(visible ? 0 : 140)).current;
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translate, { toValue: visible ? 0 : 140, duration: 260, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={{
        position: 'absolute', bottom: bottomOffset, left: 20, right: 20,
        backgroundColor: tok.elevated,
        borderRadius: 12, padding: 14,
        borderWidth: StyleSheet.hairlineWidth, borderColor: tok.gold,
        borderLeftWidth: 3, borderLeftColor: tok.gold,
        flexDirection: 'row', alignItems: 'center', gap: 10,
        transform: [{ translateY: translate }], opacity,
        zIndex: 200,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tok.gold }} />
      <Text style={{ flex: 1, color: tok.bone, fontFamily: fontBody(lang), fontSize: 13 }}>{children}</Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// HScroll — borderless horizontal scroller
// ─────────────────────────────────────────────────────────────
// Caller must constrain the ScrollView height — when this scroller sits in a
// `flex: 1` column, RN otherwise lets it stretch to fill remaining vertical
// space and the row of pills inside ends up ~600px tall.
export function RHScroll({ children, style, contentStyle }: { children: ReactNode; style?: ViewStyle; contentStyle?: ViewStyle }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[{ flexGrow: 0, flexShrink: 0 }, style as any]}
      contentContainerStyle={[{ gap: 8, alignItems: 'center' }, contentStyle as any]}
    >
      {children}
    </ScrollView>
  );
}
