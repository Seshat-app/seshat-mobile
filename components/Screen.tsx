import { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { ScreenAtmosphere } from './ScreenAtmosphere';

// ─────────────────────────────────────────────────────────────
// ScreenScaffold — the standard screen frame.
//
// Renders the void background with the gold ScreenAtmosphere wash full-bleed
// (BEHIND the status bar), then insets the content below the top safe area.
// This avoids the trap where dropping <ScreenAtmosphere/> into a root that
// already has paddingTop:insets.top clips the strongest part of the top wash.
//
// Use as the root of any screen with a normal top header (Profile, the Plan
// sub-screens via PlanScreen, etc.). Screens with a custom overlay/glass
// header (the Home dashboard) compose <ScreenAtmosphere/> directly instead.
// ─────────────────────────────────────────────────────────────
export function ScreenScaffold({
  children, topInset = true, style,
}: { children: ReactNode; topInset?: boolean; style?: ViewStyle }) {
  const insets = useSafeAreaInsets();
  const { tok } = useI18n();
  return (
    <View style={{ flex: 1, backgroundColor: tok.void }}>
      <ScreenAtmosphere />
      <View style={[{ flex: 1, paddingTop: topInset ? insets.top : 0 }, style]}>
        {children}
      </View>
    </View>
  );
}
