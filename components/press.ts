import * as Haptics from 'expo-haptics';
import { ViewStyle } from 'react-native';

/** Instant press-down feel — merge into a Pressable's style callback. */
export const pressFeel = (pressed: boolean): ViewStyle | null =>
  pressed ? { transform: [{ scale: 0.97 }], opacity: 0.9 } : null;

/** Light haptic tick — call from onPressIn on buttons/rows. */
export const hapticLight = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };

/** Selection tick — for toggles / pills / segmented switches. */
export const hapticSelection = () => { Haptics.selectionAsync().catch(() => {}); };
