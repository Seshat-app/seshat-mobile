import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { hasToken } from '../lib/api';
import {
  signInWithPassword, registerSendCode, registerVerifyCode, registerComplete,
  requestPasswordReset, verifyPasswordReset, completePasswordReset,
} from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { fontBody, fontMono } from '../lib/fonts';
import {
  AuthChrome, AuthHero, AuthField, AuthLink, AuthBackLink, AuthError, RButton,
} from '../components/auth';
import { RadarMark } from '../components/RadarMark';

type AuthView = 'login' | 'register' | 'verify' | 'completeReg' | 'forgot' | 'forgotVerify' | 'forgotComplete';

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
