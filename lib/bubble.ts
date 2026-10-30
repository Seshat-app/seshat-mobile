import { Alert, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { SeshatBubble } from '../modules/seshat-bubble';

// The Android floating chat bubble: the user turns it on in Profile, Android draws the chat
// head from a notification, and tapping it opens the chat panel (components/ChatPanelRoot).
const ENABLED_KEY = 'chat_bubble_enabled';
const SESSION_KEY = 'chat_bubble_session';

/** Bubbles exist on Android 11 and up. */
export const bubbleSupported = (): boolean => Platform.OS === 'android' && SeshatBubble.isSupported();

export async function isBubbleEnabled(): Promise<boolean> {
  return bubbleSupported() && (await SecureStore.getItemAsync(ENABLED_KEY)) === '1';
}

const text = (lang: 'en' | 'ar') => ({
  title: 'Seshat',
  hint: lang === 'ar' ? 'اضغط للمحادثة مع سيشات أو ماعت' : 'Tap to chat with Seshat or Maat',
});

/**
 * Turns the bubble on or off. Returns the state that took effect: it stays off when the user
 * declines notifications, or lets Android's bubble setting stay off (we open that screen).
 */
export async function setBubbleEnabled(on: boolean, lang: 'en' | 'ar'): Promise<boolean> {
  if (!bubbleSupported()) return false;
  if (!on) {
    SeshatBubble.hide();
    await SecureStore.setItemAsync(ENABLED_KEY, '0');
    return false;
  }
  // The bubble is a notification, so Android 13+ needs the notification permission first.
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(
      lang === 'ar' ? 'الإشعارات مطلوبة' : 'Notifications are needed',
      lang === 'ar'
        ? 'الفقاعة تظهر عبر إشعار. فعّل الإشعارات لسيشات من إعدادات الهاتف.'
        : 'The bubble is shown through a notification. Allow notifications for Seshat in your phone settings.',
    );
    return false;
  }
  const { title, hint } = text(lang);
  SeshatBubble.show(title, hint);
  await SecureStore.setItemAsync(ENABLED_KEY, '1');
  if (!SeshatBubble.bubblesAllowed()) {
    Alert.alert(
      lang === 'ar' ? 'اسمح بالفقاعات' : 'Allow bubbles',
      lang === 'ar'
        ? 'هاتفك لا يسمح لسيشات بعرض الفقاعات بعد. سنفتح الإعدادات لتختار «السماح».'
        : "Your phone isn't letting Seshat show bubbles yet. We'll open the setting so you can allow it.",
      [{ text: 'OK', onPress: () => SeshatBubble.openSettings() }],
    );
  }
  return true;
}

/** Puts the bubble back after a reboot or the user clearing it, if they had it turned on. */
export async function restoreBubble(lang: 'en' | 'ar'): Promise<void> {
  if (!(await isBubbleEnabled()) || SeshatBubble.isShown()) return;
  const { title, hint } = text(lang);
  SeshatBubble.show(title, hint);
}

/** The chat the bubble reopens, so each tap continues the same conversation. */
export const getBubbleSession = () => SecureStore.getItemAsync(SESSION_KEY);
export const saveBubbleSession = (id: string) => SecureStore.setItemAsync(SESSION_KEY, id);
