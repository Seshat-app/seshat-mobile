import { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { LiquidBackdrop } from './LiquidBackdrop';
import { isLiquid } from './Glass';
import { useI18n } from '../lib/i18n';
import { radius } from '../lib/theme';
import { fontMono } from '../lib/fonts';

// The three controls every screen header is built from, so they look the same everywhere: the back button, the round "+",
// and a small text pill (like "All" on Notifications). The round "+" and the pill share the workspace chip's gold tint.
const GOLD_TINT = 'rgba(201,168,76,0.22)';

export function HeaderBack({ onPress, label }: { onPress: () => void; label?: string }) {
  const { tok, lang } = useI18n();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label ?? (lang === 'ar' ? 'رجوع' : 'Back')}
      style={({ pressed }) => ({
        width: 36, height: 36, borderRadius: radius.btn,
        backgroundColor: isLiquid() ? 'transparent' : (pressed ? tok.elevated : tok.surface),
        alignItems: 'center', justifyContent: 'center',
      })}
    >
      <LiquidBackdrop radius={radius.btn} fallback="transparent" />
      <ChevronLeft size={20} color={tok.bone} style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }} />
    </Pressable>
  );
}

/** Round, gold-tinted "+": never a solid gold disc, because the plus is gold too and would vanish on it. */
export function HeaderAdd({ onPress, label }: { onPress: () => void; label?: string }) {
  const { tok, lang } = useI18n();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label ?? (lang === 'ar' ? 'إضافة' : 'Add')}
      style={({ pressed }) => ({
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: isLiquid() ? 'transparent' : (pressed ? tok.glowShellBorder : tok.glowShellBg),
        borderWidth: isLiquid() ? 0 : 1, borderColor: tok.glowShellBorder,
        alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <LiquidBackdrop radius={16} tint={GOLD_TINT} fallback="transparent" />
      <Plus size={18} color={tok.gold} strokeWidth={2.4} />
    </Pressable>
  );
}

/** Small round text action for a header ("All"), same family as the workspace chip. */
export function HeaderPill({ onPress, icon, children, label }: { onPress: () => void; icon?: ReactNode; children: ReactNode; label?: string }) {
  const { tok, lang } = useI18n();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, alignSelf: 'center',
        paddingHorizontal: 12, height: 32, borderRadius: 999,
        backgroundColor: isLiquid() ? 'transparent' : (pressed ? tok.glowShellBorder : tok.glowShellBg),
        borderWidth: isLiquid() ? 0 : 1, borderColor: tok.glowShellBorder,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <LiquidBackdrop radius={999} tint={GOLD_TINT} fallback="transparent" />
      {icon}
      <Text style={{ fontFamily: fontMono('regular'), fontSize: 10, color: tok.gold, letterSpacing: 1.2, textTransform: 'uppercase' }}>{children}</Text>
    </Pressable>
  );
}
