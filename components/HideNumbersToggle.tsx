import { Pressable, View } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { toggleHideNumbers, useHideNumbers } from '../lib/privacy';
import { RAmount } from './ui';
import type { ComponentProps } from 'react';

/** Small eye beside the big numbers: tap to hide every amount in the app (••••), tap again to show. */
export function HideNumbersToggle({ size = 20 }: { size?: number }) {
  const { tok, lang } = useI18n();
  const hidden = useHideNumbers();
  return (
    <Pressable
      onPress={toggleHideNumbers}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={hidden ? (lang === 'ar' ? 'إظهار الأرقام' : 'Show numbers') : (lang === 'ar' ? 'إخفاء الأرقام' : 'Hide numbers')}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 2 })}
    >
      {hidden ? <EyeOff size={size} color={tok.gold} strokeWidth={1.7} /> : <Eye size={size} color={tok.muted} strokeWidth={1.7} />}
    </Pressable>
  );
}

/** The hero balance with the hide/show eye right beside it. */
export function BalanceAmount(props: ComponentProps<typeof RAmount> & { eye?: number }) {
  const { eye = 20, ...amount } = props;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <RAmount {...amount} />
      <HideNumbersToggle size={eye} />
    </View>
  );
}
