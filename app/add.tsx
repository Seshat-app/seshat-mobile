import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { hasToken } from '../lib/api';
import { requestAdd } from '../lib/pendingAdd';

/**
 * /add?mode=manual|receipt|chat - the landing for the home-screen widget's buttons
 * (seshat://add?mode=...). Signed-out users go to the sign-in screen; everyone else is
 * routed to the add sheet, the receipt scanner, or a fresh Seshat chat.
 */
export default function AddRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      if (!(await hasToken())) { router.replace('/'); return; }
      if (mode === 'chat') {
        router.replace({ pathname: '/seshat/[id]', params: { id: 'new' } });
        return;
      }
      requestAdd(mode === 'receipt' ? 'receipt' : 'manual');
      router.replace('/(tabs)');
    })();
  }, [mode, router]);

  return null;
}
