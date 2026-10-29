import { ReactNode } from 'react';
import { View, ViewStyle, StyleSheet, Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────
// Glass — one wrapper, three tiers, chosen at runtime:
//
//   1. iOS 26 Liquid Glass  (expo-glass-effect GlassView)   variant="liquid"
//   2. Frosted blur         (expo-blur BlurView)            variant="frost" (default)
//   3. Translucent fallback (plain tinted View)             always safe
//
// Native modules are probed by calling requireNativeViewManager at init —
// this is what actually throws when a module isn't linked in the current
// binary. If it throws, we mark the module as unavailable and the component
// renders the fallback color with no crash, even on an un-rebuilt binary.
// After the dev-client rebuild the probe passes and the real material shows.
// ─────────────────────────────────────────────────────────────

let BlurView: any = null;
let GlassView: any = null;
let liquidAvailable = false;

try {
  const { requireNativeViewManager } = require('expo-modules-core');
  // This call throws if ExpoBlurView is not registered in this binary.
  requireNativeViewManager('ExpoBlurView');
  BlurView = require('expo-blur').BlurView;
} catch {
  BlurView = null;
}

try {
  const { requireNativeViewManager } = require('expo-modules-core');
  requireNativeViewManager('ExpoGlassEffect', 'GlassView');
  const g = require('expo-glass-effect');
  GlassView = g.GlassView;
  try { liquidAvailable = !!g.isLiquidGlassAvailable(); } catch { liquidAvailable = false; }
} catch {
  GlassView = null;
  liquidAvailable = false;
}

/** True when real iOS Liquid Glass is available (iOS 26+ with the native module). */
export function isLiquid() {
  return liquidAvailable && !!GlassView;
}

export function isGlassActive() {
  return liquidAvailable || !!BlurView;
}

export function Glass({
  children,
  style,
  radius = 0,
  intensity = 40,
  dark = true,
  fallbackColor,
  variant = 'frost',
  tintColor,
  material,
}: {
  children?: ReactNode;
  style?: ViewStyle | ViewStyle[];
  radius?: number;
  intensity?: number;
  dark?: boolean;
  /** Color shown when no native blur/glass is available — also shows faintly
   *  through the blur on devices that support it. Make it semi-transparent so
   *  the atmosphere bleeds through even before the rebuild. */
  fallbackColor: string;
  variant?: 'liquid' | 'frost';
  tintColor?: string;
  /** Override the iOS blur material (e.g. an ultra-thin one for a header
   *  that should read as the page itself, just blurred). */
  material?: string;
}) {
  const useLiquid = variant === 'liquid' && liquidAvailable && GlassView;
  const useFrost = !useLiquid && !!BlurView;

  return (
    <View
      style={[
        { borderRadius: radius, overflow: 'hidden', backgroundColor: useLiquid ? 'transparent' : fallbackColor },
        style,
      ]}
    >
      {useLiquid ? (
        <GlassView
          style={StyleSheet.absoluteFill}
          glassEffectStyle="regular"
          colorScheme={dark ? 'dark' : 'light'}
          tintColor={tintColor}
        />
      ) : useFrost ? (
        <BlurView
          style={StyleSheet.absoluteFill}
          intensity={intensity}
          tint={(material ?? (dark ? 'systemThinMaterialDark' : 'systemThinMaterialLight')) as any}
          experimentalBlurMethod={
            Platform.OS === 'android' ? 'dimezisBlurView' : undefined
          }
        />
      ) : null}
      {children}
    </View>
  );
}
