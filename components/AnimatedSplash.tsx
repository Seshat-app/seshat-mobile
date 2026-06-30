import { useEffect, useRef } from 'react';
import { Animated, View, Text, Easing, AccessibilityInfo, StyleSheet } from 'react-native';
import Svg, { Line, Path, G } from 'react-native-svg';
import { FF } from '../lib/fonts';

/**
 * Animated splash — "Inscribed". Seshat is the divine scribe, so the brand
 * mark literally INKS ITSELF onto the void, then the name sets beneath it.
 *
 * Choreography (gold-on-void, ~1.7s):
 *   1. The crosshair-burst draws via SVG stroke-draw — axes ink outward from
 *      centre, the headdress dome arcs in, the four rays flick out, the dot pops.
 *   2. SESHAT (Syne ExtraBold, bone) rises + fades in beneath the mark.
 *   3. Brief hold, then the overlay fades through (with a hair of scale) → app.
 *
 * RN-native on purpose: stroke-draw (strokeDashoffset) + opacity/translate/scale
 * only. NO textShadow glow, NO radial-gradient flood — the two effects that
 * render muddy on real devices. Reduce-motion shows the finished mark; a 6s
 * failsafe guarantees the splash can never block the app.
 */

const VOID = '#0C0C0E';
const GOLD = '#C9A84C';
const BONE = '#E8E8E0';

const MARK = 128; // mark size (px)
const FS = 36;    // wordmark size
const LSP = 6;    // wordmark letter-spacing

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedPath = Animated.createAnimatedComponent(Path);

// Mark geometry in a 160×160 viewBox (centre = 80,80). Each stroke draws within
// its own sub-range of the shared 0→1 draw timeline, so one value choreographs
// the whole inscribe: axes → dome → rays. `len` is the dash length (>= the real
// path length so it always finishes drawing).
type Stroke =
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; len: number; range: [number, number]; w: number }
  | { kind: 'path'; d: string; len: number; range: [number, number]; w: number };

const STROKES: Stroke[] = [
  // axes — ink outward from the centre
  { kind: 'line', x1: 80, y1: 80, x2: 80, y2: 10, len: 70, range: [0.0, 0.34], w: 3.6 },
  { kind: 'line', x1: 80, y1: 80, x2: 80, y2: 150, len: 70, range: [0.0, 0.34], w: 3.6 },
  { kind: 'line', x1: 80, y1: 80, x2: 10, y2: 80, len: 70, range: [0.06, 0.4], w: 3.6 },
  { kind: 'line', x1: 80, y1: 80, x2: 150, y2: 80, len: 70, range: [0.06, 0.4], w: 3.6 },
  // headdress dome
  { kind: 'path', d: 'M80 24 Q46 24 34 56', len: 70, range: [0.34, 0.62], w: 3.6 },
  { kind: 'path', d: 'M80 24 Q114 24 126 56', len: 70, range: [0.34, 0.62], w: 3.6 },
  // rays — flick out from the centre
  { kind: 'line', x1: 80, y1: 80, x2: 60, y2: 60, len: 29, range: [0.58, 0.82], w: 3 },
  { kind: 'line', x1: 80, y1: 80, x2: 100, y2: 60, len: 29, range: [0.58, 0.82], w: 3 },
  { kind: 'line', x1: 80, y1: 80, x2: 60, y2: 100, len: 29, range: [0.64, 0.88], w: 3 },
  { kind: 'line', x1: 80, y1: 80, x2: 100, y2: 100, len: 29, range: [0.64, 0.88], w: 3 },
];

export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const draw = useRef(new Animated.Value(0)).current; // 0→1 inscribe (JS driver — strokeDashoffset)
  const dot = useRef(new Animated.Value(0)).current; // 0→1 centre-dot pop (native)
  const name = useRef(new Animated.Value(0)).current; // 0→1 wordmark set (native)
  const exit = useRef(new Animated.Value(1)).current; // 1→0 overlay fade (native)
  const release = useRef(new Animated.Value(0)).current; // 0→1 scale on exit (native)

  // Run exactly once. Ref guard (not state) so the effect never re-fires — a
  // re-fire's cleanup would cancel the async reduce-motion check mid-flight and
  // strand the splash at opacity 0.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (cancelled) return;
        reduce ? runReduced() : runFull();
      })
      .catch(() => { if (!cancelled) runFull(); });

    const failsafe = setTimeout(() => { if (!cancelled) onDone(); }, 6000);
    return () => { cancelled = true; clearTimeout(failsafe); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function runReduced() {
    draw.setValue(1); dot.setValue(1); name.setValue(1);
    Animated.sequence([
      Animated.delay(700),
      Animated.timing(exit, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start(({ finished }) => finished && onDone());
  }

  function runFull() {
    const T0 = 110; // brief void hold (hands off from the native splash)

    // 1) inscribe — strokeDashoffset can't use the native driver, but it's a
    // handful of strokes with nothing else competing, so it stays smooth.
    Animated.sequence([
      Animated.delay(T0),
      Animated.timing(draw, { toValue: 1, duration: 720, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
    ]).start();

    // centre dot pops near the end of the inscribe
    Animated.sequence([
      Animated.delay(T0 + 560),
      Animated.spring(dot, { toValue: 1, damping: 9, stiffness: 190, mass: 0.6, useNativeDriver: true }),
    ]).start();

    // 2) the name sets just as the mark finishes
    Animated.sequence([
      Animated.delay(T0 + 720),
      Animated.timing(name, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    // 3) hold, then release + fade through to the app
    Animated.sequence([
      Animated.delay(T0 + 720 + 400 + 240),
      Animated.parallel([
        Animated.timing(release, { toValue: 1, duration: 420, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(exit, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start(({ finished }) => finished && onDone());
  }

  const releaseScale = release.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: VOID, opacity: exit }]}
    >
      <Animated.View style={{ alignItems: 'center', transform: [{ scale: releaseScale }] }}>
        {/* the mark inks itself */}
        <View style={{ width: MARK, height: MARK }}>
          <Svg width={MARK} height={MARK} viewBox="0 0 160 160">
            <G stroke={GOLD} strokeLinecap="round" fill="none">
              {STROKES.map((s, i) => {
                const dashoffset = draw.interpolate({ inputRange: s.range, outputRange: [s.len, 0], extrapolate: 'clamp' });
                return s.kind === 'line' ? (
                  <AnimatedLine
                    key={i}
                    x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                    strokeWidth={s.w} strokeDasharray={s.len} strokeDashoffset={dashoffset}
                  />
                ) : (
                  <AnimatedPath
                    key={i}
                    d={s.d}
                    strokeWidth={s.w} strokeDasharray={s.len} strokeDashoffset={dashoffset}
                  />
                );
              })}
            </G>
          </Svg>
          {/* centre dot — pops in (scale + opacity) */}
          <Animated.View
            style={{
              position: 'absolute',
              left: MARK / 2 - 5, top: MARK / 2 - 5,
              width: 10, height: 10, borderRadius: 5, backgroundColor: GOLD,
              opacity: dot, transform: [{ scale: dot }],
            }}
          />
        </View>

        {/* the name sets */}
        <Animated.View
          style={{
            marginTop: 22,
            opacity: name,
            transform: [{ translateY: name.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          }}
        >
          <Text style={{ fontFamily: FF.syneExtraBold, fontSize: FS, letterSpacing: LSP, color: BONE }}>
            SESHAT
          </Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', zIndex: 999 },
});
