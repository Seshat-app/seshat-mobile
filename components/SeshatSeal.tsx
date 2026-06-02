import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle, Rect } from 'react-native-svg';
import { SeshatMark } from './SeshatMark';

// ─────────────────────────────────────────────────────────────
// SeshatSeal — the struck-medallion logo badge, faithful to the web
// TourGate seal: a soft radial halo (gold light bleeding out), a struck disc
// (radial bronze fill, hairline gold rim, lit top edge), a static inner
// concentric ring, and the brand mark centred.
//
// React Native has no blur filter, so the halo is an SVG radial gradient
// (soft falloff) instead of the web's blur(12px) - it reads the same without
// the hard edge the old flat-disc halo had. The layout box is exactly the
// medallion (size x size); the halo is absolutely positioned and overflows,
// so this drops in wherever a size x size mark used to sit.
// ─────────────────────────────────────────────────────────────
export function SeshatSeal({
  size = 64, animate, gold = '#C9A84C',
}: { size?: number; animate?: boolean; gold?: string }) {
  const halo = Math.round(size * 1.9);
  const ring = Math.max(7, Math.round(size * 0.11));
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const off = (size - halo) / 2; // centre the larger halo over the medallion

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* soft halo — gold light falling off to nothing (overflows the box) */}
      <Svg width={halo} height={halo} style={{ position: 'absolute', left: off, top: off }} pointerEvents="none">
        <Defs>
          <RadialGradient id={`halo${uid}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={gold} stopOpacity={0.32} />
            <Stop offset="46%" stopColor={gold} stopOpacity={0.12} />
            <Stop offset="100%" stopColor={gold} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={halo / 2} cy={halo / 2} r={halo / 2} fill={`url(#halo${uid})`} />
      </Svg>

      {/* struck medallion */}
      <View style={{
        width: size, height: size, borderRadius: size / 2, overflow: 'hidden',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: 'rgba(201,168,76,0.30)',
        shadowColor: gold, shadowOpacity: 0.34, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
      }}>
        {/* struck disc fill: lit toward the top-left, deep toward the bottom */}
        <Svg width={size} height={size} style={{ position: 'absolute' }} pointerEvents="none">
          <Defs>
            <RadialGradient id={`disc${uid}`} cx="32%" cy="22%" r="92%">
              <Stop offset="0%" stopColor={gold} stopOpacity={0.18} />
              <Stop offset="100%" stopColor="#141210" stopOpacity={0.55} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={size} height={size} fill={`url(#disc${uid})`} />
        </Svg>

        {/* inner concentric ring — static, machined */}
        <View style={{
          position: 'absolute', top: ring, left: ring, right: ring, bottom: ring,
          borderRadius: size / 2, borderWidth: 1, borderColor: 'rgba(201,168,76,0.16)',
        }} />

        <SeshatMark size={Math.round(size * 0.5)} gold={gold} animate={animate} />
      </View>
    </View>
  );
}
