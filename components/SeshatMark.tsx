import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Line, Path, Circle, G } from 'react-native-svg';

type Props = {
  size?: number;
  gold?: string;
  /** Accepted for drop-in compatibility with the old mark; unused. */
  ringColor?: string;
  lightRing?: boolean;
  /** One-shot draw-in + gold pulse on mount. */
  animate?: boolean;
  /** Continuous slow rotation for loading/refresh states. */
  spinning?: boolean;
};

/**
 * SeshatMark - the Seshat brand mark for mobile: the original crosshair-burst
 * (vertical + horizontal axes, the headdress dome on top, four rays, centre
 * dot). Mirrors the web LogoMark, with a slightly heavier stroke on
 * mobile for a bolder, more premium read. Replaces the previous mark.
 *
 * - animate: the mark scales + fades in, then emits one soft gold pulse ring.
 * - spinning: the mark rotates once every 3s at reduced opacity (loading).
 */
export function SeshatMark({ size = 32, gold = '#C9A84C', animate = false, spinning = false }: Props) {
  const rot = useRef(new Animated.Value(0)).current;
  const appear = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  // continuous spin (loading indicator)
  useEffect(() => {
    if (!spinning) { rot.setValue(0); return; }
    const loop = Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spinning]); // eslint-disable-line react-hooks/exhaustive-deps

  // one-shot draw-in + pulse on mount
  useEffect(() => {
    if (!animate || spinning) return;
    Animated.sequence([
      Animated.timing(appear, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [animate, spinning]); // eslint-disable-line react-hooks/exhaustive-deps

  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scale = appear.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const opacity = spinning ? 0.7 : appear;
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.8] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.3, 0] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {animate && !spinning && (
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', width: size, height: size, opacity: pulseOpacity, transform: [{ scale: pulseScale }] }}
        >
          <Svg width={size} height={size} viewBox="0 0 160 160">
            <Circle cx={80} cy={80} r={60} fill="none" stroke={gold} strokeWidth={3} />
          </Svg>
        </Animated.View>
      )}
      <Animated.View style={{ width: size, height: size, opacity, transform: [{ rotate }, { scale }] }}>
        <Svg width={size} height={size} viewBox="0 0 160 160">
          <G stroke={gold} strokeLinecap="round">
            <Line x1={80} y1={10} x2={80} y2={150} strokeWidth={3.6} />
            <Line x1={10} y1={80} x2={150} y2={80} strokeWidth={3.6} />
            <Path d="M80 24 Q46 24 34 56" strokeWidth={3.6} fill="none" />
            <Path d="M80 24 Q114 24 126 56" strokeWidth={3.6} fill="none" />
            <Line x1={80} y1={80} x2={60} y2={60} strokeWidth={3} />
            <Line x1={80} y1={80} x2={100} y2={60} strokeWidth={3} />
            <Line x1={80} y1={80} x2={60} y2={100} strokeWidth={3} />
            <Line x1={80} y1={80} x2={100} y2={100} strokeWidth={3} />
          </G>
          <Circle cx={80} cy={80} r={6.2} fill={gold} />
        </Svg>
      </Animated.View>
    </View>
  );
}
