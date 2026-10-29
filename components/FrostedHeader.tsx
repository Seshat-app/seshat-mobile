import { ReactNode } from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { Glass } from './Glass';

// ─────────────────────────────────────────────────────────────
// FrostedHeader / FrostedFooter — the app's sticky glass bars, like the website's.
//
// They sit above the screen's scroll area (zIndex), blur whatever slides
// underneath, and reach out behind the status bar / home indicator so nothing
// crisp shows there. For content to actually slide underneath, the screen's
// scroll container must not clip at its edge: use ScrollView / FlatList
// from ./Scroll (overflow: 'visible') instead of the react-native ones.
// ─────────────────────────────────────────────────────────────
function FrostLayer({ edge, inset }: { edge: 'top' | 'bottom'; inset: number }) {
  const { mode } = useI18n();
  const dark = mode !== 'light';
  const tint = (a: number) => (dark ? `rgba(13,13,13,${a})` : `rgba(245,244,239,${a})`);
  return (
    <View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: 0, right: 0 },
        edge === 'top' ? { top: -inset, bottom: 0 } : { top: 0, bottom: -inset },
      ]}
    >
      <Glass
        style={StyleSheet.absoluteFill as ViewStyle}
        intensity={100}
        dark={dark}
        material={dark ? 'dark' : 'light'}
        fallbackColor={tint(0.2)}
      >
        {/* Page colour over the blur cancels the material's grey cast, so the bar
            matches the screen and only the blurred content shows through. Kept
            light so the blur reads as see-through, not solid. */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? 'rgba(0,0,0,0.24)' : tint(0.2) }]} />
      </Glass>
    </View>
  );
}

export function FrostedHeader({ children, style }: { children?: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ zIndex: 20 }, style]}>
      <FrostLayer edge="top" inset={insets.top} />
      {children}
    </View>
  );
}

/** Bottom counterpart (e.g. the chat composer). `inset` = how far the glass should
 *  extend below the bar (0 when the bar's own padding already covers the home indicator). */
export function FrostedFooter({ children, style, inset = 0 }: { children?: ReactNode; style?: ViewStyle | ViewStyle[]; inset?: number }) {
  return (
    <View style={[{ zIndex: 20 }, style]}>
      <FrostLayer edge="bottom" inset={inset} />
      {children}
    </View>
  );
}
