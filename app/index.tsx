import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { hasToken } from '../lib/api';
import {
  signInWithPassword, signInWithGoogle, registerSendCode, registerVerifyCode, registerComplete,
  requestPasswordReset, verifyPasswordReset, completePasswordReset,
} from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import {
  AuthChrome, AuthHero, AuthField, AuthLink, AuthBackLink, AuthError, RButton,
  SSOButton, AuthOr,
} from '../components/auth';
import { RadarMark } from '../components/RadarMark';

// Required for expo-auth-session to dismiss the in-app browser cleanly after
// the OAuth provider redirects back to the app. Safe to call at module scope.
WebBrowser.maybeCompleteAuthSession();

// Native OAuth clients (one per platform), registered in Google Cloud
// Console project 1051327904371. We dropped the Web client + Expo auth
// proxy because:
//   - Expo's auth.expo.io proxy is deprecated and brittle.
//   - "Custom scheme URIs are not allowed for WEB client type" was the
//     recurring failure - native clients accept the seshat:// scheme that
//     expo-auth-session generates by default.
// Each native client is bound to (bundle_id) for iOS and (package_name +
// SHA-1) for Android, so they only work for our specific app build.
const GOOGLE_IOS_CLIENT_ID = '1051327904371-b8thnkjmc2v9siki084ferbn95r5fm6f.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = '1051327904371-9i33rhse49f26j14h93jteaq8k68oipg.apps.googleusercontent.com';

type AuthView =
  | 'login'
  | 'register'
  | 'verify'
  | 'completeReg'
  | 'pickSegment'  // post-registration: Individual or Organization?
  | 'forgot'
  | 'forgotVerify'
  | 'forgotComplete';

export default function AuthRouter() {
  const router = useRouter();
  const { tok, lang, t } = useI18n();
  const [view, setView] = useState<AuthView>('login');
  const [checking, setChecking] = useState(true);

  // Form state
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [name, setName] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [code, setCode] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Google sign-in via native OAuth clients - no proxy, no Web client.
  // expo-auth-session picks the platform-specific client at runtime and
  // generates a redirectUri that the native client accepts (the iOS
  // reversed-client-id scheme on iOS, the seshat:// scheme on Android).
  // The response.params include `id_token` which we hand to the API for
  // verification.
  const [googleRequest, googleResponse, promptGoogle] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    scopes: ['openid', 'email', 'profile'],
  });

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken = (googleResponse.params as Record<string, string>).id_token;
      if (!idToken) {
        setErr('Google did not return an ID token');
        setBusy(false);
        return;
      }
      (async () => {
        setBusy(true);
        const r = await signInWithGoogle(idToken);
        if (r.success) goApp();
        else setErr(r.error ?? 'Google sign-in failed');
        setBusy(false);
      })();
    } else if (googleResponse?.type === 'error') {
      setErr('Google sign-in was cancelled');
      setBusy(false);
    } else if (googleResponse?.type === 'dismiss' || googleResponse?.type === 'cancel') {
      setBusy(false);
    }
  }, [googleResponse]);

  useEffect(() => {
    hasToken().then((has) => {
      if (has) router.replace('/(tabs)');
      else setChecking(false);
    });
  }, []);

  const goApp = () => router.replace('/(tabs)');

  const submitGoogle = async () => {
    if (!googleRequest) return;
    setErr(''); setBusy(true);
    await promptGoogle();
    // The redirect is handled by the useEffect above. We keep busy=true until
    // it resolves so users can't tap twice.
  };

  const submitLogin = async () => {
    if (!email || !pwd) return;
    setErr(''); setBusy(true);
    const r = await signInWithPassword(email, pwd);
    if (r.success) goApp();
    else setErr(r.error ?? 'Sign-in failed');
    setBusy(false);
  };

  const submitRegister = async () => {
    if (!email.includes('@')) { setErr('Enter a valid email'); return; }
    setErr(''); setBusy(true);
    const r = await registerSendCode(email);
    if (r.success && r.sessionId) { setSessionId(r.sessionId); setView('verify'); }
    else setErr(r.error ?? 'Failed to send code');
    setBusy(false);
  };

  const submitVerify = async () => {
    if (!code) { setErr('Enter the code'); return; }
    setErr(''); setBusy(true);
    const r = await registerVerifyCode(sessionId, code);
    if (r.success) setView('completeReg');
    else setErr(r.error ?? 'Invalid code');
    setBusy(false);
  };

  const submitComplete = async () => {
    if (pwd !== pwd2) { setErr('Passwords do not match'); return; }
    if (pwd.length < 8) { setErr('Min. 8 characters'); return; }
    setErr(''); setBusy(true);
    const r = await registerComplete(sessionId, name || email.split('@')[0], pwd);
    if (r.success) {
      // After registration, ask whether this is an individual or an org
      // account before landing them in the tabs. Mirrors the web
      // questionnaire's `individual` vs `team` segmentation.
      setView('pickSegment');
    } else {
      setErr(r.error ?? 'Registration failed');
    }
    setBusy(false);
  };

  // pickSegment handlers. Individual: just go home (personal ledger is the
  // default for any new user). Organization: go home first so the tabs
  // mount and AppData has a chance to refresh, then push the org-create
  // screen so the founder lands on the form with the keyboard up.
  const pickIndividual = () => {
    goApp();
  };
  const pickOrganization = () => {
    goApp();
    // Defer so the tabs are mounted before we push into /orgs/new.
    setTimeout(() => router.push('/orgs/new'), 50);
  };

  const submitForgot = async () => {
    if (!email.includes('@')) { setErr('Enter a valid email'); return; }
    setErr(''); setBusy(true);
    const r = await requestPasswordReset(email);
    if (r.success && r.sessionId) {
      setSessionId(r.sessionId);
      setCode('');
      setView('forgotVerify');
    } else {
      setErr(r.error ?? 'Failed to send code');
    }
    setBusy(false);
  };

  const submitForgotVerify = async () => {
    if (!code) { setErr('Enter the code'); return; }
    setErr(''); setBusy(true);
    const r = await verifyPasswordReset(sessionId, code);
    if (r.success) {
      setPwd(''); setPwd2('');
      setView('forgotComplete');
    } else {
      setErr(r.error ?? 'Invalid code');
    }
    setBusy(false);
  };

  const submitForgotComplete = async () => {
    if (pwd !== pwd2) { setErr('Passwords do not match'); return; }
    if (pwd.length < 8) { setErr('Min. 8 characters'); return; }
    setErr(''); setBusy(true);
    const r = await completePasswordReset(sessionId, pwd);
    if (r.success) goApp();
    else setErr(r.error ?? 'Password reset failed');
    setBusy(false);
  };

  // Resend handlers for the two verify screens. Both re-issue the send-code
  // call with the same email, which on the API side allocates a fresh
  // sessionId. We swap that in so the next verify-code call hits the new
  // session. Old session is left to TTL-expire on the server.
  const [resentAt, setResentAt] = useState<number | null>(null);
  const resendRegister = async () => {
    setErr(''); setBusy(true);
    const r = await registerSendCode(email);
    if (r.success && r.sessionId) {
      setSessionId(r.sessionId);
      setResentAt(Date.now());
      setCode('');
    } else {
      setErr(r.error ?? 'Failed to resend');
    }
    setBusy(false);
  };
  const resendForgot = async () => {
    setErr(''); setBusy(true);
    const r = await requestPasswordReset(email);
    if (r.success && r.sessionId) {
      setSessionId(r.sessionId);
      setResentAt(Date.now());
      setCode('');
    } else {
      setErr(r.error ?? 'Failed to resend');
    }
    setBusy(false);
  };

  const switchView = (v: AuthView) => { setView(v); setErr(''); };

  if (checking) {
    return <View style={{ flex: 1, backgroundColor: tok.void }} />;
  }

  // ───────── LOGIN ─────────
  if (view === 'login') {
    return (
      <AuthChrome
        // Sign-up CTA lives in the always-visible header, not at the bottom
        // of the footer where it was getting cut off on short screens or
        // when the keyboard opened. Footer keeps the primary action chain
        // (sign in, OR, Google) but no longer trails with a second prompt.
        headerCta={
          <Pressable onPress={() => switchView('register')} hitSlop={8}>
            <Text style={{
              color: tok.gold, fontFamily: fontBody(lang, 'semibold'), fontSize: 13,
            }}>
              {lang === 'ar' ? `${t('signUp')} ←` : `${t('signUp')} →`}
            </Text>
          </Pressable>
        }
        footer={
          <>
            <RButton full onPress={submitLogin} disabled={busy}>{busy ? t('pleaseWait') : t('signIn')}</RButton>
            <AuthOr />
            <SSOButton
              provider="google"
              label={lang === 'ar' ? 'المتابعة بجوجل' : 'Continue with Google'}
              onPress={submitGoogle}
            />
          </>
        }
      >
        <AuthHero eyebrow={t('authVersion')} title={t('loginTitle')} sub={t('loginSub')} />
        <AuthError message={err} />
        <AuthField
          label={t('emailOrUsername')} value={email} onChange={setEmail}
          placeholder={t('emailPlaceholder')} keyboardType="email-address"
          autoComplete="email" textContentType="username" autoFocus
        />
        <AuthField
          label={t('password')} value={pwd} onChange={setPwd}
          placeholder={t('passwordPlaceholder')} secureTextEntry
          textContentType="password"
          secondary={<AuthLink gold onPress={() => switchView('forgot')}>{t('forgotIt')}</AuthLink>}
        />
      </AuthChrome>
    );
  }

  // ───────── REGISTER (step 1: email) ─────────
  if (view === 'register') {
    return (
      <AuthChrome
        footer={
          <>
            <RButton full onPress={submitRegister} disabled={busy}>
              {busy ? t('pleaseWait') : (lang === 'ar' ? 'إرسال رمز التحقق' : 'Send verification code')}
            </RButton>
            <View style={{
              marginTop: 18,
              flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
              justifyContent: 'center', alignItems: 'center', gap: 8,
            }}>
              <Text style={{ color: tok.muted, fontFamily: fontBody(lang), fontSize: 13 }}>{t('haveAccount')}</Text>
              <Pressable onPress={() => switchView('login')}>
                <Text style={{ color: tok.gold, fontFamily: fontBody(lang, 'semibold'), fontSize: 13 }}>{t('signIn')} →</Text>
              </Pressable>
            </View>
          </>
        }
      >
        <AuthHero eyebrow={t('authVersion')} title={t('registerTitle')} sub={t('registerSub')} />
        <AuthError message={err} />
        <AuthField
          label={t('email')} value={email} onChange={setEmail}
          placeholder={t('emailPlaceholder')} keyboardType="email-address"
          autoComplete="email" textContentType="emailAddress" autoFocus
        />
      </AuthChrome>
    );
  }

  // ───────── VERIFY EMAIL (step 2: code) ─────────
  if (view === 'verify') {
    return (
      <AuthChrome
        footer={
          <>
            <RButton full onPress={submitVerify} disabled={busy}>
              {busy ? t('pleaseWait') : t('verifyAction')}
            </RButton>
            <ResendCodeRow
              onResend={resendRegister}
              busy={busy}
              resentAt={resentAt}
              lang={lang}
              tok={tok}
            />
            <AuthBackLink onPress={() => switchView('register')} label={lang === 'ar' ? 'بريد مختلف' : 'Use a different email'} />
          </>
        }
      >
        <AuthHero eyebrow={t('authVersion')} title={t('verifyTitle')} sub={`${t('verifySub')} ${email}`} />
        <AuthError message={err} />
        <AuthField
          label={t('verifyCode')} value={code} onChange={setCode}
          placeholder="000000" keyboardType="number-pad"
          textContentType="oneTimeCode" autoFocus
        />
        <Text style={{
          marginTop: 14,
          fontFamily: fontMono('regular'), fontSize: 10, letterSpacing: 1.2,
          color: tok.muted, textAlign: lang === 'ar' ? 'right' : 'left',
        }}>
          {lang === 'ar'
            ? 'لم يصلكِ الرمز؟ تحقّقي من مجلد البريد المزعج / السبام أو اضغطي إعادة الإرسال.'
            : "Didn't get the code? Check your spam folder, or tap Resend below."}
        </Text>
      </AuthChrome>
    );
  }

  // ───────── COMPLETE REGISTRATION (step 3: name + password) ─────────
  if (view === 'completeReg') {
    return (
      <AuthChrome
        footer={
          <>
            <RButton full onPress={submitComplete} disabled={busy || (!!pwd2 && pwd !== pwd2)}>
              {busy ? t('pleaseWait') : t('createAccount')}
            </RButton>
            <Text style={{
              marginTop: 14,
              fontFamily: fontMono('regular'), fontSize: 10, letterSpacing: 0.4,
              color: tok.muted, textAlign: 'center', lineHeight: 16,
            }}>{t('termsCopy')}</Text>
          </>
        }
      >
        <AuthHero eyebrow={t('authVersion')} title={t('almostThere')} sub={t('registerSub')} />
        <AuthError message={err} />
        <AuthField
          label={t('username')} value={name} onChange={setName}
          placeholder={t('namePlaceholder')}
          autoComplete="username" textContentType="username" autoFocus
        />
        <AuthField
          label={t('password')} value={pwd} onChange={setPwd}
          placeholder={t('passwordPlaceholder')} secureTextEntry
          textContentType="newPassword"
        />
        <AuthField
          label={t('confirmPassword')} value={pwd2} onChange={setPwd2}
          placeholder={lang === 'ar' ? 'إعادة الإدخال' : 'Re-enter password'}
          secureTextEntry textContentType="newPassword"
        />
      </AuthChrome>
    );
  }

  // ───────── PICK SEGMENT (after registration) ─────────
  // Mirrors the seshat-web questionnaire's `individual` vs `team` choice.
  // Individual users land on Personal directly; Organization users go
  // straight to the org-create form after the tabs mount.
  if (view === 'pickSegment') {
    return (
      <AuthChrome
        footer={
          <Pressable onPress={pickIndividual} hitSlop={6} style={({ pressed }) => ({
            paddingVertical: 12, alignItems: 'center',
            opacity: pressed ? 0.6 : 1,
          })}>
            <Text style={{
              color: tok.muted, fontFamily: fontMono('regular'), fontSize: 11, letterSpacing: 1.4,
            }}>
              {lang === 'ar' ? 'تخطّي - أنا فرد' : "SKIP - I'M AN INDIVIDUAL"}
            </Text>
          </Pressable>
        }
      >
        <AuthHero
          eyebrow={t('authVersion')}
          title={lang === 'ar' ? 'لمن هذا الحساب؟' : 'Who is this account for?'}
          sub={lang === 'ar'
            ? 'يمكنكِ تغيير ذلك أو إضافة منظمة لاحقًا من الإعدادات.'
            : 'You can change this or add an organization later from settings.'}
        />
        <View style={{ marginTop: 20, gap: 12 }}>
          <SegmentCard
            title={lang === 'ar' ? 'فرد' : 'Individual'}
            sub={lang === 'ar' ? 'لتتبع مصاريفي الشخصية فقط.' : 'Track my own money. Personal ledger only.'}
            onPress={pickIndividual}
            tok={tok}
            lang={lang}
          />
          <SegmentCard
            title={lang === 'ar' ? 'منظمة' : 'Organization'}
            sub={lang === 'ar' ? 'لمشاركتها مع فريقي. ميزانية مشتركة.' : 'Share with my team. A shared ledger.'}
            onPress={pickOrganization}
            tok={tok}
            lang={lang}
            highlight
          />
        </View>
      </AuthChrome>
    );
  }

  // ───────── FORGOT PASSWORD ─────────
  if (view === 'forgot') {
    return (
      <AuthChrome
        footer={
          <>
            <RButton full onPress={submitForgot} disabled={busy}>
              {busy ? t('pleaseWait') : t('sendResetLink')}
            </RButton>
            <AuthBackLink onPress={() => switchView('login')} label={t('backToSignIn')} />
          </>
        }
      >
        <AuthHero eyebrow={t('authVersion')} title={t('forgotTitle')} sub={t('forgotSub')} />
        <AuthError message={err} />
        <AuthField
          label={t('email')} value={email} onChange={setEmail}
          placeholder={t('emailPlaceholder')} keyboardType="email-address"
          autoComplete="email" textContentType="emailAddress" autoFocus
        />
      </AuthChrome>
    );
  }

  // ───────── FORGOT PASSWORD — verify code ─────────
  if (view === 'forgotVerify') {
    return (
      <AuthChrome
        footer={
          <>
            <RButton full onPress={submitForgotVerify} disabled={busy}>
              {busy ? t('pleaseWait') : t('verifyAction')}
            </RButton>
            <ResendCodeRow
              onResend={resendForgot}
              busy={busy}
              resentAt={resentAt}
              lang={lang}
              tok={tok}
            />
            {/* Escape hatch: if the user got here because they thought they
                had an account but actually don't (silent no-op on the server
                for unknown emails), let them pivot to register without
                making them figure out the back path themselves. */}
            <View style={{
              marginTop: 6,
              flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
              justifyContent: 'center', alignItems: 'center', gap: 6,
            }}>
              <Text style={{ color: tok.muted, fontFamily: fontBody(lang), fontSize: 12 }}>
                {lang === 'ar' ? 'ليس لديك حساب؟' : "Don't have an account?"}
              </Text>
              <Pressable onPress={() => switchView('register')}>
                <Text style={{ color: tok.gold, fontFamily: fontBody(lang, 'semibold'), fontSize: 12 }}>
                  {lang === 'ar' ? 'سجّل الآن' : 'Sign up instead'}
                </Text>
              </Pressable>
            </View>
            <AuthBackLink onPress={() => switchView('forgot')} label={lang === 'ar' ? 'بريد مختلف' : 'Use a different email'} />
          </>
        }
      >
        <AuthHero
          eyebrow={t('authVersion')}
          title={lang === 'ar' ? 'تحقق من الرمز' : 'Verify the code'}
          sub={`${lang === 'ar' ? 'أرسلنا رمزًا إلى' : 'We sent a code to'} ${email}`}
        />
        <AuthError message={err} />
        <AuthField
          label={t('verifyCode')} value={code} onChange={setCode}
          placeholder="000000" keyboardType="number-pad"
          textContentType="oneTimeCode" autoFocus
        />
        <Text style={{
          marginTop: 14,
          fontFamily: fontMono('regular'), fontSize: 10, letterSpacing: 1.2,
          color: tok.muted, textAlign: lang === 'ar' ? 'right' : 'left',
        }}>
          {lang === 'ar'
            ? 'لم يصلكِ الرمز؟ تحقّقي من مجلد السبام، أو اضغطي إعادة الإرسال، أو سجّلي حسابًا جديدًا.'
            : "Didn't get the code? Check spam folder, tap Resend, or sign up below if you don't have an account."}
        </Text>
      </AuthChrome>
    );
  }

  // ───────── FORGOT PASSWORD — set new password ─────────
  return (
    <AuthChrome
      footer={
        <RButton full onPress={submitForgotComplete} disabled={busy || (!!pwd2 && pwd !== pwd2)}>
          {busy ? t('pleaseWait') : (lang === 'ar' ? 'تعيين كلمة السر' : 'Set new password')}
        </RButton>
      }
    >
      <AuthHero
        eyebrow={t('authVersion')}
        title={lang === 'ar' ? 'كلمة سر جديدة' : 'Set a new password'}
        sub={lang === 'ar' ? 'الحد الأدنى 8 أحرف.' : 'At least 8 characters.'}
      />
      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
        <RadarMark size={92} gold={tok.gold} lightRing />
      </View>
      <Text style={{
        color: tok.muted, fontFamily: fontMono('regular'), fontSize: 10,
        letterSpacing: 1.4, writingDirection: 'ltr', textAlign: 'center', marginBottom: 16,
      }}>{email}</Text>
      <AuthError message={err} />
      <AuthField
        label={t('password')} value={pwd} onChange={setPwd}
        placeholder={t('passwordPlaceholder')} secureTextEntry
        textContentType="newPassword" autoFocus
      />
      <AuthField
        label={t('confirmPassword')} value={pwd2} onChange={setPwd2}
        placeholder={lang === 'ar' ? 'إعادة الإدخال' : 'Re-enter password'}
        secureTextEntry textContentType="newPassword"
      />
    </AuthChrome>
  );
}

// Small "Didn't get a code? Resend" row used on both verify screens. We
// disable the link for 30 seconds after a resend so the user can't spam
// the OTP endpoint by rapid-tapping while the email is still in flight.
const RESEND_COOLDOWN_MS = 30_000;
function ResendCodeRow({
  onResend, busy, resentAt, lang, tok,
}: {
  onResend: () => void;
  busy: boolean;
  resentAt: number | null;
  lang: 'en' | 'ar';
  tok: any;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!resentAt) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [resentAt]);

  const remainingMs = resentAt ? Math.max(0, RESEND_COOLDOWN_MS - (now - resentAt)) : 0;
  const cooldown = remainingMs > 0;
  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <View style={{
      marginTop: 14,
      flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
      justifyContent: 'center', alignItems: 'center', gap: 6,
    }}>
      <Text style={{ color: tok.muted, fontFamily: fontBody(lang), fontSize: 12 }}>
        {lang === 'ar' ? 'لم يصلكِ الرمز؟' : "Didn't get the code?"}
      </Text>
      <Pressable onPress={onResend} disabled={busy || cooldown} hitSlop={8}>
        <Text style={{
          color: busy || cooldown ? tok.muted : tok.gold,
          fontFamily: fontBody(lang, 'semibold'), fontSize: 12,
        }}>
          {cooldown
            ? (lang === 'ar' ? `إعادة الإرسال خلال ${seconds}ث` : `Resend in ${seconds}s`)
            : (lang === 'ar' ? 'إعادة الإرسال' : 'Resend')}
        </Text>
      </Pressable>
    </View>
  );
}

// Card used in the post-registration "Who is this account for?" step.
// One of two: Individual (default style) or Organization (gold highlight).
function SegmentCard({
  title, sub, onPress, tok, lang, highlight,
}: {
  title: string;
  sub: string;
  onPress: () => void;
  tok: any;
  lang: 'en' | 'ar';
  highlight?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: 14,
        paddingVertical: 16, paddingHorizontal: 16,
        backgroundColor: highlight ? tok.gold : tok.surface,
        borderWidth: 1, borderColor: highlight ? tok.gold : tok.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{
        fontFamily: fontHead(lang), fontSize: 18,
        color: highlight ? '#0D0D0D' : tok.bone,
        letterSpacing: -0.3,
        textAlign: lang === 'ar' ? 'right' : 'left',
      }}>
        {title}
      </Text>
      <Text style={{
        marginTop: 4,
        fontFamily: fontBody(lang), fontSize: 13, lineHeight: 19,
        color: highlight ? 'rgba(13,13,13,0.7)' : tok.muted,
        textAlign: lang === 'ar' ? 'right' : 'left',
        writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
      }}>
        {sub}
      </Text>
    </Pressable>
  );
}
