import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { apiFetch, hasToken } from './api';

/**
 * Count a feature as used ("the Savings screen was opened"). Fire and forget: it never blocks or fails the screen, only a
 * known event name is sent, and the server drops it when the person has switched usage statistics off.
 */
export function trackEvent(name: string): void {
  void (async () => {
    try {
      if (!(await hasToken())) return;
      await apiFetch('/events', { method: 'POST', body: JSON.stringify({ name, platform: Platform.OS === 'ios' ? 'ios' : 'android', appVersion: Constants.expoConfig?.version }) });
    } catch { /* never throws */ }
  })();
}
