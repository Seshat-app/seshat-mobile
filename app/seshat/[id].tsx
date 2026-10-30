import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChatThread } from '../../components/ChatThread';

/**
 * Chat view for a single Seshat session. Routes here from /(tabs)/seshat (the session
 * list) when the user taps a row OR taps "+ New chat". Until the first send the URL param
 * can be the literal string "new". The thread itself lives in components/ChatThread.
 */
export default function ChatViewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; text?: string; persona?: string }>();
  return (
    <ChatThread
      sessionId={typeof params.id === 'string' ? params.id : null}
      text={params.text}
      persona={params.persona}
      onBack={() => router.back()}
    />
  );
}
