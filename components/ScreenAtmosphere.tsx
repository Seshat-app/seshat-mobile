import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useI18n } from '../lib/i18n';

// ─────────────────────────────────────────────────────────────
// ScreenAtmosphere — the lit gold-on-void backdrop shared by every
// screen. Soft gold radial washes (top, upper-trailing, bottom) give
// the same depth as the marketing web, instead of a flat black sheet.
//
// Pure SVG (react-native-svg is already in the binary) so it hot-reloads
// with no dev-client rebuild, and it's a single cheap node per screen —
// no per-card blur. Drop it as the first child of a screen's root view,
// above the void background colour but below the content.
// ─────────────────────────────────────────────────────────────
export function ScreenAtmosphere() {
  const { tok, mode } = useI18n();
  const gold = tok.gold;
  // Light mode (parchment) needs a much gentler wash or it muddies; dark
  // mode can carry a stronger glow.
  const top = mode === 'light' ? 0.07 : 0.14;
  const side = mode === 'light' ? 0.03 : 0.05;
  const bottom = mode === 'light' ? 0.03 : 0.06;
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="atm-top" cx="0.5" cy="0" r="0.72">
          <Stop offset="0" stopColor={gold} stopOpacity={top} />
          <Stop offset="0.6" stopColor={gold} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="atm-side" cx="0.88" cy="0.2" r="0.5">
          <Stop offset="0" stopColor={gold} stopOpacity={side} />
          <Stop offset="0.7" stopColor={gold} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="atm-bottom" cx="0.5" cy="1.05" r="0.6">
          <Stop offset="0" stopColor={gold} stopOpacity={bottom} />
          <Stop offset="0.6" stopColor={gold} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#atm-top)" />
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#atm-side)" />
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#atm-bottom)" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────
// ScrollEdgeFade — a void→transparent gradient pinned to the top of a
// scroll region so content dissolves softly as it scrolls up under the
// header, instead of clipping on a hard edge. Drop it as an absolute
// sibling above the ScrollView.
// ─────────────────────────────────────────────────────────────
export function ScrollEdgeFade({ height = 28 }: { height?: number }) {
  const { tok } = useI18n();
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height, zIndex: 2 }}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="scroll-edge-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={tok.void} stopOpacity={1} />
            <Stop offset="1" stopColor={tok.void} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#scroll-edge-fade)" />
      </Svg>
    </View>
  );
}
