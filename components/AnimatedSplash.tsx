import { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, Easing, Platform } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useI18n } from '../lib/i18n';
import { fontHead, fontMono } from '../lib/fonts';
import { BRAND } from '../lib/brand';
import { SeshatMark } from './SeshatMark';

/**
 * Animated splash that takes over from the static native splash and reveals
 * the Seshat brand mark before fading out into the app.
 *
 * Gold-on-void, matching the web tour's "struck seal" entrance: a soft gold
 * halo blooms, the Seshat mark (the real in-app SeshatMark, so the hand-off to
 * the running app is seamless) scales in, one strike-ring pulses outward, then
 * the SESHAT wordmark and tagline rise.
 *
 * Choreography:
 *   0 - 220ms     backdrop fades in
 *   220 - 1000ms  halo blooms + mark springs in + strike-ring pulses out;
 *                  wordmark fades up partway through
 *   1000 - 1400ms tagline fades in
 *   1400 - 1760ms whole splash fades out, onDone fires
 *
 * The wordmark + tagline use the app fonts (Syne / Cairo) so they match the UI.
 */
const SPLASH_BOX = 300;  // px on screen for the mark + halo stack
const SPLASH_MARK = 150; // the brand mark itself

export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const { tok, lang } = useI18n();

  const stageFade = useRef(new Animated.Value(0)).current;
  const haloOpacity = useRef(new Animated.Value(0)).current;
  const markScale = useRef(new Animated.Value(0.8)).current;
  const markFade = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current; // one-shot strike pulse
  const wordmarkFade = useRef(new Animated.Value(0)).current;
  const taglineFade = useRef(new Animated.Value(0)).current;
  const exitFade = useRef(new Animated.Value(1)).current;

  // Guard so the sequence runs exactly once, not on every re-render (keyboard,
  // locale change, etc.).
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (started) return;
    setStarted(true);

    Animated.sequence([
      Animated.timing(stageFade, {
        toValue: 1, duration: 220, useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(haloOpacity, {
          toValue: 1, duration: 760, easing: Easing.out(Easing.quad), useNativeDriver: true,
        }),
        Animated.spring(markScale, {
          toValue: 1, damping: 12, mass: 0.7, stiffness: 150, useNativeDriver: true,
        }),
        Animated.timing(markFade, {
          toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(160),
          Animated.timing(ring, {
            toValue: 1, duration: 820, easing: Easing.out(Easing.quad), useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(380),
          Animated.timing(wordmarkFade, {
            toValue: 1, duration: 560, easing: Easing.out(Easing.cubic), useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.timing(taglineFade, {
        toValue: 1, duration: 400, useNativeDriver: true,
      }),
      Animated.delay(360),
      Animated.timing(exitFade, {
        toValue: 0, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onDone();
    });
  }, [started]); // eslint-disable-line react-hooks/exhaustive-deps

  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.55, 2.0] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 0.32, 0] });
  const haloSettled = haloOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        ...(Platform.OS === 'web' ? { position: 'fixed' } as object : { position: 'absolute' }),
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: tok.void,
        alignItems: 'center', justifyContent: 'center',
        opacity: exitFade,
        zIndex: 999,
      }}
    >
      <Animated.View style={{ opacity: stageFade, alignItems: 'center' }}>
        <View style={{ width: SPLASH_BOX, height: SPLASH_BOX, alignItems: 'center', justifyContent: 'center' }}>
          {/* soft gold halo, lit from behind the mark */}
          <Animated.View
            pointerEvents="none"
            style={{ position: 'absolute', width: SPLASH_BOX, height: SPLASH_BOX, opacity: haloSettled }}
          >
            <Svg width={SPLASH_BOX} height={SPLASH_BOX} viewBox="-100 -100 200 200">
              <Defs>
                <RadialGradient id="halo" cx="0" cy="0" r="100" gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={tok.gold} stopOpacity="0.5" />
                  <Stop offset="0.55" stopColor={tok.gold} stopOpacity="0.12" />
                  <Stop offset="1" stopColor={tok.gold} stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Circle cx="0" cy="0" r="100" fill="url(#halo)" />
            </Svg>
          </Animated.View>

          {/* one-shot strike ring, pulses outward as the mark lands */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute', width: SPLASH_BOX, height: SPLASH_BOX,
              alignItems: 'center', justifyContent: 'center',
              opacity: ringOpacity, transform: [{ scale: ringScale }],
            }}
          >
            <Svg width={SPLASH_BOX} height={SPLASH_BOX} viewBox="-100 -100 200 200">
              <Circle cx="0" cy="0" r="72" fill="none" stroke={tok.gold} strokeWidth="2.5" />
            </Svg>
          </Animated.View>

          {/* the Seshat mark itself, springing in */}
          <Animated.View style={{ opacity: markFade, transform: [{ scale: markScale }] }}>
            <SeshatMark size={SPLASH_MARK} gold={tok.gold} />
          </Animated.View>
        </View>

        {/* Wordmark + tagline */}
        <Animated.View style={{ marginTop: 32, alignItems: 'center', opacity: wordmarkFade }}>
          <Text style={{
            fontFamily: fontHead(lang, 'bold'),
            fontSize: lang === 'ar' ? 42 : 38,
            color: tok.bone,
            letterSpacing: lang === 'ar' ? 0 : 14,
            textTransform: lang === 'ar' ? 'none' : 'uppercase',
          }}>
            {lang === 'ar' ? BRAND.nameAr : BRAND.name.toUpperCase()}
          </Text>
          <View style={{ height: 1, width: 80, backgroundColor: tok.gold, opacity: 0.5, marginTop: 12 }} />
        </Animated.View>

        <Animated.View style={{ marginTop: 14, opacity: taglineFade }}>
          <Text style={{
            fontFamily: fontMono('regular'),
            fontSize: 11,
            color: tok.muted,
            letterSpacing: lang === 'ar' ? 0 : 3.6,
            textTransform: 'uppercase',
          }}>
            {lang === 'ar' ? 'مساعدك المالي' : 'AI · FINANCE COACH'}
          </Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}
