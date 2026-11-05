import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SeshatBubble } from '../modules/seshat-bubble';
import { ensureDeviceToken } from './pendingCapture';

/**
 * Android home-screen widgets (Month at a glance, Budgets and cards, Maat's verdict, Quick add).
 * They read live numbers themselves: here the app only hands them the phone's capture token, the API
 * address and the language, then asks them to redraw. Called when the app opens, when the language
 * changes and whenever the user's data changes.
 */
export async function syncAndroidWidgets(lang: 'en' | 'ar'): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await ensureDeviceToken();
    const raw = await SecureStore.getItemAsync('capture_config');
    if (!raw) return;
    const cfg = JSON.parse(raw) as { token?: string; api?: string };
    if (!cfg.token || !cfg.api) return;
    SeshatBubble.setWidgetConfig(cfg.token, cfg.api, lang);
    SeshatBubble.refreshWidgets();
  } catch {
    /* widgets keep showing what they have */
  }
}
