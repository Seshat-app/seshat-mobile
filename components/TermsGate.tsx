import { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, Linking, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../lib/i18n';
import { apiFetch } from '../lib/api';
import { signOut } from '../lib/auth';
import { SITE_URL } from '../lib/brand';
import { fontBody, fontHead } from '../lib/fonts';
import { radius } from '../lib/theme';
import { RButton } from './ui';
import { useAppLock } from '../lib/appLock';
import { setTermsPending } from '../lib/termsState';

type Terms = { accepted: string | null; current: string; required: boolean };

/**
 * Asks signed-in people to agree to the Terms of Use and Privacy Policy when they have not agreed to the current
 * versions (Google sign-ups, older accounts, or after the documents change). It waits for the app lock first, and it
 * cannot be dismissed: agree and continue, or sign out.
 */
export function TermsGate() {
  const { tok, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { loaded, enabled, locked } = useAppLock();
  const ready = loaded && !(enabled && locked);
  const ar = lang === 'ar';
  const [terms, setTerms] = useState<Terms | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    apiFetch<{ data: { terms?: Terms } }>('/me')
      .then((r) => { if (!alive) return; if (r.data.terms?.required) { setTerms(r.data.terms); setTermsPending(true); } else setTermsPending(false); })
      .catch(() => { if (alive) setTermsPending(false); });
    return () => { alive = false; };
  }, [ready]);

  if (!terms || !ready) return null;
  const agree = async () => {
    setBusy(true); setErr('');
    try {
      await apiFetch('/me/terms', { method: 'POST', body: JSON.stringify({ version: terms.current }) });
      setTerms(null);
      setTermsPending(false);
    } catch { setErr(ar ? 'تعذّر حفظ اختيارك. حاول مرة أخرى.' : 'Could not save your choice. Try again.'); }
    finally { setBusy(false); }
  };
  const link = (path: string, text: string) => (
    <Pressable onPress={() => Linking.openURL(`${SITE_URL}${path}`).catch(() => {})} hitSlop={8}>
      <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 14, color: tok.gold }}>{text}</Text>
    </Pressable>
  );

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', padding: 20 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} showsVerticalScrollIndicator={false}>
          <View style={{ backgroundColor: tok.void, borderRadius: radius.modal, borderWidth: 1, borderColor: tok.border, padding: 22, paddingBottom: 22 + (insets.bottom > 20 ? 0 : 0) }}>
            <Text style={{ fontFamily: fontHead(lang), fontSize: 22, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{ar ? 'قبل أن تتابع' : 'Before you continue'}</Text>
            <Text style={{ marginTop: 10, fontFamily: fontBody(lang), fontSize: 14, lineHeight: 21, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>
              {terms.accepted
                ? (ar ? 'حدّثنا شروط الاستخدام وسياسة الخصوصية. يرجى قراءتهما والموافقة عليهما لتواصل استخدام سيشات.' : 'We updated our Terms of Use and Privacy Policy. Please read and accept them to keep using Seshat.')
                : (ar ? 'يرجى قراءة شروط الاستخدام وسياسة الخصوصية والموافقة عليهما لتواصل استخدام سيشات.' : 'Please read and accept our Terms of Use and Privacy Policy to keep using Seshat.')}
            </Text>
            <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 20, marginTop: 14 }}>
              {link('/terms', ar ? 'شروط الاستخدام' : 'Terms of Use')}
              {link('/privacy', ar ? 'سياسة الخصوصية' : 'Privacy Policy')}
            </View>
            <Pressable onPress={() => setChecked((v) => !v)} style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 12, marginTop: 18 }}>
              <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: checked ? tok.gold : tok.border, backgroundColor: checked ? tok.gold : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                {checked ? <Check size={16} color={tok.void} strokeWidth={3} /> : null}
              </View>
              <Text style={{ flex: 1, fontFamily: fontBody(lang), fontSize: 14, lineHeight: 20, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>
                {ar ? 'قرأت شروط الاستخدام وسياسة الخصوصية وأوافق عليهما' : 'I have read and agree to the Terms of Use and the Privacy Policy'}
              </Text>
            </Pressable>
            {err ? <Text style={{ marginTop: 10, fontFamily: fontBody(lang), fontSize: 12, color: tok.alertText, textAlign: ar ? 'right' : 'left' }}>{err}</Text> : null}
            <View style={{ marginTop: 18, gap: 10 }}>
              <RButton full onPress={agree} disabled={!checked} loading={busy}>{ar ? 'أوافق وأتابع' : 'Agree and continue'}</RButton>
              <RButton full variant="ghost" onPress={async () => { await signOut(); router.replace('/'); }}>{ar ? 'تسجيل الخروج' : 'Sign out'}</RButton>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
