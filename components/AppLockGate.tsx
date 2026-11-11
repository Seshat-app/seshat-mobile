import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { ScanFace, Fingerprint } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { fontBody, fontMono } from '../lib/fonts';
import { RButton } from './ui';
import { loadAppLock, onForeground, unlock, useAppLock } from '../lib/appLock';

/**
 * Sits above the whole app. Shows a cover while the app is locked, and also whenever the app is not in the
 * foreground (so the app-switcher preview never shows your balance). Unlocking asks the phone for Face ID /
 * fingerprint, falling back to the phone's passcode.
 */
export function AppLockGate() {
  const { tok, lang } = useI18n();
  const { enabled, locked, loaded, signedIn } = useAppLock();
  const [appState, setAppState] = useState(AppState.currentState);
  const backgroundedAt = useRef<number | null>(null);
  const prompting = useRef(false);

  useEffect(() => { void loadAppLock(); }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') backgroundedAt.current = Date.now();
      if (next === 'active') { onForeground(backgroundedAt.current); backgroundedAt.current = null; }
      setAppState(next);
    });
    return () => sub.remove();
  }, []);

  const ar = lang === 'ar';
  const promptText = ar ? 'افتح سيشات' : 'Unlock Seshat';
  const cancelText = ar ? 'إلغاء' : 'Cancel';

  const tryUnlock = async () => {
    if (prompting.current) return;
    prompting.current = true;
    try { await unlock(promptText, cancelText); } finally { prompting.current = false; }
  };

  // Ask as soon as the lock is showing and the app is in the foreground.
  useEffect(() => {
    if (enabled && signedIn && locked && appState === 'active') void tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, signedIn, locked, appState]);

  if (!loaded) return null; // the splash covers the app until the saved choice is read
  if (!enabled || !signedIn) return null;
  const covered = locked || appState !== 'active';
  if (!covered) return null;

  const Icon = Platform.OS === 'ios' ? ScanFace : Fingerprint;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 998, backgroundColor: tok.void, alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
      <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 1, borderColor: 'rgba(201,168,76,0.35)', backgroundColor: 'rgba(201,168,76,0.08)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={38} color={tok.gold} strokeWidth={1.4} />
      </View>
      <Text style={{ marginTop: 26, color: tok.bone, fontFamily: fontBody(lang, 'semibold'), fontSize: 20 }}>
        {ar ? 'سيشات مقفلة' : 'Seshat is locked'}
      </Text>
      <Text style={{ marginTop: 8, color: tok.muted, fontFamily: fontMono('regular'), fontSize: 12, letterSpacing: 1, textAlign: 'center' }}>
        {Platform.OS === 'ios'
          ? (ar ? 'استخدم Face ID أو رمز الهاتف' : 'USE FACE ID OR YOUR PASSCODE')
          : (ar ? 'استخدم بصمتك أو رمز الهاتف' : 'USE YOUR FINGERPRINT OR PHONE PIN')}
      </Text>
      {locked && appState === 'active' && (
        <View style={{ marginTop: 28, width: '100%', maxWidth: 320, alignSelf: 'center' }}>
          <RButton full onPress={tryUnlock}>{ar ? 'فتح' : 'Unlock'}</RButton>
        </View>
      )}
    </View>
  );
}
