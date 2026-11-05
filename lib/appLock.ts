/**
 * App lock: Face ID / Touch ID on iPhone, fingerprint / face on Android, with the phone's own passcode as the
 * fallback. When on, Seshat is locked on every launch and after it has been in the background for a short grace
 * period, and the app-switcher preview is covered.
 *
 * Fails OPEN if the phone itself stops having any screen lock or biometrics (the system then cannot authenticate),
 * so a user can never be locked out of their own data.
 */
import { useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const KEY = 'app_lock';
/** Leaving the app for less than this does not re-lock (a permission dialog, a quick app switch). */
export const GRACE_MS = 15_000;

type State = { enabled: boolean; locked: boolean; loaded: boolean };
let state: State = { enabled: false, locked: false, loaded: false };
const subs = new Set<() => void>();
const set = (patch: Partial<State>) => { state = { ...state, ...patch }; subs.forEach((f) => f()); };

export function useAppLock(): State {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    () => state,
  );
}

/** Read the saved choice at startup; a lock that is on starts out locked. */
export async function loadAppLock(): Promise<void> {
  let on = false;
  try { on = (await SecureStore.getItemAsync(KEY)) === '1'; } catch { /* default off */ }
  set({ enabled: on, locked: on, loaded: true });
}

/** Whether this phone can authenticate at all (biometrics enrolled, or a passcode set). */
export async function lockSupport(): Promise<{ ok: boolean; reason?: 'no_hardware' | 'not_enrolled' }> {
  try {
    if (!(await LocalAuthentication.hasHardwareAsync())) return { ok: false, reason: 'no_hardware' };
    if (!(await LocalAuthentication.isEnrolledAsync())) return { ok: false, reason: 'not_enrolled' };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'no_hardware' };
  }
}

type AuthResult = 'ok' | 'cancelled' | 'unavailable';

/** Ask the phone to authenticate. 'unavailable' means it cannot (no screen lock / biometrics any more). */
export async function authenticate(promptMessage: string, cancelLabel: string): Promise<AuthResult> {
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel, disableDeviceFallback: false });
    if (r.success) return 'ok';
    const err = (r as { error?: string }).error ?? '';
    if (err === 'not_enrolled' || err === 'passcode_not_set' || err === 'not_available') return 'unavailable';
    return 'cancelled';
  } catch {
    return 'unavailable';
  }
}

/** Unlock the app. If the phone can no longer authenticate, the lock turns itself off instead of trapping the user. */
export async function unlock(promptMessage: string, cancelLabel: string): Promise<boolean> {
  const r = await authenticate(promptMessage, cancelLabel);
  if (r === 'ok') { set({ locked: false }); return true; }
  if (r === 'unavailable') { await disableLock(); return true; }
  return false;
}

async function disableLock(): Promise<void> {
  set({ enabled: false, locked: false });
  SecureStore.setItemAsync(KEY, '0').catch(() => {});
}

/** Turn the lock on or off. Both need the phone's authentication, so a borrowed unlocked phone cannot change it. */
export async function setAppLockEnabled(next: boolean, promptMessage: string, cancelLabel: string): Promise<boolean> {
  if (next === state.enabled) return true;
  const r = await authenticate(promptMessage, cancelLabel);
  if (r !== 'ok') return false;
  set({ enabled: next, locked: false });
  SecureStore.setItemAsync(KEY, next ? '1' : '0').catch(() => {});
  return true;
}

/** Called when the app comes back to the foreground. */
export function onForeground(backgroundedAt: number | null, now = Date.now()): void {
  if (!state.enabled || state.locked) return;
  if (backgroundedAt !== null && now - backgroundedAt > GRACE_MS) set({ locked: true });
}
