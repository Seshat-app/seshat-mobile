import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { ScrollView as ScreenScroll } from '../components/Scroll';
import { FrostedHeader } from '../components/FrostedHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { apiFetch } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { radius } from '../lib/theme';
import { RButton, REyebrow, RField, RToast } from '../components/ui';
import { ScreenScaffold } from '../components/Screen';
import { useKeyboardHeight } from '../components/useKeyboardHeight';

// Change-password screen. Three secure fields (current, new, confirm) with
// client-side validation (new >= 8 chars, new === confirm), then
// POST /me/change-password { currentPassword, newPassword } via apiFetch.
// apiFetch throws Error(message) on 400/401 (e.g. "Current password is
// incorrect") — we surface that message inline. On success we clear the
// fields, flash a toast, and navigate back.

const MIN_LEN = 8;

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { tok, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const kbHeight = useKeyboardHeight();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Local validity: all fields filled, new long enough, new matches confirm.
  const mismatch = confirm.length > 0 && next !== confirm;
  const tooShort = next.length > 0 && next.length < MIN_LEN;
  const canSubmit =
    current.length > 0 &&
    next.length >= MIN_LEN &&
    next === confirm &&
    !saving;

  const submit = async () => {
    setError('');
    if (next.length < MIN_LEN) {
      setError(lang === 'ar' ? `الحد الأدنى ${MIN_LEN} أحرف.` : `At least ${MIN_LEN} characters.`);
      return;
    }
    if (next !== confirm) {
      setError(lang === 'ar' ? 'كلمتا السر غير متطابقتين.' : 'Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/me/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setCurrent(''); setNext(''); setConfirm('');
      setSaved(true);
      // Let the toast show briefly before we pop back to Profile.
      setTimeout(() => {
        setSaved(false);
        router.back();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenScaffold>
      {/* Header */}
      <FrostedHeader style={{
        paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', gap: 12,
      }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={lang === 'ar' ? 'رجوع' : 'Back'}
          style={({ pressed }) => ({
            width: 36, height: 36, borderRadius: radius.btn,
            backgroundColor: pressed ? tok.elevated : tok.shellBg,
            borderWidth: 1, borderColor: tok.shellBorder,
            alignItems: 'center', justifyContent: 'center',
          })}
        >
          <ChevronLeft size={20} color={tok.bone} style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{
            fontFamily: fontHead(lang),
            fontSize: 22, color: tok.bone, letterSpacing: -0.4,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>
            {lang === 'ar' ? 'تغيير كلمة السر' : 'Change password'}
          </Text>
          <REyebrow style={{ marginTop: 3, textAlign: lang === 'ar' ? 'right' : 'left' }}>
            {lang === 'ar' ? 'حدّثي كلمة سر حسابك' : 'Update your account password'}
          </REyebrow>
        </View>
      </FrostedHeader>

      <ScreenScroll
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: insets.bottom + 40 + kbHeight,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Server error surfaces here (e.g. "Current password is incorrect"). */}
        {error ? (
          <View
            accessibilityLiveRegion="polite"
            style={{
              marginBottom: 16, paddingVertical: 12, paddingHorizontal: 14,
              borderRadius: 12, backgroundColor: tok.alertBg,
              borderWidth: 1, borderColor: 'rgba(224,85,85,0.3)',
            }}
          >
            <Text style={{
              color: tok.alertText, fontFamily: fontBody(lang), fontSize: 13, lineHeight: 19,
              textAlign: lang === 'ar' ? 'right' : 'left',
              writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
            }}>
              {error}
            </Text>
          </View>
        ) : null}

        <RField
          label={lang === 'ar' ? 'كلمة السر الحالية' : 'CURRENT PASSWORD'}
          value={current}
          onChange={(v) => { setCurrent(v); if (error) setError(''); }}
          placeholder={lang === 'ar' ? 'كلمة سرك الحالية' : 'Your current password'}
          secureTextEntry
          textContentType="password"
          autoComplete="current-password"
          style={{ marginBottom: 16 }}
        />

        <RField
          label={lang === 'ar' ? 'كلمة السر الجديدة' : 'NEW PASSWORD'}
          value={next}
          onChange={(v) => { setNext(v); if (error) setError(''); }}
          placeholder={lang === 'ar' ? `الحد الأدنى ${MIN_LEN} أحرف` : `At least ${MIN_LEN} characters`}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="new-password"
          style={{ marginBottom: tooShort ? 6 : 16 }}
        />
        {tooShort ? (
          <Text style={{
            marginBottom: 16,
            fontFamily: fontMono('regular'), fontSize: 10, letterSpacing: 0.4,
            color: tok.muted, textAlign: lang === 'ar' ? 'right' : 'left',
          }}>
            {lang === 'ar' ? `الحد الأدنى ${MIN_LEN} أحرف.` : `Min. ${MIN_LEN} characters.`}
          </Text>
        ) : null}

        <RField
          label={lang === 'ar' ? 'تأكيد كلمة السر' : 'CONFIRM NEW PASSWORD'}
          value={confirm}
          onChange={(v) => { setConfirm(v); if (error) setError(''); }}
          placeholder={lang === 'ar' ? 'إعادة إدخال كلمة السر الجديدة' : 'Re-enter new password'}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="new-password"
          onSubmitEditing={canSubmit ? submit : undefined}
          returnKeyType="done"
          style={{ marginBottom: mismatch ? 6 : 0 }}
        />
        {mismatch ? (
          <Text style={{
            fontFamily: fontMono('regular'), fontSize: 10, letterSpacing: 0.4,
            color: tok.alertText, textAlign: lang === 'ar' ? 'right' : 'left',
          }}>
            {lang === 'ar' ? 'كلمتا السر غير متطابقتين.' : 'Passwords do not match.'}
          </Text>
        ) : null}

        <View style={{ marginTop: 24 }}>
          <RButton full onPress={submit} disabled={!canSubmit} loading={saving}>
            {saving
              ? (lang === 'ar' ? 'يتم الحفظ…' : 'Saving…')
              : (lang === 'ar' ? 'تحديث كلمة السر' : 'Update password')}
          </RButton>
        </View>
      </ScreenScroll>

      <RToast visible={saved} bottomOffset={insets.bottom + 24}>
        {lang === 'ar' ? 'تم تحديث كلمة السر' : 'Password updated'}
      </RToast>
    </ScreenScaffold>
  );
}
