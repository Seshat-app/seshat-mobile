import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle } from 'react-native';
import { useI18n } from '../lib/i18n';

// ─────────────────────────────────────────────────────────────
// Skeleton — a shimmering placeholder block. Use it while data
// loads instead of an empty input/placeholder so the user sees
// motion instead of stale-looking dummy text.
// ─────────────────────────────────────────────────────────────
export function Skeleton({
  width = '100%', height = 16, radius = 6, style,
}: { width?: number | string; height?: number; radius?: number; style?: ViewStyle }) {
  const { tok } = useI18n();
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius: radius,
          backgroundColor: tok.elevated,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}

// Convenience grid for a card-like placeholder
export function SkeletonCard({ height = 120, style }: { height?: number; style?: ViewStyle }) {
  const { tok } = useI18n();
  return (
    <View
      style={[
        {
          backgroundColor: tok.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: tok.border,
          borderRadius: 12,
          padding: 20,
          height,
          justifyContent: 'space-between',
        },
        style,
      ]}
    >
      <Skeleton width={90} height={10} />
      <Skeleton width="60%" height={28} />
      <Skeleton width="40%" height={10} />
    </View>
  );
}

// Row skeleton for transaction lists
export function SkeletonRow() {
  const { tok } = useI18n();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tok.border,
    }}>
      <Skeleton width={38} height={38} radius={10} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width="70%" height={13} />
        <Skeleton width="40%" height={9} />
      </View>
      <Skeleton width={60} height={14} />
    </View>
  );
}
