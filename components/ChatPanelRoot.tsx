import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider } from '../lib/i18n';
import { useAppFonts } from '../lib/useAppFonts';
import { getBubbleSession, saveBubbleSession } from '../lib/bubble';
import { SeshatBubble } from '../modules/seshat-bubble';
import { ChatThread } from './ChatThread';

/**
 * The floating chat panel (Android bubble). A second React root, registered as
 * "SeshatChatPanel" in index.js and hosted by the native BubbleActivity. It has the same
 * providers as the app but no router: the chat header's leading button collapses the panel.
 */
export default function ChatPanelRoot() {
  const fontsLoaded = useAppFonts();
  // undefined = still reading which chat to continue; null = start a new one.
  const [sessionId, setSessionId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    getBubbleSession().then((id) => setSessionId(id ?? null)).catch(() => setSessionId(null));
  }, []);

  const collapse = useCallback(() => SeshatBubble.collapse(), []);

  if (!fontsLoaded || sessionId === undefined) {
    return <View style={{ flex: 1, backgroundColor: '#0D0D0D' }} />;
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nProvider>
          <ChatThread sessionId={sessionId} onBack={collapse} onSessionChange={saveBubbleSession} />
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
