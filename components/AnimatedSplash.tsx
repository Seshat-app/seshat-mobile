import { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, Easing, Platform } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { useI18n } from '../lib/i18n';
import { fontHead, fontMono } from '../lib/fonts';

/**
 * Animated splash that takes over from the static native splash and runs
 * a single radar-sweep animation before fading out and revealing the app.
 *
 * Geometry intentionally mirrors the RadarMark component (cx/cy = 0,
 * outer radius = 380, inner = 190, NE blip at -45 deg) so the transition
 * to the in-app brand mark feels continuous - the user's eye doesn't
 * "jump" when the splash ends.
 *
 * Animation choreography:
 *   0 - 200ms     fade IN backdrop + faint rings
 *   200 - 1800ms  rotating sweep beam wipes 360 deg, painting the gold
 *                  ring + wedge in its wake; SESHAT wordmark fades up
 *   1800 - 2200ms blip pulses on at NE; tagline fades in
 *   2200 - 2500ms whole splash fades OUT, onDone fires
 *
 * The wordmark + tagline use the actual app fonts (Syne / Cairo) loaded
 * by app/_layout.tsx so they match the rest of the UI.
 */
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedSvgPath = Animated.createAnimatedComponent(Path);

const RADAR_R = 380;
const RADAR_RI = 190;
const BLIP_X = RADAR_R * Math.cos(-Math.PI / 4);
const BLIP_Y = RADAR_R * Math.sin(-Math.PI / 4);

const SPLASH_SIZE = 320; // px on screen — the SVG canvas, not the geometry units

export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const { tok, lang } = useI18n();

  const stageFade = useRef(new Animated.Value(0)).current;
  const sweepRot = useRef(new Animated.Value(0)).current;
  const sweepOpacity = useRef(new Animated.Value(0)).current;
  const goldOpacity = useRef(new Animated.Value(0)).current;
  const blipScale = useRef(new Animated.Value(0)).current;
  const blipGlow = useRef(new Animated.Value(0)).current;
  const wordmarkFade = useRef(new Animated.Value(0)).current;
  const taglineFade = useRef(new Animated.Value(0)).current;
  const exitFade = useRef(new Animated.Value(1)).current;

  // Track whether we've already kicked off the choreography. Without this
  // the sequence would re-run on every re-render (e.g. when keyboard opens
  // briefly during loading or when locale changes).
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (started) return;
    setStarted(true);

    Animated.sequence([
      Animated.timing(stageFade, {
        toValue: 1, duration: 200, useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(sweepOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(sweepRot, {
          toValue: 360, duration: 1600,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(goldOpacity, {
          toValue: 1, duration: 1600,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(400),
          Animated.timing(wordmarkFade, {
            toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.parallel([
        Animated.timing(sweepOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.spring(blipScale, {
          toValue: 1, damping: 11, mass: 0.6, stiffness: 180, useNativeDriver: true,
        }),
        Animated.timing(blipGlow, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(taglineFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.delay(400),
      Animated.timing(exitFade, {
        toValue: 0, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onDone();
    });
  }, [started]);

  const sweepRotate = sweepRot.interpolate({ inputRange: [0, 360], outputRange: ['-90deg', '270deg'] });

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
        <View style={{ width: SPLASH_SIZE, height: SPLASH_SIZE }}>
          <Svg width={SPLASH_SIZE} height={SPLASH_SIZE} viewBox="-450 -450 900 900">
            <Defs>
              <LinearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#E8C97A" />
                <Stop offset="0.55" stopColor="#C9A84C" />
                <Stop offset="1" stopColor="#8B6B14" />
              </LinearGradient>
              <RadialGradient id="glow" cx="0" cy="0" r="0.5">
                <Stop offset="0" stopColor="#C9A84C" stopOpacity="0.4" />
                <Stop offset="1" stopColor="#C9A84C" stopOpacity="0" />
              </RadialGradient>
            </Defs>

            {/* Faint base rings */}
            <Circle cx="0" cy="0" r={RADAR_R} fill="none" stroke="rgba(232,232,224,0.18)" strokeWidth="3" />
            <Circle cx="0" cy="0" r={RADAR_RI} fill="none" stroke="rgba(232,232,224,0.18)" strokeWidth="3" />

            {/* Crosshair */}
            <Path d={`M ${-RADAR_R} 0 L ${RADAR_R} 0`} stroke="rgba(232,232,224,0.12)" strokeWidth="2" />
            <Path d={`M 0 ${-RADAR_R} L 0 ${RADAR_R}`} stroke="rgba(232,232,224,0.12)" strokeWidth="2" />

            {/* Gold arcs (top-right quadrant) - opacity ramps with goldOpacity */}
            <AnimatedSvgPath
              d={`M ${RADAR_R} 0 A ${RADAR_R} ${RADAR_R} 0 0 0 0 ${-RADAR_R}`}
              fill="none" stroke="url(#goldGrad)" strokeWidth="7" strokeLinecap="round"
              opacity={goldOpacity}
            />
            <AnimatedSvgPath
              d={`M ${RADAR_RI} 0 A ${RADAR_RI} ${RADAR_RI} 0 0 0 0 ${-RADAR_RI}`}
              fill="none" stroke="url(#goldGrad)" strokeWidth="5" strokeLinecap="round"
              opacity={goldOpacity}
            />
            <AnimatedSvgPath
              d={`M 0 0 L ${RADAR_R} 0 A ${RADAR_R} ${RADAR_R} 0 0 0 ${BLIP_X} ${BLIP_Y} Z`}
              fill="url(#goldGrad)"
              opacity={Animated.multiply(goldOpacity, new Animated.Value(0.18))}
            />

            {/* Center dot */}
            <Circle cx="0" cy="0" r="6" fill={tok.bone} />
          </Svg>

          {/* Rotating sweep beam (overlays the SVG above with a CSS transform) */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              opacity: sweepOpacity,
              transform: [{ rotate: sweepRotate }],
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Svg width={SPLASH_SIZE} height={SPLASH_SIZE} viewBox="-450 -450 900 900">
              <Defs>
                <LinearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#C9A84C" stopOpacity="0" />
                  <Stop offset="1" stopColor="#C9A84C" stopOpacity="0.85" />
                </LinearGradient>
              </Defs>
              <Path d={`M 0 0 L ${RADAR_R} 0 L 0 0 Z`} stroke="url(#sweep)" strokeWidth="3" fill="none" />
              <Path d={`M 0 0 L ${RADAR_R} -10 A ${RADAR_R} ${RADAR_R} 0 0 1 ${RADAR_R} 10 Z`} fill="url(#sweep)" opacity="0.5" />
            </Svg>
          </Animated.View>

          {/* Blip (springs in once the sweep finishes) */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              alignItems: 'center', justifyContent: 'center',
              transform: [{ scale: blipScale }],
            }}
          >
            <Svg width={SPLASH_SIZE} height={SPLASH_SIZE} viewBox="-450 -450 900 900">
              <AnimatedCircle cx={BLIP_X} cy={BLIP_Y} r="50" fill="url(#glow)" opacity={blipGlow} />
              <Circle cx={BLIP_X} cy={BLIP_Y} r="22" fill="#C9A84C" opacity="0.55" />
              <Circle cx={BLIP_X} cy={BLIP_Y} r="12" fill="#F4E3B6" />
            </Svg>
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
            {lang === 'ar' ? 'سيشات' : 'SESHAT'}
          </Text>
          <View style={{ height: 1, width: 80, backgroundColor: tok.gold, opacity: 0.5, marginTop: 12 }} />
        </Animated.View>

        <Animated.View style={{ marginTop: 14, opacity: taglineFade }}>
          <Text style={{
            fontFamily: fontMono('regular'),
            fontSize: 11,
            color: tok.muted,
            letterSpacing: 3.6,
            textTransform: 'uppercase',
          }}>
            {lang === 'ar' ? 'رادار أموالك' : 'AI · FINANCE COACH'}
          </Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}
