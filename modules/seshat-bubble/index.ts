import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

// The floating chat bubble (Android 11+). On iOS and older Android every call is a no-op.
type Native = {
  isSupported(): boolean;
  bubblesAllowed(): boolean;
  isShown(): boolean;
  show(title: string, hint: string): boolean;
  hide(): void;
  openSettings(): void;
  collapse(): void;
};

const native: Native | null = Platform.OS === 'android' ? requireNativeModule<Native>('SeshatBubble') : null;

export const SeshatBubble = {
  isSupported: () => native?.isSupported() ?? false,
  bubblesAllowed: () => native?.bubblesAllowed() ?? false,
  isShown: () => native?.isShown() ?? false,
  show: (title: string, hint: string) => native?.show(title, hint) ?? false,
  hide: () => native?.hide(),
  openSettings: () => native?.openSettings(),
  collapse: () => native?.collapse(),
};
