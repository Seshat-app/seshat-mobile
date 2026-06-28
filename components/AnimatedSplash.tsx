import { useEffect, useRef } from 'react';
import { Animated, View, Text, Easing, AccessibilityInfo, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { FF } from '../lib/fonts';

/**
 * Animated splash — the Seshat name *writes itself*, then ignites.
 *
 * Choreography (Seshat is the goddess of writing):
 *   1. "SESHAT" types in letter-by-letter (blinking gold cursor).
 *   2. A gold glow sweeps across the letters, one at a time, until the whole
 *      word burns gold.
 *   3. The glow bursts out of the word and floods the screen with gold light.
 *   4. The overlay fades, revealing the app home underneath.
 *
 * Always the dark gold-on-void brand palette (matches the native splash and
 * stays consistent in light mode). Wordmark is Syne ExtraBold — the app head
 * font. Falls back to a simple fade when reduce-motion is on.
 */

// Fixed brand palette — this is a branded moment, not theme-dependent.
const VOID = '#0C0C0E';
const GOLD = '#C9A84C';
const GOLD_LIGHT = '#E8C97A';
const DIM = '#8A8068';      // un-ignited letter
const HOT = '#FFF7E0';      // flood core
const LETTERS = ['S', 'E', 'S', 'H', 'A', 'T'];
const FS = 44;              // wordmark size
const LSP = 8;              // letter spacing

export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const letterIn = useRef(LETTERS.map(() => new Animated.Value(0))).current;
  const letterGlow = useRef(LETTERS.map(() => new Animated.Value(0))).current;
  const cursor = useRef(new Animated.Value(0)).current;
  const floodScale = useRef(new Animated.Value(0)).current;
  const floodOpacity = useRef(new Animated.Value(0)).current;
  const wordScale = useRef(new Animated.Value(1)).current;
  const wordFade = useRef(new Animated.Value(1)).current;
  const exitFade = useRef(new Animated.Value(1)).current;

  // Run exactly once on mount. A ref guard (not state) so we never re-run the
  // effect — a state update here would re-fire the effect, and its cleanup would
  // cancel the async reduce-motion check before it resolves, leaving the splash
  // stuck at opacity 0 forever.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          // No motion: show the lit word, brief hold, fade out.
          letterIn.forEach((v) => v.setValue(1));
          letterGlow.forEach((v) => v.setValue(1));
          Animated.sequence([
            Animated.delay(650),
            Animated.timing(exitFade, { toValue: 0, duration: 380, useNativeDriver: true }),
          ]).start(({ finished }) => finished && onDone());
        } else {
          runFull();
        }
      })
      .catch(() => { if (!cancelled) runFull(); });

    // Failsafe: never let the splash block the app. Reveal home no matter what.
    const failsafe = setTimeout(() => { if (!cancelled) onDone(); }, 6000);

    return () => { cancelled = true; clearTimeout(failsafe); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function runFull() {
    // Blinking cursor while typing.
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(cursor, { toValue: 1, duration: 1, useNativeDriver: true }),
        Animated.delay(280),
        Animated.timing(cursor, { toValue: 0, duration: 1, useNativeDriver: true }),
        Animated.delay(280),
      ]),
    );
    blink.start();

    Animated.sequence([
      // 1) typewriter — letters snap in
      Animated.stagger(
        135,
        letterIn.map((v) => Animated.timing(v, { toValue: 1, duration: 80, useNativeDriver: true })),
      ),
      Animated.delay(170),
    ]).start(() => {
      blink.stop();
      Animated.timing(cursor, { toValue: 0, duration: 150, useNativeDriver: true }).start();

      Animated.sequence([
        // 2) glow sweep, letter by letter
        Animated.stagger(
          100,
          letterGlow.map((v) =>
            Animated.timing(v, {
              toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true,
            }),
          ),
        ),
        Animated.delay(150),
        // 3) flood burst out of the word; word blooms away
        Animated.parallel([
          Animated.timing(floodOpacity, { toValue: 1, duration: 130, useNativeDriver: true }),
          Animated.timing(floodScale, { toValue: 38, duration: 620, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          Animated.timing(wordScale, { toValue: 1.22, duration: 540, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.sequence([
            Animated.delay(230),
            Animated.timing(wordFade, { toValue: 0, duration: 340, useNativeDriver: true }),
          ]),
        ]),
        // 4) fade the whole overlay → reveal the app home underneath
        Animated.timing(exitFade, { toValue: 0, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(({ finished }) => finished && onDone());
    });
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: VOID, opacity: exitFade }]}
    >
      {/* soft gold atmosphere */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="splash-atmo" cx="0.5" cy="0.42" r="0.62">
            <Stop offset="0" stopColor={GOLD} stopOpacity={0.1} />
            <Stop offset="0.7" stopColor={GOLD} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#splash-atmo)" />
      </Svg>

      {/* the word */}
      <Animated.View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          opacity: wordFade,
          transform: [{ scale: wordScale }],
        }}
      >
        {LETTERS.map((ch, i) => (
          <Animated.View key={i} style={{ opacity: letterIn[i] }}>
            <Text style={{ fontFamily: FF.syneExtraBold, fontSize: FS, letterSpacing: LSP, color: DIM }}>
              {ch}
            </Text>
            {/* ignited layer, fades in during the sweep */}
            <Animated.Text
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                fontFamily: FF.syneExtraBold,
                fontSize: FS,
                letterSpacing: LSP,
                color: GOLD_LIGHT,
                opacity: letterGlow[i],
                textShadowColor: GOLD,
                textShadowRadius: 16,
                textShadowOffset: { width: 0, height: 0 },
              }}
            >
              {ch}
            </Animated.Text>
          </Animated.View>
        ))}

        {/* blinking cursor */}
        <Animated.View
          style={{
            width: 3,
            height: FS * 0.9,
            marginLeft: 6,
            backgroundColor: GOLD,
            opacity: cursor,
            shadowColor: GOLD,
            shadowOpacity: 0.8,
            shadowRadius: 8,
          }}
        />
      </Animated.View>

      {/* light flood, bursting from the word's centre */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
        <Animated.View style={{ opacity: floodOpacity, transform: [{ scale: floodScale }] }}>
          <Svg width={160} height={160} viewBox="-80 -80 160 160">
            <Defs>
              <RadialGradient id="splash-flood" cx="0" cy="0" r="80" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={HOT} stopOpacity={0.95} />
                <Stop offset="0.3" stopColor={GOLD_LIGHT} stopOpacity={0.8} />
                <Stop offset="0.6" stopColor={GOLD} stopOpacity={0.4} />
                <Stop offset="1" stopColor={GOLD} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={0} cy={0} r={80} fill="url(#splash-flood)" />
          </Svg>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
