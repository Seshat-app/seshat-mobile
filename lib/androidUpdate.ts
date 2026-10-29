import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';

// Android builds are shared as a direct APK download (no Play Store yet). The newest
// APK sits next to a small manifest on the website; this compares it with the installed
// build so Home can offer "Get the latest version".
//   https://seshat.site/downloads/android.json
//   { "versionCode": 7, "versionName": "1.1.0", "url": "https://seshat.site/downloads/seshat.apk",
//     "notes": "…", "notesAr": "…" }
const MANIFEST_URL = 'https://seshat.site/downloads/android.json';
const DISMISSED_KEY = 'android_update_dismissed';

export type AndroidUpdate = {
  versionCode: number;
  versionName: string;
  url: string;
  notes?: string;
  notesAr?: string;
};

/** The newer build to offer (null on iOS, when up to date, dismissed, or offline). */
export function useAndroidUpdate(): { update: AndroidUpdate | null; dismiss: () => void } {
  const [update, setUpdate] = useState<AndroidUpdate | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let alive = true;
    const check = async () => {
      try {
        const installed = Number(Application.nativeBuildVersion);
        if (!installed) return; // dev builds / Expo Go
        const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } });
        if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return;
        const m = (await res.json()) as AndroidUpdate;
        if (!m?.versionCode || !m.url || m.versionCode <= installed) return;
        const dismissed = Number(await SecureStore.getItemAsync(DISMISSED_KEY).catch(() => null));
        if (alive && dismissed !== m.versionCode) setUpdate(m);
      } catch {
        /* offline: try again next time */
      }
    };
    void check();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void check(); });
    return () => { alive = false; sub.remove(); };
  }, []);

  const dismiss = () => {
    if (update) SecureStore.setItemAsync(DISMISSED_KEY, String(update.versionCode)).catch(() => {});
    setUpdate(null);
  };
  return { update, dismiss };
}
