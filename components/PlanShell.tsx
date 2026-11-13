import { ReactNode, useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Easing, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { LiquidBackdrop } from './LiquidBackdrop';
import { isLiquid } from './Glass';
import { useI18n } from '../lib/i18n';
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
      <FrostedHeader style={{
        paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', gap: 12,
      }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => ({
            width: 36, height: 36, borderRadius: radius.btn,
            backgroundColor: isLiquid() ? 'transparent' : (pressed ? tok.elevated : tok.surface),
            alignItems: 'center', justifyContent: 'center',
          })}
        >
          <LiquidBackdrop radius={radius.btn} fallback="transparent" />
          <ChevronLeft size={20} color={tok.bone} style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{
            fontFamily: fontHead(lang),
            fontSize: T.h5, color: tok.bone, letterSpacing: -0.4,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>{title}</Text>
          {subtitle && (
            <REyebrow style={{ marginTop: 3, textAlign: lang === 'ar' ? 'right' : 'left' }}>
              {subtitle}
            </REyebrow>
          )}
        </View>
        <WorkspaceChip />
        <RefreshSpinner refreshing={!!refreshing} />
        {onAdd && (
          <Pressable
            onPress={onAdd}
            hitSlop={10}
            style={({ pressed }) => ({
              // Same family as the workspace chip beside it: a round, gold-tinted control (same tint, same border rule),
              // never a solid gold block - the plus is gold too, so on a solid gold disc it would vanish.
              width: 32, height: 32, borderRadius: 16,
              backgroundColor: isLiquid() ? 'transparent' : (pressed ? tok.glowShellBorder : tok.glowShellBg),
              borderWidth: isLiquid() ? 0 : 1, borderColor: tok.glowShellBorder,
              alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <LiquidBackdrop radius={16} tint="rgba(201,168,76,0.22)" fallback="transparent" />
            <Plus size={18} color={tok.gold} strokeWidth={2.4} />
          </Pressable>
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
