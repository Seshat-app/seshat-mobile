/**
 * Push-notification plumbing.
 *
 * Flow:
 *   1. On app launch (after sign-in), call registerForPushNotifications().
 *      It asks permission if needed, gets the Expo push token, and POSTs
 *      it to /me/push-token along with the device's IANA timezone.
 *   2. On sign-out, call clearPushToken() so the server stops sending to
 *      this device.
 *
 * Errors here are non-fatal. Push is a "nice to have" - the user can still
 * use the app fully without it. So every step logs and returns instead of
 * throwing into the auth flow.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiFetch } from './api';

// Foreground behavior: even when the app is open, show the banner + play a
// sound. The proactive engine only fires while the user is *inactive* in the
// app, so seeing the notification while in-app is the rare case (e.g. they
// just opened the app right as the cron tick fired).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let cachedToken: string | null = null;

function resolveProjectId(): string | undefined {
  const c = Constants as any;
  return (
    c.expoConfig?.extra?.eas?.projectId ??
    c.easConfig?.projectId ??
    c.manifest2?.extra?.eas?.projectId
  );
}

/**
 * Asks for permission (if not already granted), fetches the Expo push token
 * for this device, and registers it with the API. Safe to call multiple
 * times - returns the cached token on subsequent calls.
 *
 * Returns the token string on success, null if anything went wrong
 * (simulator, permission denied, no projectId, network error).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Expo push tokens only work on real devices, not the simulator.
  if (!Device.isDevice) {
    console.log('[push] skipping - not a physical device');
    return null;
  }

  if (cachedToken) return cachedToken;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') {
      console.log('[push] permission not granted');
      return null;
    }

    // Android requires a notification channel to deliver heads-up alerts.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0C0C0E',
      });
    }

    const projectId = resolveProjectId();
    if (!projectId) {
      console.warn('[push] no projectId resolved - cannot fetch Expo push token');
      return null;
    }

    const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenRes.data;
    if (!token) return null;

    cachedToken = token;

    // Send token + device timezone to the API. Timezone is the user's local
    // IANA name; the proactive engine uses it to schedule reminders at the
    // right wall-clock time and respect quiet hours.
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    try {
      await apiFetch('/me/push-token', {
        method: 'POST',
        body: JSON.stringify({ token, timezone }),
      });
    } catch (err) {
      console.warn('[push] failed to save token to API:', err);
    }

    return token;
  } catch (err) {
    console.warn('[push] register threw:', err);
    return null;
  }
}

/**
 * Subscribe to notification taps. When the user taps a habit reminder, the
 * push payload's `data.type === 'habit_reminder'` tells us what to do -
 * for v1 we deep-link to the transactions tab where the user can hit + to
 * add the missing entry. Returns an unsubscribe function for cleanup.
 *
 * `onHabitTap` receives the categoryId so a future iteration can pre-open
 * the AddTransactionSheet pre-filled, but for now the caller just routes.
 */
export function subscribeToNotificationTaps(
  onHabitTap: (data: { categoryId?: string; ledgerId?: string }) => void,
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response?.notification?.request?.content?.data as
      | { type?: string; categoryId?: string; ledgerId?: string }
      | undefined;
    if (data?.type === 'habit_reminder') {
      onHabitTap({ categoryId: data.categoryId, ledgerId: data.ledgerId });
    }
  });
  return () => sub.remove();
}

/**
 * Clears the saved push token on the server so this user stops receiving
 * notifications. Call from sign-out. We don't actually un-register the
 * Expo token from the device - on next sign-in it'll be re-uploaded.
 */
export async function clearPushToken(): Promise<void> {
  cachedToken = null;
  try {
    await apiFetch('/me/push-token', {
      method: 'POST',
      body: JSON.stringify({ token: null }),
    });
  } catch (err) {
    console.warn('[push] failed to clear token on API:', err);
  }
}
