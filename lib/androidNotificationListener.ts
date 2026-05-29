/**
 * Thin wrapper around `react-native-android-notification-listener`.
 *
 * The native module ONLY exists in custom dev clients / EAS builds - it is
 * NOT in Expo Go. So every call here is wrapped in a try/catch + Platform
 * check so a debug build in Go just returns a "not available" state instead
 * of crashing.
 *
 * Three operations:
 *   - getPermissionStatus(): "authorized" | "denied" | "unknown" | "unavailable"
 *   - requestPermission(): opens the system Notification Access settings page
 *   - subscribeToNotifications(handler): attaches a listener and returns the unsubscribe fn
 *
 * The package emits an event PER notification with shape:
 *   { app: 'com.cibeg.cib', title, text, subText, ... , time }
 *
 * Bank-package whitelist is applied in the subscriber so we ignore Twitter,
 * email, Signal, etc. - never burning a parse call on something that can't
 * possibly be a transaction.
 */
import { Platform, DeviceEventEmitter, type EmitterSubscription } from 'react-native';

export type PermissionStatus = 'authorized' | 'denied' | 'unknown' | 'unavailable';

// Known Egyptian bank / payment Android package names. Used to filter
// incoming notification events before we send them off to the parser.
// Update as you encounter banks the user actually has installed.
export const BANK_PACKAGES = new Set<string>([
  'com.cibeg.cib',                  // CIB
  'com.nbe.bank',                   // NBE
  'eg.com.misr.bm',                 // Banque Misr
  'com.qnb.alahli',                 // QNB Alahli
  'com.alexbank.alexbank',          // Alex Bank
  'com.hsbc.hsbcegypt',             // HSBC Egypt
  'com.telda.app',                  // Telda
  'com.egyptianbanks.einvoice',     // InstaPay
  'com.instapay.app',
  'com.android.mms',                // Stock SMS app (some users)
  'com.google.android.apps.messaging', // Google Messages
]);

let cachedModule: any = null;
function getModule(): any | null {
  if (Platform.OS !== 'android') return null;
  if (cachedModule) return cachedModule;
  try {
    // Dynamic require so the import never fails in Expo Go where the native
    // side is missing - we just get a JS object that throws on first use,
    // which we catch.
    cachedModule = require('react-native-android-notification-listener').default;
    return cachedModule;
  } catch {
    return null;
  }
}

export async function getPermissionStatus(): Promise<PermissionStatus> {
  const mod = getModule();
  if (!mod) return 'unavailable';
  try {
    const status = await mod.getPermissionStatus();
    if (status === 'authorized') return 'authorized';
    if (status === 'denied') return 'denied';
    return 'unknown';
  } catch {
    return 'unavailable';
  }
}

export async function requestPermission(): Promise<void> {
  const mod = getModule();
  if (!mod) return;
  try {
    await mod.requestPermission();
  } catch (err) {
    console.warn('[notif-listener] requestPermission failed:', err);
  }
}

export type NotificationEvent = {
  app: string;
  title?: string;
  text?: string;
  subText?: string;
  time: number;
};

/**
 * Subscribe to incoming notifications. `handler` is called for every event
 * whose `app` package is in BANK_PACKAGES. Returns an unsubscribe function.
 */
export function subscribeToBankNotifications(
  handler: (event: NotificationEvent) => void,
): () => void {
  if (Platform.OS !== 'android') return () => {};
  const sub: EmitterSubscription = DeviceEventEmitter.addListener(
    'onNotificationReceived',
    (event: NotificationEvent) => {
      if (!event?.app || !BANK_PACKAGES.has(event.app)) return;
      try { handler(event); } catch (err) { console.warn('[notif-listener] handler threw:', err); }
    },
  );
  return () => sub.remove();
}

/** Combine title + text + subText into one parseable blob for the LLM. */
export function flattenEventText(event: NotificationEvent): string {
  return [event.title, event.subText, event.text].filter(Boolean).join(' — ');
}
