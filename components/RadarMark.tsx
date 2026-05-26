import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Line, Path, Defs, LinearGradient, Stop } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  size?: number;
  gold?: string;
  ringColor?: string;
  /** Use a brightened-on-dark ring instead of the default near-black. */
  lightRing?: boolean;
  /** One-shot scan animation on mount, then settle into the blip. */
  animate?: boolean;
  /** Continuous spinning radar sweep — used as a refresh indicator. */
  spinning?: boolean;
};

// Translates the design's HTML/CSS RadarMark into react-native-svg.
// Geometry comes straight from the brand spec: outer circle, inner ring,
// crosshair, upper-right active quadrant in gold, blip at 45° NE.
export function RadarMark({ size = 32, gold = '#C9A84C', ringColor, lightRing = false, animate = false, spinning = false }: Props) {
  const cx = 100, cy = 100, r = 90, ri = 45;
  // Boosted the lightRing alpha from 0.18 → 0.42 so the geometry actually
  // reads on dark backgrounds. The old value was barely visible against the
  // void.
  const ring = lightRing ? 'rgba(232,232,224,0.42)' : (ringColor ?? '#1C1C1C');

  const blipX = cx + r * Math.cos(-Math.PI / 4);
  const blipY = cy + r * Math.sin(-Math.PI / 4);

  const outerArc = `M ${cx + r} ${cy} A ${r} ${r} 0 0 0 ${cx} ${cy - r}`;
  const innerArc = `M ${cx + ri} ${cy} A ${ri} ${ri} 0 0 0 ${cx} ${cy - ri}`;
  const wedgePath = `M ${cx} ${cy} L ${cx + r} ${cy} A ${r} ${r} 0 0 0 ${blipX} ${blipY} Z`;

  const sweepRot = useRef(new Animated.Value(-90)).current;
  const sweepOpacity = useRef(new Animated.Value(0)).current;
  const blipOpacity = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const blipRingOpacity = useRef(new Animated.Value(animate ? 0 : 0.35)).current;
  // For continuous spin: a separate rotation value that loops 0 → 360 forever.
  const spinRot = useRef(new Animated.Value(0)).current;

  // One-shot scan-on-mount animation (when animate=true and not spinning).
  useEffect(() => {
    if (!animate || spinning) return;
    Animated.sequence([
      Animated.parallel([
        Animated.timing(sweepOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(sweepRot, { toValue: 270, duration: 2400, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(sweepOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(blipOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(blipRingOpacity, { toValue: 0.35, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, [animate, spinning]);

  // Continuous spinning sweep — used as a refresh / loading indicator. While
  // spinning the wedge is always visible at full opacity and rotates 360° in
  // a loop. Stops cleanly when `spinning` flips to false.
  useEffect(() => {
    if (!spinning) {
      sweepOpacity.setValue(0);
      spinRot.setValue(0);
      return;
    }
    sweepOpacity.setValue(0.85);
    const loop = Animated.loop(
      Animated.timing(spinRot, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spinRot.setValue(0);
    loop.start();
    return () => loop.stop();
  }, [spinning]);

  const oneShotRotInterp = sweepRot.interpolate({ inputRange: [-90, 270], outputRange: ['-90deg', '270deg'] });
  const spinRotInterp = spinRot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rotInterp = spinning ? spinRotInterp : oneShotRotInterp;

  const showSweep = animate || spinning;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        {/* outer circle */}
        <Circle cx={cx} cy={cy} r={r} fill="none" stroke={ring} strokeWidth={1.6} />
        {/* inner ring */}
        <Circle cx={cx} cy={cy} r={ri} fill="none" stroke={ring} strokeWidth={1} />
        {/* crosshairs */}
        <Line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke={ring} strokeWidth={1.6} />
        <Line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke={ring} strokeWidth={1.6} />
        {/* active rays in NE quadrant */}
        <Line x1={cx} y1={cy} x2={cx + r} y2={cy} stroke={gold} strokeWidth={2} opacity={0.5} strokeLinecap="round" />
        <Line x1={cx} y1={cy} x2={cx} y2={cy - r} stroke={gold} strokeWidth={2} opacity={0.5} strokeLinecap="round" />
        {/* active inner arc */}
        <Path d={innerArc} stroke={gold} strokeWidth={2} fill="none" opacity={0.45} strokeLinecap="round" />
        {/* active outer arc */}
        <Path d={outerArc} stroke={gold} strokeWidth={3.6} fill="none" strokeLinecap="round" />
        {/* center dot */}
        <Circle cx={cx} cy={cy} r={4} fill={gold} />
        {/* blip — outer ring + filled center */}
        {animate || spinning ? (
          <>
            <AnimatedCircle cx={blipX} cy={blipY} r={6} fill="none" stroke={gold} strokeWidth={1} opacity={blipRingOpacity as any} />
            <AnimatedCircle cx={blipX} cy={blipY} r={3.5} fill={gold} opacity={blipOpacity as any} />
          </>
        ) : (
          <>
            <Circle cx={blipX} cy={blipY} r={6} fill="none" stroke={gold} strokeWidth={1} opacity={0.35} />
            <Circle cx={blipX} cy={blipY} r={3.5} fill={gold} />
          </>
        )}
      </Svg>

      {/* Rotating sweep overlay — shown during the one-shot scan AND while spinning */}
      {showSweep && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', top: 0, left: 0, width: size, height: size,
            opacity: sweepOpacity,
            transform: [{ rotate: rotInterp }],
          }}
        >
          <Svg width={size} height={size} viewBox="0 0 200 200">
            <Defs>
              <LinearGradient id="sweepGrad" x1={cx} y1={cy} x2={cx + r} y2={cy} gradientUnits="userSpaceOnUse">
                <Stop offset="0%" stopColor={gold} stopOpacity={0.8} />
                <Stop offset="100%" stopColor={gold} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={wedgePath} fill="url(#sweepGrad)" opacity={0.85} />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}
