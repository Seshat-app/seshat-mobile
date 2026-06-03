import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ViewStyle, TextStyle, Animated, ScrollView, ActivityIndicator, TextInput,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { X } from 'lucide-react-native';
import { useI18n, formatAmount, currencyLabel } from '../lib/i18n';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { radius } from '../lib/theme';
import { Glass } from './Glass';

// Soft top-down reflection painted inside a card's core. Replaces the old
// hard `borderTopColor` hairline — gold on focal/glow cards, a faint white
// highlight elsewhere — so the plate reads as glass catching light, not an
// edge. Static gradient (no repaint on scroll) so it's cheap per card.
function CardSheen({ glow }: { glow?: boolean }) {
  const { tok, mode } = useI18n();
  const gid = 'sheen-' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const base = glow ? tok.goldLight : '#FFFFFF';
  const peak = glow ? 0.1 : mode === 'light' ? 0.38 : 0.045;
  return (
    <Svg pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 72 }}>
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={base} stopOpacity={peak} />
          <Stop offset="1" stopColor={base} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gid})`} />
    </Svg>
  );
}

// Keys that describe where/how big a card sits in its parent. These belong on
// the OUTER shell so margins push the whole card and `flex: 1` stretches it.
// Everything else (padding, border overrides, background) stays on the INNER
// core, so existing call sites like `padding={0} style={{ paddingHorizontal: 16 }}`
// keep insetting their rows from the visible plate, not the bezel.
const SHELL_STYLE_KEYS = new Set([
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'marginHorizontal', 'marginVertical', 'marginStart', 'marginEnd',
  'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf',
  'width', 'minWidth', 'maxWidth', 'position', 'top', 'right', 'bottom', 'left',
  'zIndex', 'start', 'end',
]);

function splitCardStyle(style?: ViewStyle | ViewStyle[]): { shell: ViewStyle; core: ViewStyle } {
  const flat: ViewStyle = Array.isArray(style)
    ? Object.assign({}, ...style.filter(Boolean))
    : (style ?? {});
  const shell: ViewStyle = {};
  const core: ViewStyle = {};
  for (const k of Object.keys(flat) as Array<keyof ViewStyle>) {
    if (SHELL_STYLE_KEYS.has(k as string)) (shell as any)[k] = (flat as any)[k];
    else (core as any)[k] = (flat as any)[k];
  }
  return { shell, core };
}

// ─────────────────────────────────────────────────────────────
// Card — the "golden shield" double-bezel: an outer shell tray wraps an
// inner core plate (a glass plate seated in a machined frame). Depth comes
// from the bezel + lit top edge + the screen atmosphere, NOT from runtime
// backdrop-blur (a perf foot-gun on scrolling RN lists). `glow` is the
// gold-tinted focal variant for hero/insight cards.
//
// API-preserving: `padding`/`large` set the core padding; `style` is split so
// layout keys (margin/flex/width/position) drive the shell and content keys
// (padding/border/bg) drive the core. All existing call sites keep working.
// ─────────────────────────────────────────────────────────────
export function RCard({
  children, style, large, accent, padding, glow,
}: { children: ReactNode; style?: ViewStyle | ViewStyle[]; large?: boolean; accent?: boolean; padding?: number; glow?: boolean }) {
  const { tok, dir, mode } = useI18n();
  const corePad = padding !== undefined
    ? { padding }
    : large
      ? { padding: 24 }
      // Design RCard small default: '20px 22px' = 20 vertical, 22 horizontal.
      : { paddingVertical: 20, paddingHorizontal: 22 };

  const { shell, core } = splitCardStyle(style);
  // The "golden shield" double-bezel: an outer shell tray wraps the inner core
  // plate on every card. Glow cards get the gold-tinted, lit version.
  const bezel = 4;
  const outerRadius = large ? 26 : 22;
  const innerRadius = Math.max(0, outerRadius - bezel);
  const accentRail: ViewStyle | null = accent
    ? (dir === 'rtl'
        ? { borderRightWidth: 2, borderRightColor: tok.gold }
        : { borderLeftWidth: 2, borderLeftColor: tok.gold })
    : null;

  return (
    <View
      style={[
        {
          padding: bezel,
          borderRadius: outerRadius,
          backgroundColor: glow ? tok.glowShellBg : tok.shellBg,
          borderWidth: 1,
          borderColor: glow ? tok.glowShellBorder : tok.shellBorder,
        },
        // Gold glow lifts focal cards off the void — kept soft and faint.
        glow && {
          shadowColor: tok.glowShadow,
          shadowOpacity: 0.12,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 3,
        },
        shell,
      ]}
    >
      <Glass
        variant="frost"
        radius={innerRadius}
        fallbackColor={tok.coreBg}
        dark={mode !== 'light'}
        intensity={glow ? 48 : 32}
        style={[corePad, ...(accentRail ? [accentRail] : []), core]}
      >
        <CardSheen glow={glow} />
        {children}
      </Glass>
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
  active, onPress, children, style, icon,
}: { active?: boolean; onPress?: () => void; children: ReactNode; style?: ViewStyle; icon?: ReactNode }) {
  const { tok, lang } = useI18n();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          alignItems: 'center', gap: 6,
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
      {icon}
      <Text
        style={{
          color: active ? tok.void : tok.bone,
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
// Field — the canonical double-bezel glass text input. An outer shell
// (gold-tinted + soft glow on focus) wraps a coreBg inner input, matching
// the auth fields. Replaces flat tok.surface/elevated inputs across the app;
// AuthField delegates to this.
// ─────────────────────────────────────────────────────────────
export function RField({
  value, onChange, placeholder, label, secondary, secureTextEntry, keyboardType,
  autoFocus, autoComplete, textContentType, autoCapitalize, multiline, maxLength,
  minHeight, mono, ltr, onSubmitEditing, returnKeyType, style,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: ReactNode;
  secondary?: ReactNode;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'decimal-pad' | 'numeric';
  autoFocus?: boolean;
  autoComplete?: any;
  textContentType?: any;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  maxLength?: number;
  minHeight?: number;
  /** Force DM Mono (amounts, codes). */
  mono?: boolean;
  /** Force LTR + left align (emails, numbers). Defaults true for numeric/email keyboards. */
  ltr?: boolean;
  onSubmitEditing?: () => void;
  returnKeyType?: 'done' | 'next' | 'go' | 'send';
  style?: ViewStyle;
}) {
  const { tok, lang } = useI18n();
  const [focused, setFocused] = useState(false);
  const forceLtr = ltr ?? (keyboardType === 'email-address' || keyboardType === 'number-pad' || keyboardType === 'decimal-pad' || keyboardType === 'numeric');
  return (
    <View style={style}>
      {(label || secondary) ? (
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 8,
        }}>
          {typeof label === 'string' ? <REyebrow style={{ flexShrink: 1 }}>{label}</REyebrow> : label}
          {secondary}
        </View>
      ) : null}
      <View style={{
        padding: 4, borderRadius: 16,
        backgroundColor: focused ? tok.glowShellBg : tok.shellBg,
        borderWidth: 1, borderColor: focused ? tok.glowShellBorder : tok.shellBorder,
        shadowColor: focused ? tok.glowShadow : 'transparent',
        shadowOpacity: focused ? 0.2 : 0, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
      }}>
        {/* Inner core = the same frosted glass + top sheen the cards use, so a
            field reads as a miniature golden-shield plate rather than a flat box. */}
        {/* Shield + top sheen, but NO live blur behind the input. A BlurView
            that relayouts as the keyboard opens drops the TextInput's first
            responder on iOS (keyboard opens then closes), so the field uses a
            translucent core plate instead - same golden-shield read, no
            keyboard breakage. The cards keep their real blur (no inputs). */}
        <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: tok.coreBg }}>
          <CardSheen />
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor={tok.muted}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType ?? 'default'}
            autoCapitalize={autoCapitalize ?? 'none'}
            autoCorrect={false}
            autoFocus={autoFocus}
            autoComplete={autoComplete}
            textContentType={textContentType}
            multiline={multiline}
            maxLength={maxLength}
            onSubmitEditing={onSubmitEditing}
            returnKeyType={returnKeyType}
            textAlignVertical={multiline ? 'top' : undefined}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              backgroundColor: 'transparent',
              paddingHorizontal: 16, paddingVertical: 14,
              minHeight: multiline ? (minHeight ?? 120) : undefined,
              color: tok.bone,
              fontFamily: mono ? fontMono('regular') : fontBody(lang),
              fontSize: 15,
              writingDirection: forceLtr ? 'ltr' : (lang === 'ar' ? 'rtl' : 'ltr'),
              textAlign: forceLtr ? 'left' : (lang === 'ar' ? 'right' : 'left'),
            }}
          />
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Chip — a small gold-tinted tag. With onRemove it gets a trailing ×
// (the dismissible active-filter chip); otherwise a static/selectable tag.
// ─────────────────────────────────────────────────────────────
export function RChip({
  label, onRemove, onPress, icon,
}: { label: string; onRemove?: () => void; onPress?: () => void; icon?: ReactNode }) {
  const { tok, lang } = useI18n();
  const body = (
    <View style={{
      flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
      alignItems: 'center', gap: 6,
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
      backgroundColor: tok.glowShellBg,
      borderWidth: 1, borderColor: tok.glowShellBorder,
    }}>
      {icon}
      <Text style={{
        color: tok.gold, fontFamily: fontMono('regular'), fontSize: 11, letterSpacing: 0.6,
      }}>{label}</Text>
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={8}><X size={12} color={tok.gold} strokeWidth={2.4} /></Pressable>
      ) : null}
    </View>
  );
  if (onPress) return <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>{body}</Pressable>;
  return body;
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
              color: a ? tok.void : tok.bone,
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
  const map: Record<string, [string, string, string]> = {
    positive: [tok.posBg, tok.posText, 'rgba(74,186,122,0.3)'],
    alert:    [tok.alertBg, tok.alertText, 'rgba(224,85,85,0.3)'],
    warning:  [tok.warnBg, tok.warnText, 'rgba(224,160,48,0.3)'],
    info:     [tok.infoBg, tok.infoText, 'rgba(74,138,202,0.3)'],
    draft:    [tok.elevated, tok.muted, tok.border],
  };
  const [bg, fg, border] = map[kind];
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: bg, borderRadius: 999,
      paddingHorizontal: 10, paddingVertical: 4,
      borderWidth: 1, borderColor: border,
      alignSelf: 'flex-start',
    }}>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: fg }} />
      <Text style={{
        color: fg, fontFamily: fontMono('regular'), fontSize: 9,
        letterSpacing: 1.4, textTransform: 'uppercase',
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
  variant = 'primary', onPress, children, full, icon, disabled, loading, style,
}: {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'danger';
  onPress?: () => void;
  children: ReactNode;
  full?: boolean;
  icon?: ReactNode;
  disabled?: boolean;
  /** Shows a spinner and blocks taps while an async action is in flight. */
  loading?: boolean;
  style?: ViewStyle;
}) {
  const { tok, lang } = useI18n();
  const base: ViewStyle = {
    // Full-width buttons use a pill shape (999) — more premium, consistent with
    // the website's CTA language. Inline buttons stay with a softer square radius.
    borderRadius: full ? 999 : radius.btn,
    paddingVertical: full ? 15 : 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: full ? 'stretch' : 'flex-start',
  };
  // fg defaults to the on-gold colour (tok.void): near-black on bright gold in
  // dark mode, near-white on deep gold in light mode — correct in both.
  let bg = tok.gold, fg: string = tok.void, border: ViewStyle = {};
  if (variant === 'secondary') { bg = 'transparent'; fg = tok.bone; border = { borderWidth: 1, borderColor: tok.borderHi }; }
  if (variant === 'ghost') { bg = 'transparent'; fg = tok.muted; }
  // 'destructive' = quiet ghost (e.g. Sign out). 'danger' = filled red pill for
  // genuinely destructive confirmations (delete account, leave org).
  if (variant === 'destructive') { bg = 'transparent'; fg = tok.alertText; }
  if (variant === 'danger') { bg = tok.alertText; fg = '#FFFFFF'; }
  const blocked = disabled || loading;
  return (
    <Pressable
      onPress={blocked ? undefined : onPress}
      disabled={blocked}
      style={({ pressed }) => [
        base, border, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.9 : 1 }, style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : icon}
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
        borderRadius: radius.card, padding: 14,
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
