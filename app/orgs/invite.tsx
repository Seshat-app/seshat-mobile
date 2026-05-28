import { useState } from 'react';
import { View, Text, TextInput, ScrollView, Alert, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PlanScreen } from '../../components/PlanShell';
import { REyebrow, RButton } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { sendInvite } from '../../lib/orgs';
import { fontBody, fontMono } from '../../lib/fonts';
import { useKeyboardHeight } from '../../components/useKeyboardHeight';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * /orgs/invite?id=<orgId>
 *
 * Single-field email invite form. Owner-only on the server; non-owners
 * shouldn't be able to navigate here in the first place (the Invite button
 * on the detail screen is hidden for them), but the API would 403 anyway.
 *
 * On submit:
 *   - POST /orgs/:id/invites { email }
 *   - Server emails the invitee via Resend with the accept deep link
 *   - We bounce back to the org detail screen which shows the new pending invite
 */
export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tok, lang } = useI18n();
  const kbHeight = useKeyboardHeight();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!id) return;
    if (!EMAIL_RE.test(email.trim())) {
      Alert.alert(
        lang === 'ar' ? 'بريد إلكتروني غير صالح' : 'Invalid email',
        lang === 'ar' ? 'تأكدي من العنوان قبل الإرسال.' : 'Double-check the address before sending.',
      );
      return;
    }
    setSubmitting(true);
    try {
      const invite = await sendInvite(id, email.trim().toLowerCase());
      Alert.alert(
        lang === 'ar' ? 'تم الإرسال' : 'Invite sent',
        lang === 'ar'
          ? `تم إرسال دعوة إلى ${invite.email}. سيظهرون في قائمة الأعضاء فور قبولهم.`
          : `An invitation was emailed to ${invite.email}. They will appear in the members list once they accept.`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err) {
      Alert.alert(
        lang === 'ar' ? 'فشل الإرسال' : 'Send failed',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PlanScreen
      title={lang === 'ar' ? 'دعوة عضو' : 'Invite member'}
      subtitle={lang === 'ar' ? 'بالبريد الإلكتروني' : 'By email'}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 + kbHeight }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={{
          fontFamily: fontBody(lang), fontSize: 13, color: tok.muted, lineHeight: 19,
          marginBottom: 24,
          textAlign: lang === 'ar' ? 'right' : 'left',
          writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
        }}>
          {lang === 'ar'
            ? 'سيتلقى عضو الفريق رابطًا في بريده. عند فتحه، سينضمّ تلقائيًا بعد تسجيل الدخول.'
            : 'Your teammate will get a link in their inbox. Tapping it joins them automatically after sign-in.'}
        </Text>

        <REyebrow style={{ marginBottom: 6, textAlign: lang === 'ar' ? 'right' : 'left' }}>
          {lang === 'ar' ? 'البريد الإلكتروني' : 'EMAIL'}
        </REyebrow>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="teammate@yourteam.com"
          placeholderTextColor={tok.muted}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          style={{
            borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
            backgroundColor: tok.surface,
            borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12,
            color: tok.bone, fontFamily: fontBody(lang), fontSize: 16,
            marginBottom: 24,
            // The email is left-to-right even in Arabic UI.
            textAlign: 'left',
            writingDirection: 'ltr',
          }}
        />

        <RButton full onPress={submit} disabled={submitting || !email.trim()}>
          {submitting
            ? (lang === 'ar' ? 'جارٍ الإرسال...' : 'Sending...')
            : (lang === 'ar' ? 'إرسال الدعوة' : 'Send invitation')}
        </RButton>

        <Text style={{
          marginTop: 18,
          fontFamily: fontMono('regular'), fontSize: 10, color: tok.muted, letterSpacing: 1.2,
          textAlign: 'center', lineHeight: 16,
        }}>
          {lang === 'ar'
            ? 'الدعوة صالحة لمدة 7 أيام · يمكنكِ سحبها قبل القبول'
            : 'INVITE VALID FOR 7 DAYS · YOU CAN REVOKE BEFORE ACCEPT'}
        </Text>
      </ScrollView>
    </PlanScreen>
  );
}
