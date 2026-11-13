import { ReactNode, useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Easing, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { HeaderBack, HeaderAdd } from './HeaderButtons';
import { useI18n } from '../lib/i18n';
import { useWorkspace } from '../lib/appData';
import { radius, T } from '../lib/theme';
import { fontHead } from '../lib/fonts';
import { REyebrow } from './ui';
import { RefreshSpinner } from './shell';
import { ScreenScaffold } from './Screen';
import { WorkspaceChip } from './WorkspaceSwitcher';
import { FrostedHeader } from './FrostedHeader';

// Shared top chrome for Budgets / Goals / Debts: back arrow, title, subtitle,
// optional + action, and (when refreshing) a small refresh spinner. Sits on
// the gold ScreenAtmosphere wash via ScreenScaffold.
export function PlanScreen({
  title, subtitle, onAdd, refreshing, children,
}: { title: string; subtitle?: string; onAdd?: () => void; refreshing?: boolean; children: ReactNode }) {
  const router = useRouter();
  const { tok, lang } = useI18n();
  const { canWrite } = useWorkspace();
  // Content flows in just after the screen finishes sliding (the delay keeps it
  // from animating while it's still mid-transition). Native-driver, so cheap.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1, duration: 340, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [enter]);
  return (
    <ScreenScaffold>
      <FrostedHeader style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
        <View style={{ flexDirection: lang === 'ar' ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
        <HeaderBack onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{
            fontFamily: fontHead(lang),
            fontSize: T.h5, color: tok.bone, letterSpacing: -0.4,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>{title}</Text>
        </View>
        <WorkspaceChip />
        <RefreshSpinner refreshing={!!refreshing} />
        {onAdd && canWrite && <HeaderAdd onPress={onAdd} />}
        </View>
        {subtitle && (
          <REyebrow style={{
            // Lines up with the title: back button (36) + the gap (12) from the edge.
            marginTop: 4, ...(lang === 'ar' ? { marginRight: 48 } : { marginLeft: 48 }),
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>
            {subtitle}
          </REyebrow>
        )}
      </FrostedHeader>
      <Animated.View style={{
        flex: 1,
        opacity: enter,
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}>
        {children}
      </Animated.View>
    </ScreenScaffold>
  );
}
