import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useI18n } from '../lib/i18n';

// ─────────────────────────────────────────────────────────────
// ScreenAtmosphere — a clean, even backdrop. No radial "blobs": just a
// single, very soft top-down warmth that fades to the void, so screens
// have a hint of depth without gradient balls. One cheap gradient node,
// memoized. Drop it as the first child of a screen's root view, above the
// void background colour but below the content.
// ─────────────────────────────────────────────────────────────
export const ScreenAtmosphere = memo(function ScreenAtmosphere() {
  const { tok, mode } = useI18n();
  // Whisper of warmth at the very top, gone by ~40% down. Light mode stays flat.
  const warm = mode === 'light' ? 0.0 : 0.06;
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="atm-wash" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={tok.gold} stopOpacity={warm} />
          <Stop offset="0.4" stopColor={tok.gold} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#atm-wash)" />
    </Svg>
  );
});

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
