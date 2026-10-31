import { useState, useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider, useI18n } from '../lib/i18n';
import { AppDataProvider, useAppData } from '../lib/appData';
import { setUnauthorizedHandler } from '../lib/api';
import { WorkspaceSheet } from '../components/WorkspaceSwitcher';
import { AnimatedSplash, SPLASH_VOID } from '../components/AnimatedSplash';
import { initSentry, Sentry } from '../lib/sentry';
import { useAppFonts } from '../lib/useAppFonts';

// Init at module-load so even a crash during font loading is captured.
// No-op when expoConfig.extra.sentryDsn is unset.
initSentry();

// Keep the native splash (a plain void) up until the animated one has painted, so the
// handoff is one continuous screen. The timeout is a safety net if the app never mounts.
SplashScreen.preventAutoHideAsync().catch(() => {});
setTimeout(() => { SplashScreen.hideAsync().catch(() => {}); }, 8000);

function RootStack() {
  const { tok, mode } = useI18n();
  // Workspace switcher sheet lives here at the root so any screen (tabs,
  // root-level sub-screens like /budgets, /orgs/:id, /reports, /reminders,
  // etc.) can open it via openWorkspaceSheet() from AppData context.
  const { workspaceSheetOpen, closeWorkspaceSheet } = useAppData();
  // Animated splash gate. Plays a one-shot mark animation on top of the app, then fades to
  // reveal the routed content underneath. The native splash is a plain void held until this
  // has painted (see SplashScreen.preventAutoHideAsync above), so the two read as one.
  const [splashDone, setSplashDone] = useState(false);

  // When any API call gets a 401, the session is cleared and we route back to
  // sign-in instead of leaving the user on silently-empty screens.
  const router = useRouter();
  useEffect(() => {
    setUnauthorizedHandler(() => router.replace('/'));
    return () => setUnauthorizedHandler(null);
  }, [router]);

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tok.void },
          // Native platform transition (crisp iOS slide + the back-swipe
          // gesture) instead of a fade — a fade reveals the destination screen
          // while it's still mounting, so you see it stutter in.
          animation: 'default',
          // Freeze off-screen screens so they stop re-rendering in the background.
          freezeOnBlur: true,
        }}
      />
      <WorkspaceSheet visible={workspaceSheetOpen} onClose={closeWorkspaceSheet} />
      {!splashDone && (
        <AnimatedSplash
          onReady={() => { SplashScreen.hideAsync().catch(() => {}); }}
          onDone={() => setSplashDone(true)}
        />
      )}
    </>
  );
}

function RootLayoutInner() {
  const fontsLoaded = useAppFonts();

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: SPLASH_VOID }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nProvider>
          <AppDataProvider>
            <RootStack />
          </AppDataProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Sentry.wrap installs the error boundary that captures uncaught
// JS exceptions + unhandled promise rejections from the entire app
// tree. When SENTRY_DSN is unset the wrap is a transparent passthrough.
export default Sentry.wrap(RootLayoutInner);
