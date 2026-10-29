import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, apiFetch, hasToken, newIdempotencyKey } from './api';

// iOS bank-message capture.
//
// The "Log bank message" Shortcuts action (plugins/ios/SeshatAppIntents.swift) logs the
// message in the BACKGROUND: it posts it straight to the API using a capture-only device
// token it reads from the keychain (written here, below). This file does two jobs:
//   1. keep that device token present and fresh;
//   2. send anything the action could not deliver (offline, token missing) the next time
//      the app is active — those messages are parked as files in Documents/pending-captures/.
const KEY = 'capture_config';
const MAX_AGE_MS = 300 * 24 * 60 * 60 * 1000; // the server issues 365-day tokens
const PENDING_DIR = () => `${FileSystem.documentDirectory}pending-captures/`;

type Config = { token: string; api: string; savedAt: number };

async function ensureDeviceToken(): Promise<void> {
  try {
    if (!(await hasToken())) return;
    const raw = await SecureStore.getItemAsync(KEY);
    if (raw) {
      const c = JSON.parse(raw) as Config;
      if (c.api === API_BASE_URL && Date.now() - c.savedAt < MAX_AGE_MS) return;
    }
    const r = await apiFetch<{ data: { token: string } }>('/capture/device-token', { method: 'POST', body: '{}' });
    const cfg: Config = { token: r.data.token, api: API_BASE_URL, savedAt: Date.now() };
    // AFTER_FIRST_UNLOCK: the automation can fire while the phone is locked.
    await SecureStore.setItemAsync(KEY, JSON.stringify(cfg), { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
  } catch {
    /* retried the next time the app opens */
  }
}

async function flushParked(): Promise<void> {
  try {
    const dir = PENDING_DIR();
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists || !(await hasToken())) return;
    for (const name of await FileSystem.readDirectoryAsync(dir)) {
      const path = dir + name;
      const text = (await FileSystem.readAsStringAsync(path)).trim();
      if (text) {
        try {
          await apiFetch('/capture/auto', {
            method: 'POST',
            headers: { 'Idempotency-Key': newIdempotencyKey() },
            body: JSON.stringify({ text, source: 'sms' }),
          });
        } catch {
          return; // still offline: keep the files for next time
        }
      }
      await FileSystem.deleteAsync(path, { idempotent: true });
    }
  } catch {
    /* nothing parked */
  }
}

export function usePendingCapture(): void {
  useEffect(() => {
    // iOS: the Shortcuts action posts with this token and parks failures as files.
    // Android: the notification-listener task posts with the same token.
    const run = () => { void ensureDeviceToken().then(() => (Platform.OS === 'ios' ? flushParked() : undefined)); };
    run();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') run(); });
    return () => sub.remove();
  }, []);
}
