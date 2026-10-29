import { ReactNode } from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { Glass } from './Glass';

// ─────────────────────────────────────────────────────────────
// FrostedHeader — the app's sticky glass header, like the website's.
//
// It sits above the screen's scroll area (zIndex), blurs whatever slides
// underneath it, and reaches up behind the status bar so nothing crisp shows
// under the clock. For content to actually slide underneath, the screen's
// scroll container must not clip at its top edge: use ScrollView / FlatList
// from ./Scroll (overflow: 'visible') instead of the react-native ones.
// ─────────────────────────────────────────────────────────────
export function FrostedHeader({ children, style }: { children?: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  const insets = useSafeAreaInsets();
  const { mode } = useI18n();
  const dark = mode !== 'light';
  const tint = (a: number) => (dark ? `rgba(13,13,13,${a})` : `rgba(245,244,239,${a})`);
  return (
    <View style={[{ zIndex: 20 }, style]}>
      {/* Glass layer: from the very top of the screen down to the header's bottom edge. */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, right: 0, top: -insets.top, bottom: 0 }}
      >
        <Glass
          style={StyleSheet.absoluteFill as ViewStyle}
          intensity={60}
          dark={dark}
          material={dark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'}
          fallbackColor={tint(0.45)}
        >
          {/* Page colour over the blur cancels the material's grey cast, so the
              header matches the screen and only blurred content shows through. */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tint(0.72) }]} />
        </Glass>
      </View>
      {children}
    </View>
  );
}
