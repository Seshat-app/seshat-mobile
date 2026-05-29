import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldCheck, Eye, Lock, Cpu } from 'lucide-react-native';
import { PlanScreen } from '../components/PlanShell';
import { RCard, REyebrow, RButton } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { fontBody, fontMono } from '../lib/fonts';
import {
  getPermissionStatus,
  requestPermission,
  type PermissionStatus,
} from '../lib/androidNotificationListener';

/**
 * /capture-setup-android - explainer + consent BEFORE we ask the OS for
 * "Notification access". The system prompt sounds scary ("this app will
 * read every notification on your device") so we own the framing first:
 * what we read, what we ignore, what leaves the device, what doesn't.
 *
 * Apple won't ever let us do this on iOS, but on Android it's possible
 * with the user's explicit consent.
 */
export default function CaptureSetupAndroidScreen() {
  const router = useRouter();
  const { tok, lang } = useI18n();
  const [status, setStatus] = useState<PermissionStatus>('unknown');
  const [checking, setChecking] = useState(false);

  const refresh = async () => {
    setChecking(true);
    setStatus(await getPermissionStatus());
    setChecking(false);
  };

  useEffect(() => { refresh(); }, []);

  const onRequest = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert(
        lang === 'ar' ? 'متاح على Android فقط' : 'Android only',
        lang === 'ar'
          ? 'هذه الميزة متوفرة على Android. على iPhone استخدم إعداد الاختصارات.'
          : 'This feature is Android-only. On iPhone use the Shortcuts setup instead.',
      );
      return;
    }
    if (status === 'unavailable') {
      Alert.alert(
        lang === 'ar' ? 'يتطلب نسخة كاملة' : 'Needs a full build',
        lang === 'ar'
          ? 'هذه الميزة تحتاج تطبيق سيشات المثبّت من APK (ليس Expo Go). أعد التثبيت من رابط البناء الأخير.'
          : 'This feature requires the full Seshat build (not Expo Go). Install the latest APK and try again.',
      );
      return;
    }
    await requestPermission();
    // Give the system a moment to write the new state, then re-check.
    setTimeout(refresh, 1500);
  };

  const authorized = status === 'authorized';

  return (
    <PlanScreen
      title={lang === 'ar' ? 'رصد إشعارات البنوك' : 'Bank notification capture'}
      subtitle={lang === 'ar' ? 'لـ Android — موافقة مرّة واحدة' : 'Android — one-time consent'}
    >
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 8 }}>
        <RCard padding={18} style={{ marginBottom: 14 }}>
          <View style={{
            flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
            alignItems: 'center', gap: 8, marginBottom: 8,
          }}>
            <ShieldCheck size={18} color={tok.gold} />
            <REyebrow>{lang === 'ar' ? 'ماذا نقرأ' : 'What we read'}</REyebrow>
          </View>
          <Text style={{
            fontFamily: fontBody(lang), fontSize: 13.5, lineHeight: 20, color: tok.muted,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>
            {lang === 'ar'
              ? 'فقط الإشعارات الصادرة من تطبيقات البنوك المعروفة (CIB · NBE · بنك مصر · QNB · InstaPay · Telda · …). كل إشعار من تطبيقات أخرى مثل WhatsApp أو الإيميل أو Twitter يتم تجاهله مباشرة قبل أي معالجة.'
              : 'Only notifications coming from known bank apps (CIB · NBE · Banque Misr · QNB · InstaPay · Telda · …). Notifications from WhatsApp, email, Twitter, and everything else are filtered out immediately, before any processing.'}
          </Text>
        </RCard>

        <RCard padding={18} style={{ marginBottom: 14 }}>
          <View style={{
            flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
            alignItems: 'center', gap: 8, marginBottom: 8,
          }}>
            <Eye size={18} color={tok.gold} />
            <REyebrow>{lang === 'ar' ? 'ماذا نتجاهل' : 'What we ignore'}</REyebrow>
          </View>
          <Text style={{
            fontFamily: fontBody(lang), fontSize: 13.5, lineHeight: 20, color: tok.muted,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>
            {lang === 'ar'
              ? 'رسائل OTP، تنبيهات تسجيل الدخول، إيصالات الرصيد، الإشعارات الإعلانية، أي شيء ليس معاملة فعلية. الذكاء الاصطناعي يصنّفها ويرفضها بدون إنشاء معاملة.'
              : 'OTP codes, login alerts, balance pings, marketing notifications - anything that isn\'t a real transaction. The AI classifies and rejects them without creating any entry.'}
          </Text>
        </RCard>

        <RCard padding={18} style={{ marginBottom: 14 }}>
          <View style={{
            flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
            alignItems: 'center', gap: 8, marginBottom: 8,
          }}>
            <Lock size={18} color={tok.gold} />
            <REyebrow>{lang === 'ar' ? 'الخصوصية' : 'Privacy'}</REyebrow>
          </View>
          <Text style={{
            fontFamily: fontBody(lang), fontSize: 13.5, lineHeight: 20, color: tok.muted,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>
            {lang === 'ar'
              ? 'نص الإشعار يُرسل لخادم سيشات الخاص لتحليله، ولا يُحفظ بعد التحليل. لا نقرأ محادثاتك ولا نتسلّل لمعلوماتك. تستطيع إيقاف الصلاحية في أي وقت من إعدادات Android.'
              : 'The notification text is sent to Seshat\'s own server for parsing, and is not stored after parsing. We never read your chats or other content. You can revoke access any time from Android settings.'}
          </Text>
        </RCard>

        <RCard padding={18} style={{ marginBottom: 14 }}>
          <View style={{
            flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
            alignItems: 'center', gap: 8, marginBottom: 8,
          }}>
            <Cpu size={18} color={tok.gold} />
            <REyebrow>{lang === 'ar' ? 'كيف يحدث ذلك' : 'How it works'}</REyebrow>
          </View>
          <Text style={{
            fontFamily: fontBody(lang), fontSize: 13.5, lineHeight: 20, color: tok.muted,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>
            {lang === 'ar'
              ? 'عند موافقتك، Android يفتح صفحة "وصول الإشعارات" (Notification access). فعّل "Seshat". بعدها كل إشعار بنكي يصل لك يفتح صفحة "رصد" داخل التطبيق بالمبلغ والتصنيف. أنت تؤكد وتحفظ.'
              : 'When you tap below, Android opens the "Notification access" settings page. Toggle Seshat on. After that, every bank notification you get auto-opens the Capture screen in this app, with the amount and category ready to confirm.'}
          </Text>
        </RCard>

        <View style={{
          marginBottom: 14,
          paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
          backgroundColor: tok.surface, borderWidth: 1,
          borderColor: authorized ? tok.gold : tok.border,
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          alignItems: 'center', gap: 10,
        }}>
          <View style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: authorized ? tok.gold : (status === 'unavailable' ? tok.alertText : tok.muted),
          }} />
          <Text style={{
            flex: 1, fontFamily: fontMono(), fontSize: 12, color: tok.bone,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>
            {authorized
              ? (lang === 'ar' ? 'الصلاحية مفعّلة — رصد البنوك يعمل.' : 'Permission granted - bank capture active.')
              : status === 'unavailable'
                ? (lang === 'ar' ? 'يتطلب نسخة APK كاملة (ليس Expo Go).' : 'Needs the full APK build (not Expo Go).')
                : (lang === 'ar' ? 'الصلاحية غير مفعّلة.' : 'Permission not granted.')}
          </Text>
        </View>

        <RButton full onPress={onRequest} disabled={checking || authorized}>
          {authorized
            ? (lang === 'ar' ? 'تم — يعمل بالفعل' : 'Done — already active')
            : (lang === 'ar' ? 'أوافق وفتح إعدادات Android' : 'I agree, open Android settings')}
        </RButton>

        <Text style={{
          marginTop: 12, fontFamily: fontBody(lang), fontSize: 11, color: tok.muted,
          textAlign: 'center',
        }}>
          {lang === 'ar'
            ? 'يمكنك العودة وإلغاء التفعيل من نفس الشاشة في أي وقت.'
            : 'You can come back and turn this off here any time.'}
        </Text>
      </ScrollView>
    </PlanScreen>
  );
}
