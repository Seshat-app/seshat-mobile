import { View, StyleSheet, ViewStyle } from 'react-native';
import { Glass } from './Glass';

// iOS 26+ Liquid Glass surface to place as the FIRST child of a pill / round button
// (the parent keeps its size, shape and press handling). On older iOS / Android it
// falls back to `fallback`, so call sites keep their usual look there.
export function LiquidBackdrop({
  radius, tint, fallback, dark = true,
}: { radius: number; tint?: string; fallback: string; dark?: boolean }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Glass
        variant="liquid"
        style={StyleSheet.absoluteFill as ViewStyle}
        radius={radius}
        dark={dark}
        tintColor={tint}
        fallbackColor={fallback}
      />
    </View>
  );
}
