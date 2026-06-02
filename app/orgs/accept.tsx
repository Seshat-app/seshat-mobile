import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useI18n } from '../../lib/i18n';
import { useAppData } from '../../lib/appData';
import { hasToken } from '../../lib/api';
import { acceptInvite } from '../../lib/orgs';
import { SeshatMark } from '../../components/SeshatMark';
import { ScreenScaffold } from '../../components/Screen';
import { RButton } from '../../components/ui';
import { fontHead, fontMono, fontBody } from '../../lib/fonts';

type Status = 'pending' | 'success' | 'error' | 'needs-auth';

/**
 * /orgs/accept?token=<token>
 *
 * Deep-link target for the invite email. The email links to
 * https://seshat.site/orgs/accept?token=... which on mobile resolves
 * through the seshat:// scheme to this screen.
 *
 * Flow:
 *   - No token in URL -> error (someone hit a bare URL).
 *   - Not signed in -> shunt to /index with the token preserved as a
 *     query param so the auth screen knows to accept it post-login.
 *     (We bounce to /index for now; deeper deferred-deep-link work is
 *      a v2 polish.)
 *   - Otherwise -> POST /orgs/invites/accept, switch active workspace
 *     to the new org, route to its detail screen.
 */
export default function AcceptInviteScreen() {
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  const router = useRouter();
  const { tok, lang } = useI18n();
  const { switchLedger, refresh } = useAppData();
  const [status, setStatus] = useState<Status>('pending');
  const [error, setError] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);

  useEffect(() => {
    const tokenStr = typeof token === 'string' ? token : Array.isArray(token) ? token[0] : '';
    if (!tokenStr) {
      setStatus('error');
      setError(lang === 'ar' ? 'رابط الدعوة فارغ.' : 'Invite link is empty.');
      return;
    }
    (async () => {
      try {
        const signedIn = await hasToken();
        if (!signedIn) {
          // Need the user to sign in or sign up before they can accept. We
          // do not preserve the token across auth right now - a v2 polish.
          // Just take them to the auth screen with a message.
          setStatus('needs-auth');
          return;
        }
        const org = await acceptInvite(tokenStr);
        setOrgName(org.name);
        await switchLedger(org.ledgerId);
        await refresh();
        setStatus('success');
        // Small delay so the user sees the confirmation before the route
        // change. Reads less janky than an instant cut.
        setTimeout(() => {
          router.replace({ pathname: '/orgs/[id]', params: { id: org.id } });
        }, 600);
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [token, lang, refresh, router, switchLedger]);

  const arText = lang === 'ar';
  return (
    <ScreenScaffold style={{
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 32,
    }}>
      <SeshatMark size={64} gold={tok.gold} lightRing />

      {status === 'pending' && (
        <>
          <Text style={{
            marginTop: 24,
            fontFamily: fontHead(lang), fontSize: 22, color: tok.bone, textAlign: 'center',
            writingDirection: arText ? 'rtl' : 'ltr',
          }}>
            {arText ? 'جارٍ قبول الدعوة...' : 'Accepting invitation...'}
          </Text>
          <ActivityIndicator size="small" color={tok.gold} style={{ marginTop: 18 }} />
        </>
      )}

      {status === 'success' && (
        <>
          <Text style={{
            marginTop: 24,
            fontFamily: fontHead(lang), fontSize: 22, color: tok.bone, textAlign: 'center',
            writingDirection: arText ? 'rtl' : 'ltr',
          }}>
            {arText ? 'مرحبًا بكِ في' : 'Welcome to'}
          </Text>
          <Text style={{
            marginTop: 6,
            fontFamily: fontHead(lang), fontSize: 24, color: tok.gold,
            textAlign: 'center',
            writingDirection: arText ? 'rtl' : 'ltr',
          }}>
            {orgName ?? ''}
          </Text>
        </>
      )}

      {status === 'needs-auth' && (
        <>
          <Text style={{
            marginTop: 24,
            fontFamily: fontHead(lang), fontSize: 22, color: tok.bone, textAlign: 'center',
            writingDirection: arText ? 'rtl' : 'ltr',
          }}>
            {arText ? 'سجّلي الدخول لإكمال القبول' : 'Sign in to accept the invite'}
          </Text>
          <Text style={{
            marginTop: 12,
            fontFamily: fontBody(lang), fontSize: 14, color: tok.muted,
            textAlign: 'center', lineHeight: 21,
            writingDirection: arText ? 'rtl' : 'ltr',
          }}>
            {arText
              ? 'افتحي الرابط مرة أخرى من بريدكِ بعد تسجيل الدخول.'
              : 'After signing in, open the link from your email again.'}
          </Text>
          <RButton
            full
            onPress={() => router.replace('/')}
            style={{ marginTop: 28 }}
          >
            {arText ? 'الذهاب لتسجيل الدخول' : 'Go to sign in'}
          </RButton>
        </>
      )}

      {status === 'error' && (
        <>
          <Text style={{
            marginTop: 24,
            fontFamily: fontHead(lang), fontSize: 22, color: tok.bone, textAlign: 'center',
            writingDirection: arText ? 'rtl' : 'ltr',
          }}>
            {arText ? 'فشل قبول الدعوة' : 'Could not accept invite'}
          </Text>
          <Text style={{
            marginTop: 12,
            fontFamily: fontMono('regular'), fontSize: 11, color: tok.muted,
            textAlign: 'center', letterSpacing: 0.4,
          }}>
            {error}
          </Text>
          <RButton
            variant="secondary"
            full
            onPress={() => router.replace('/(tabs)')}
            style={{ marginTop: 28 }}
          >
            {arText ? 'الرجوع للتطبيق' : 'Back to app'}
          </RButton>
        </>
      )}
    </ScreenScaffold>
  );
}
