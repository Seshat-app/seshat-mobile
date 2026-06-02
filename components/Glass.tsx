import { ReactNode } from 'react';
import { View, ViewStyle, StyleSheet, Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────
// Glass — one wrapper, three tiers of material, chosen at runtime:
//
//   1. iOS 26 Liquid Glass  (expo-glass-effect GlassView)   — variant="liquid"
//   2. Frosted blur         (expo-blur BlurView)            — the default
//   3. Translucent fallback (plain tinted View)             — old binary / no native module
//
// The native modules are required defensively: on a binary built BEFORE
// `expo prebuild` linked them, the blur/glass simply render nothing and the
// `fallbackColor` tint shows through — no crash. After the rebuild the real
// material appears with no JS change.
// ─────────────────────────────────────────────────────────────

let GlassView: any = null;
let liquidAvailable = false;
let BlurView: any = null;

try {
  const g = require('expo-glass-effect');
  GlassView = g.GlassView;
  try { liquidAvailable = !!g.isLiquidGlassAvailable(); } catch { liquidAvailable = false; }
} catch { /* module not in this binary */ }

try {
  BlurView = require('expo-blur').BlurView;
} catch { /* module not in this binary */ }

export function isGlassActive() {
  return liquidAvailable || !!BlurView;
}

export function Glass({
  children, style, radius = 0, intensity = 40, dark = true, fallbackColor,
  variant = 'frost', tintColor,
}: {
  children?: ReactNode;
  style?: ViewStyle | ViewStyle[];
  radius?: number;
  intensity?: number;
  /** Dark glass (over the void) vs light glass (parchment mode). */
  dark?: boolean;
  /** Tint shown when no native blur/glass is available (and seen faintly under it). */
  fallbackColor: string;
  /** 'liquid' prefers iOS 26 Liquid Glass (best for bars/controls); 'frost' is
   *  frosted blur (best for content cards, matches the web). Both fall back. */
  variant?: 'liquid' | 'frost';
  /** Optional tint for Liquid Glass. */
  tintColor?: string;
}) {
  const useLiquid = variant === 'liquid' && liquidAvailable && GlassView;
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden', backgroundColor: fallbackColor }, style]}>
      {useLiquid ? (
        <GlassView
          style={StyleSheet.absoluteFill}
          glassEffectStyle="regular"
          tintColor={tintColor}
        />
      ) : BlurView ? (
        <BlurView
          style={StyleSheet.absoluteFill}
          intensity={intensity}
          tint={dark ? 'systemThinMaterialDark' : 'systemThinMaterialLight'}
          experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
        />
      ) : null}
      {children}
    </View>
  );
}
