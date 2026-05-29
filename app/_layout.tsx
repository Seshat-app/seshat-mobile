import { useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Syne_400Regular, Syne_500Medium, Syne_600SemiBold, Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne';
import { DMMono_300Light, DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { Cairo_400Regular, Cairo_500Medium, Cairo_600SemiBold, Cairo_700Bold, Cairo_800ExtraBold } from '@expo-google-fonts/cairo';
import { I18nProvider, useI18n } from '../lib/i18n';
import { AppDataProvider, useAppData } from '../lib/appData';
import { WorkspaceSheet } from '../components/WorkspaceSwitcher';
import { AnimatedSplash } from '../components/AnimatedSplash';
import { initSentry, Sentry } from '../lib/sentry';

// Init at module-load so even a crash during font loading is captured.
// No-op when expoConfig.extra.sentryDsn is unset.
initSentry();

function RootStack() {
  const { tok, mode } = useI18n();
  // Workspace switcher sheet lives here at the root so any screen (tabs,
  // root-level sub-screens like /budgets, /orgs/:id, /reports, /reminders,
  // etc.) can open it via openWorkspaceSheet() from AppData context.
  const { workspaceSheetOpen, closeWorkspaceSheet } = useAppData();
  // Animated splash gate. Plays a one-shot radar-sweep animation on top of
  // the app on first launch, then fades to reveal the routed content
  // underneath. The native static splash (from app.json) covers the very
  // first 200-400 ms before this component is mounted; this picks up from
  // there for a smooth handoff.
  const [splashDone, setSplashDone] = useState(false);
  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} backgroundColor={tok.void} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tok.void },
          animation: 'fade',
        }}
      />
      <WorkspaceSheet visible={workspaceSheetOpen} onClose={closeWorkspaceSheet} />
      {!splashDone && <AnimatedSplash onDone={() => setSplashDone(true)} />}
    </>
  );
}

function RootLayoutInner() {
  const [fontsLoaded] = useFonts({
    Syne_400Regular, Syne_500Medium, Syne_600SemiBold, Syne_700Bold, Syne_800ExtraBold,
    DMMono_300Light, DMMono_400Regular, DMMono_500Medium,
    Cairo_400Regular, Cairo_500Medium, Cairo_600SemiBold, Cairo_700Bold, Cairo_800ExtraBold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#0D0D0D' }} />;
  }

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AppDataProvider>
          <RootStack />
        </AppDataProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

// Sentry.wrap installs the error boundary that captures uncaught
// JS exceptions + unhandled promise rejections from the entire app
// tree. When SENTRY_DSN is unset the wrap is a transparent passthrough.
export default Sentry.wrap(RootLayoutInner);
