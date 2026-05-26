import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { hasToken } from '../lib/api';
import { signInWithPassword, registerSendCode, registerVerifyCode, registerComplete } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { fontBody, fontMono } from '../lib/fonts';
import {
  AuthChrome, AuthHero, AuthField, AuthLink, SSOButton, AuthOr, AuthBackLink, AuthError, RButton,
} from '../components/auth';
import { RadarMark } from '../components/RadarMark';

type AuthView = 'login' | 'register' | 'verify' | 'completeReg' | 'forgot' | 'forgotSent';

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

  useEffect(() => {
    hasToken().then((has) => {
      if (has) router.replace('/(tabs)');
      else setChecking(false);
    });
  }, []);

  const goApp = () => router.replace('/(tabs)');

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
    if (r.success) goApp();
    else setErr(r.error ?? 'Registration failed');
    setBusy(false);
  };

  const submitForgot = () => {
    if (!email.includes('@')) { setErr('Enter a valid email'); return; }
    // Backend endpoint not yet implemented — we render the success state per the design
    setErr('');
    setView('forgotSent');
  };

  const switchView = (v: AuthView) => { setView(v); setErr(''); };

  if (checking) {
    return <View style={{ flex: 1, backgroundColor: tok.void }} />;
  }

  // ───────── LOGIN ─────────
  if (view === 'login') {
    return (
      <AuthChrome
        footer={
          <>
            <RButton full onPress={submitLogin} disabled={busy}>{busy ? t('pleaseWait') : t('signIn')}</RButton>
            <AuthOr />
            <View style={{ gap: 8 }}>
              <SSOButton provider="google" label={lang === 'ar' ? 'المتابعة بجوجل' : 'Continue with Google'} />
              <SSOButton provider="apple" label={lang === 'ar' ? 'المتابعة بآبل' : 'Continue with Apple'} />
            </View>
            <View style={{
              marginTop: 22,
              flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
              justifyContent: 'center', alignItems: 'center', gap: 8,
            }}>
              <Text style={{ color: tok.muted, fontFamily: fontBody(lang), fontSize: 13 }}>{t('noAccount')}</Text>
              <Pressable onPress={() => switchView('register')}>
                <Text style={{ color: tok.gold, fontFamily: fontBody(lang, 'semibold'), fontSize: 13 }}>{t('signUp')} →</Text>
              </Pressable>
            </View>
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

  // ───────── FORGOT PASSWORD ─────────
  if (view === 'forgot') {
    return (
      <AuthChrome
        footer={
          <>
            <RButton full onPress={submitForgot}>{t('sendResetLink')}</RButton>
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

  // ───────── FORGOT PASSWORD — sent confirmation ─────────
  return (
    <AuthChrome
      footer={<RButton full onPress={() => switchView('login')}>{t('backToSignIn')}</RButton>}
    >
      <AuthHero eyebrow={t('authVersion')} title={t('forgotSentTitle')} sub={t('forgotSentSub')} />
      <View style={{ alignItems: 'center', paddingVertical: 40 }}>
        <RadarMark size={140} gold={tok.gold} lightRing animate />
      </View>
      <View style={{ alignItems: 'center' }}>
        <Text style={{
          color: tok.muted, fontFamily: fontMono('regular'), fontSize: 10,
          letterSpacing: 1.4, writingDirection: 'ltr',
        }}>{email || 'name@radar.app'}</Text>
      </View>
    </AuthChrome>
  );
}
