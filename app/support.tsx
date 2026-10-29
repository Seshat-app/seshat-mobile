import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Linking } from 'react-native';
import { ScrollView as ScreenScroll } from '../components/Scroll';
import { FrostedHeader } from '../components/FrostedHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, MessageCircle, Mail } from 'lucide-react-native';
import { apiFetch } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useAppData } from '../lib/appData';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { radius } from '../lib/theme';
import { BRAND, WHATSAPP_URL, WHATSAPP_DISPLAY } from '../lib/brand';
import { RButton, REyebrow, RField } from '../components/ui';
import { ScreenScaffold } from '../components/Screen';
import { useKeyboardHeight } from '../components/useKeyboardHeight';

// Lightweight "contact us" form. Sends a support request to the team inbox
// via POST /me/support, which Resend-forwards with the user's account
// context attached. Reply-To is the user's email so the team can just hit
// reply from their inbox to respond.

const SUBJECT_MAX = 120;
const MESSAGE_MAX = 4000;

export default function SupportScreen() {
  const router = useRouter();
  const { tok, lang } = useI18n();
  const { profile } = useAppData();
  const insets = useSafeAreaInsets();
  const kbHeight = useKeyboardHeight();

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const canSend = subject.trim().length > 0 && message.trim().length > 0 && !sending;

  const submit = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await apiFetch('/me/support', {
        method: 'POST',
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      Alert.alert(
        lang === 'ar' ? 'تم الإرسال' : 'Sent',
        lang === 'ar'
          ? 'تلقينا طلبكِ. سنرد على بريدكِ خلال 24-48 ساعة.'
          : `We got your message. The team will reply to ${profile?.email ?? 'your email'} within 24-48h.`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err) {
      Alert.alert(
        lang === 'ar' ? 'فشل الإرسال' : 'Send failed',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setSending(false);
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
            {lang === 'ar' ? 'الدعم' : 'Support'}
          </Text>
          <REyebrow style={{ marginTop: 3, textAlign: lang === 'ar' ? 'right' : 'left' }}>
            {lang === 'ar' ? 'أرسلي لنا مشكلتكِ' : 'Tell us what is wrong'}
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
        {/* Helper text */}
        <Text style={{
          fontFamily: fontBody(lang), fontSize: 13, color: tok.muted,
          lineHeight: 20, marginBottom: 18,
          textAlign: lang === 'ar' ? 'right' : 'left',
          writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
        }}>
          {lang === 'ar'
            ? `هل تواجهين مشكلة؟ صفي ما حدث ومتى. سنرد على ${profile?.email ?? 'بريدكِ'} خلال 24-48 ساعة.`
            : `Hit a snag? Describe what happened and when. The team will reply to ${profile?.email ?? 'your email'} within 24-48h.`}
        </Text>

        {/* Direct channels: faster than the form for quick questions */}
        <View style={{ flexDirection: lang === 'ar' ? 'row-reverse' : 'row', gap: 10, marginBottom: 22 }}>
          {[
            { Icon: MessageCircle, label: lang === 'ar' ? 'واتساب' : 'WhatsApp', value: WHATSAPP_DISPLAY, url: WHATSAPP_URL, ltr: true },
            { Icon: Mail, label: lang === 'ar' ? 'البريد' : 'Email', value: BRAND.supportEmail, url: `mailto:${BRAND.supportEmail}`, ltr: true },
          ].map(({ Icon, label, value, url, ltr }) => (
            <Pressable
              key={label}
              onPress={() => Linking.openURL(url).catch(() => {})}
              accessibilityRole="link"
              accessibilityLabel={`${label}: ${value}`}
              style={({ pressed }) => ({
                flex: 1, borderRadius: radius.btn, padding: 14, gap: 8,
                backgroundColor: pressed ? tok.elevated : tok.shellBg,
                borderWidth: 1, borderColor: tok.shellBorder,
              })}
            >
              <Icon size={18} color={tok.gold} />
              <Text style={{ color: tok.muted, fontFamily: fontMono('regular'), fontSize: 10, letterSpacing: 1.4, textAlign: lang === 'ar' ? 'right' : 'left', textTransform: lang === 'ar' ? 'none' : 'uppercase' }}>
                {label}
              </Text>
              <Text numberOfLines={1} style={{ color: tok.bone, fontFamily: fontBody(lang), fontSize: 13, writingDirection: ltr ? 'ltr' : undefined, textAlign: lang === 'ar' ? 'right' : 'left' }}>
                {value}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Subject */}
        <RField
          label={lang === 'ar' ? 'الموضوع' : 'SUBJECT'}
          value={subject}
          onChange={(v) => setSubject(v.slice(0, SUBJECT_MAX))}
          placeholder={lang === 'ar' ? 'مشكلة في تسجيل الدخول' : 'Cannot sign in'}
          maxLength={SUBJECT_MAX}
          autoCapitalize="sentences"
          style={{ marginBottom: 16 }}
        />

        {/* Message */}
        <RField
          label={lang === 'ar' ? 'التفاصيل' : 'DETAILS'}
          secondary={
            <Text style={{
              fontFamily: fontMono('regular'), fontSize: 9, color: tok.muted,
            }}>
              {message.length} / {MESSAGE_MAX}
            </Text>
          }
          value={message}
          onChange={(v) => setMessage(v.slice(0, MESSAGE_MAX))}
          placeholder={lang === 'ar'
            ? 'صفي ما حدث، الخطوات للتكرار، وأي رسالة خطأ ظهرت.'
            : 'Describe what happened, the steps to reproduce, and any error message you saw.'}
          multiline
          maxLength={MESSAGE_MAX}
          minHeight={180}
          autoCapitalize="sentences"
        />

        <View style={{ marginTop: 22 }}>
          <RButton full onPress={submit} disabled={!canSend} loading={sending}>
            {sending
              ? (lang === 'ar' ? 'يتم الإرسال…' : 'Sending…')
              : (lang === 'ar' ? 'إرسال' : 'Send to support')}
          </RButton>
        </View>

        <Text style={{
          marginTop: 18,
          fontFamily: fontMono('regular'), fontSize: 10, letterSpacing: 1.2,
          color: tok.muted, textAlign: 'center', lineHeight: 16,
        }}>
          {lang === 'ar'
            ? 'يتم إرفاق معرف حسابكِ تلقائيًا لمساعدتنا في الرد بسرعة.'
            : 'Your account ID is attached automatically to help us reply faster.'}
        </Text>
      </ScreenScroll>
    </ScreenScaffold>
  );
}
