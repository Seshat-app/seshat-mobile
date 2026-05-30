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

/**
 * Hard pre-filter applied to every incoming Android notification BEFORE
 * we hand the body to the API parser. Goal: keep the LLM call cost-effective
 * and respectful (we never send Twitter, Slack, or random promo content
 * upstream) while staying bank-agnostic.
 *
 * The old approach kept a hardcoded BANK_PACKAGES whitelist. That broke
 * the moment a user installed a bank we hadn't seen (Baraka, Mashreq NEO,
 * Suez Canal Bank, ...). New approach: any notification whose text contains
 * a currency code AND a known financial verb counts as a candidate. The
 * universal API parser handles the rest.
 *
 * The two SMS-relay app IDs are still treated as fast-accept (they're
 * almost always banks) but they're not REQUIRED - a notification from a
 * banking app's own push system passes too as long as the content matches.
 */
const FAST_ACCEPT_PACKAGES = new Set<string>([
  'com.android.mms',                     // Stock SMS app
  'com.google.android.apps.messaging',   // Google Messages
  'com.samsung.android.messaging',       // Samsung Messages
]);

// Currency codes we accept on either side of the amount. The user's
// configured currency is the most common but we include the common ones
// so a notification in a foreign currency (USD travel charge, AED) still
// triggers a parse.
const CURRENCY_HINT = /\b(EGP|USD|EUR|GBP|SAR|AED|KWD|QAR|OMR|BHD|JPY|CHF|TRY)\b/i;

// Universal financial-verb fingerprint. Matches across English + Arabic
// across every Egyptian bank's notification format I've seen. Tuned to
// reject OTP / login / promo content even when the body mentions money.
const FINANCIAL_VERB = new RegExp(
  [
    // Common English transaction verbs
    'has\\s+been\\s+used',     // "Card ending with X has been used"
    'was\\s+debited',          // Baraka IPN
    'was\\s+credited',         // Baraka IPN
    'debited\\s+with',
    'credited\\s+with',
    'purchase\\s+of',
    'payment\\s+of',
    'transferred',
    'salary\\s+has\\s+been',
    'sent\\s+to',
    'received\\s+from',
    'withdrawn',
    'deposit',
    'spent',
    // Arabic financial verbs
    'تم\\s+خصم',               // was deducted
    'تم\\s+إيداع',             // was deposited
    'تم\\s+سحب',               // was withdrawn
    'حُول',                     // transferred
    'استلام',                  // receipt
    'راتب',                    // salary
    'رصيد(?!\\s*استفسار)',     // balance (but not "balance inquiry")
  ].join('|'),
  'i',
);

// Hard-reject patterns. These ALWAYS skip parsing, even if other signals
// look transaction-like. Saves an LLM round-trip and avoids logging
// phantom OTPs as 6-digit "amounts".
const NON_TRANSACTION = new RegExp(
  [
    'OTP',
    'verification\\s+code',
    'one[-\\s]time\\s+(?:code|password)',
    'do\\s+not\\s+share',
    'تم\\s+إصدار\\s+كشف',       // statement issued
    'كشف\\s+الحساب',
    'statement\\s+issued',
    'e[-]?statement',
    'الزمن\\s+السري',           // PIN
    'PIN\\s+code',
    'available\\s+balance.*?(?:only|inquiry|check)',
    'login\\s+(?:from|attempt|alert)',
    'تسجيل\\s+الدخول',          // login
  ].join('|'),
  'i',
);

/**
 * Decide whether a notification's body looks like a real bank transaction
 * worth sending to the parser. Universal across banks - no package list
 * required. Exposed for testing.
 */
export function isBankTransactionCandidate(text: string): boolean {
  if (!text || text.length < 12) return false;
  if (NON_TRANSACTION.test(text)) return false;
  return CURRENCY_HINT.test(text) && FINANCIAL_VERB.test(text);
}

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
 * Subscribe to incoming Android notifications. The handler fires for every
 * event whose content fingerprint matches a bank transaction - bank-
 * agnostic, no package whitelist required.
 *
 * Fast-path: notifications from the SMS apps are pre-accepted (they're
 * almost always banks anyway) but still gated by the content check, so a
 * stray Telegram-via-SMS message doesn't get logged as a "100 EGP" event.
 */
export function subscribeToBankNotifications(
  handler: (event: NotificationEvent) => void,
): () => void {
  if (Platform.OS !== 'android') return () => {};
  const sub: EmitterSubscription = DeviceEventEmitter.addListener(
    'onNotificationReceived',
    (event: NotificationEvent) => {
      if (!event) return;
      const body = flattenEventText(event);
      const fromMessagingApp = event.app ? FAST_ACCEPT_PACKAGES.has(event.app) : false;
      // Even messaging-app events have to pass the content filter so a
      // friend texting "owe you 50 EGP" doesn't trigger a phantom log.
      if (!isBankTransactionCandidate(body)) return;
      // Anything else: the content filter decides. App package is just
      // metadata - we don't gate on it. This is the heart of the bank-
      // agnostic redesign.
      void fromMessagingApp; // intentionally unused; kept for future telemetry
      try { handler(event); } catch (err) { console.warn('[notif-listener] handler threw:', err); }
    },
  );
  return () => sub.remove();
}

/** Combine title + text + subText into one parseable blob for the LLM. */
export function flattenEventText(event: NotificationEvent): string {
  return [event.title, event.subText, event.text].filter(Boolean).join(' — ');
}
