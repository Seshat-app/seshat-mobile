import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { hasToken } from './api';

// iOS: the "Log bank message" Shortcuts action (plugins/ios/SeshatAppIntents.swift) drops
// the message text into Documents/pending-capture.txt and launches the app. We pick it
// up on launch and every time the app becomes active, delete it, and open /capture.
const FILE = () => `${FileSystem.documentDirectory}pending-capture.txt`;

async function consume(): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(FILE());
    if (!info.exists) return false;
    const text = (await FileSystem.readAsStringAsync(FILE())).trim();
    await FileSystem.deleteAsync(FILE(), { idempotent: true });
    if (!text || !(await hasToken())) return false;
    router.push({ pathname: '/capture', params: { text, source: 'sms' } });
    return true;
  } catch {
    return false;
  }
}

export function usePendingCapture(): void {
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let timer: ReturnType<typeof setInterval> | null = null;
    // The action launches the app and only then writes the file, so watch for a few
    // seconds after the app becomes active instead of checking once.
    const watch = () => {
      if (timer) clearInterval(timer);
      let ticks = 0;
      timer = setInterval(async () => {
        ticks += 1;
        if ((await consume()) || ticks >= 16) {
          if (timer) clearInterval(timer);
          timer = null;
        }
      }, 500);
    };
    watch();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') watch(); });
    return () => { if (timer) clearInterval(timer); sub.remove(); };
  }, []);
}
