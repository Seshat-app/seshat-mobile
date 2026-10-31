import { useEffect, useRef } from 'react';
import { Animated, View, Text, Easing, AccessibilityInfo, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { FF } from '../lib/fonts';

/**
 * Animated splash — "Inscribed".
 *
 * Seshat is the scribe: the mark inks itself onto the void, a gold light
 * blooms behind it, and the name is set letter by letter. Same void and gold
 * glow as the home-screen widgets, so the app opens in the same visual world.
 *
 * The native splash is a plain void (no image), so this picks up from an
 * identical solid colour — there is nothing to jump from. The native splash is
 * held until this first paints (onReady), so there is no blank frame either.
 *
 * Timeline (~2.4s):
 *   0.00  rings breathe in, the mark begins to ink (axes → dome → rays)
 *   0.40  gold halo blooms behind the mark
 *   0.75  centre dot pops, one ring of light leaves it
 *   0.90  S-E-S-H-A-T rises letter by letter
 *   1.10  hairline draws out from the centre
 *   1.30  Arabic name + tagline fade in
 *   2.00  hold, then the whole thing lifts and fades into the app
 *
 * RN-native only: opacity / transform on the native driver, stroke-draw on JS.
 * Reduce-motion shows the finished composition. A 6s failsafe guarantees the
 * splash can never block the app.
 */

export const SPLASH_VOID = '#0D0D0D';
const GOLD = '#C9A84C';
const GOLD_HI = '#E8C97A';
const BONE = '#F2EEE3';
const DIM = '#8D877B';

const MARK = 132;     // mark size (px)
const HALO = 560;     // glow diameter
const WORD = 'SESHAT'.split('');

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedPath = Animated.createAnimatedComponent(Path);

// Mark geometry in a 160×160 viewBox (centre = 80,80). Each stroke draws inside
// its own slice of one shared 0→1 timeline. `len` >= the real path length.
type Stroke =
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; len: number; range: [number, number]; w: number }
  | { kind: 'path'; d: string; len: number; range: [number, number]; w: number };

const STROKES: Stroke[] = [
  { kind: 'line', x1: 80, y1: 80, x2: 80, y2: 10, len: 70, range: [0.0, 0.34], w: 3.6 },
  { kind: 'line', x1: 80, y1: 80, x2: 80, y2: 150, len: 70, range: [0.0, 0.34], w: 3.6 },
  { kind: 'line', x1: 80, y1: 80, x2: 10, y2: 80, len: 70, range: [0.06, 0.4], w: 3.6 },
  { kind: 'line', x1: 80, y1: 80, x2: 150, y2: 80, len: 70, range: [0.06, 0.4], w: 3.6 },
  { kind: 'path', d: 'M80 24 Q46 24 34 56', len: 70, range: [0.34, 0.62], w: 3.6 },
  { kind: 'path', d: 'M80 24 Q114 24 126 56', len: 70, range: [0.34, 0.62], w: 3.6 },
  { kind: 'line', x1: 80, y1: 80, x2: 60, y2: 60, len: 29, range: [0.58, 0.82], w: 3 },
  { kind: 'line', x1: 80, y1: 80, x2: 100, y2: 60, len: 29, range: [0.58, 0.82], w: 3 },
  { kind: 'line', x1: 80, y1: 80, x2: 60, y2: 100, len: 29, range: [0.64, 0.88], w: 3 },
  { kind: 'line', x1: 80, y1: 80, x2: 100, y2: 100, len: 29, range: [0.64, 0.88], w: 3 },
];

export function AnimatedSplash({ onDone, onReady }: { onDone: () => void; onReady?: () => void }) {
  const rings = useRef(new Animated.Value(0)).current;   // concentric rings breathe in
  const halo = useRef(new Animated.Value(0)).current;    // gold bloom
  const draw = useRef(new Animated.Value(0)).current;    // 0→1 inscribe (JS driver)
  const dot = useRef(new Animated.Value(0)).current;     // centre dot pop
  const pulse = useRef(new Animated.Value(0)).current;   // ring of light leaving the dot
  const letters = useRef(WORD.map(() => new Animated.Value(0))).current;
  const rule = useRef(new Animated.Value(0)).current;    // hairline
  const sub = useRef(new Animated.Value(0)).current;     // Arabic name + tagline
  const exit = useRef(new Animated.Value(1)).current;    // overlay opacity
  const lift = useRef(new Animated.Value(0)).current;    // scale on exit

  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => { if (!cancelled) (reduce ? runReduced() : runFull()); })
      .catch(() => { if (!cancelled) runFull(); });

    const failsafe = setTimeout(() => { if (!cancelled) onDone(); }, 6000);
    return () => { cancelled = true; clearTimeout(failsafe); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const after = (ms: number, anim: Animated.CompositeAnimation) =>
    Animated.sequence([Animated.delay(ms), anim]).start();

  function runReduced() {
    [rings, halo, draw, dot, rule, sub, ...letters].forEach((v) => v.setValue(1));
    Animated.sequence([
      Animated.delay(800),
      Animated.timing(exit, { toValue: 0, duration: 360, useNativeDriver: true }),
    ]).start(({ finished }) => finished && onDone());
  }

  function runFull() {
    const T = 80;
    const out = Easing.out(Easing.cubic);

    after(T, Animated.timing(rings, { toValue: 1, duration: 1100, easing: out, useNativeDriver: true }));
    after(T, Animated.timing(draw, { toValue: 1, duration: 760, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }));
    after(T + 320, Animated.timing(halo, { toValue: 1, duration: 900, easing: out, useNativeDriver: true }));
    after(T + 620, Animated.spring(dot, { toValue: 1, damping: 9, stiffness: 190, mass: 0.6, useNativeDriver: true }));
    after(T + 660, Animated.timing(pulse, { toValue: 1, duration: 900, easing: out, useNativeDriver: true }));

    letters.forEach((v, i) =>
      after(T + 820 + i * 55, Animated.timing(v, { toValue: 1, duration: 420, easing: out, useNativeDriver: true })),
    );
    after(T + 1000, Animated.timing(rule, { toValue: 1, duration: 520, easing: out, useNativeDriver: true }));
    after(T + 1220, Animated.timing(sub, { toValue: 1, duration: 520, easing: out, useNativeDriver: true }));

    Animated.sequence([
      Animated.delay(T + 2000),
      Animated.parallel([
        Animated.timing(lift, { toValue: 1, duration: 460, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(exit, { toValue: 0, duration: 460, easing: out, useNativeDriver: true }),
      ]),
    ]).start(({ finished }) => finished && onDone());
  }

  const liftScale = lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const ringScale = rings.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });
  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 2.4] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.root, { opacity: exit }]}
      onLayout={() => requestAnimationFrame(() => onReady?.())}
    >
      <Animated.View style={{ alignItems: 'center', transform: [{ scale: liftScale }] }}>
        {/* stage: rings + halo + mark share one centre */}
        <View style={{ width: MARK, height: MARK, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={[styles.layer, { opacity: halo, transform: [{ scale: haloScale }] }]}>
            <Svg width={HALO} height={HALO} viewBox={`0 0 ${HALO} ${HALO}`}>
              <Defs>
                <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={GOLD} stopOpacity="0.2" />
                  <Stop offset="0.5" stopColor={GOLD} stopOpacity="0.07" />
                  <Stop offset="1" stopColor={GOLD} stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Circle cx={HALO / 2} cy={HALO / 2} r={HALO / 2} fill="url(#halo)" />
            </Svg>
          </Animated.View>

          <Animated.View style={[styles.layer, { opacity: rings, transform: [{ scale: ringScale }] }]}>
            <Svg width={HALO} height={HALO} viewBox={`0 0 ${HALO} ${HALO}`}>
              {[120, 175, 240].map((r, i) => (
                <Circle
                  key={r} cx={HALO / 2} cy={HALO / 2} r={r}
                  fill="none" stroke={GOLD} strokeOpacity={0.14 - i * 0.04} strokeWidth={1}
                />
              ))}
            </Svg>
          </Animated.View>

          {/* ring of light leaving the dot */}
          <Animated.View
            style={{
              position: 'absolute', width: 64, height: 64, borderRadius: 32,
              borderWidth: 1, borderColor: GOLD_HI,
              opacity: pulseOpacity, transform: [{ scale: pulseScale }],
            }}
          />

          <Svg width={MARK} height={MARK} viewBox="0 0 160 160">
            <Defs>
              <LinearGradient id="ink" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="160" y2="160">
                <Stop offset="0" stopColor={GOLD_HI} />
                <Stop offset="1" stopColor={GOLD} />
              </LinearGradient>
            </Defs>
            <G stroke="url(#ink)" strokeLinecap="round" fill="none">
              {STROKES.map((s, i) => {
                const dashoffset = draw.interpolate({ inputRange: s.range, outputRange: [s.len, 0], extrapolate: 'clamp' });
                return s.kind === 'line' ? (
                  <AnimatedLine
                    key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                    strokeWidth={s.w} strokeDasharray={s.len} strokeDashoffset={dashoffset}
                  />
                ) : (
                  <AnimatedPath key={i} d={s.d} strokeWidth={s.w} strokeDasharray={s.len} strokeDashoffset={dashoffset} />
                );
              })}
            </G>
          </Svg>
          <Animated.View
            style={{
              position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: GOLD_HI,
              opacity: dot, transform: [{ scale: dot }],
            }}
          />
        </View>

        {/* the name is set, letter by letter */}
        <View style={{ flexDirection: 'row', marginTop: 38 }}>
          {WORD.map((ch, i) => (
            <Animated.Text
              key={i}
              style={{
                fontFamily: FF.monoMedium, fontSize: 30, color: BONE, marginHorizontal: 5,
                opacity: letters[i],
                transform: [{ translateY: letters[i].interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
              }}
            >
              {ch}
            </Animated.Text>
          ))}
        </View>

        <Animated.View
          style={{
            width: 56, height: 1, marginTop: 20, backgroundColor: GOLD,
            opacity: rule, transform: [{ scaleX: rule }],
          }}
        />

        <Animated.View style={{ alignItems: 'center', marginTop: 18, opacity: sub, transform: [{ translateY: sub.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }}>
          <Text style={{ fontFamily: FF.cairoBold, fontSize: 20, color: GOLD, lineHeight: 30 }}>سيشات</Text>
          <Text style={{ marginTop: 6, fontFamily: FF.monoRegular, fontSize: 9.5, letterSpacing: 3, color: DIM }}>
            THE SCRIBE OF YOUR MONEY
          </Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', zIndex: 999, backgroundColor: SPLASH_VOID },
  layer: { position: 'absolute', width: HALO, height: HALO },
});
