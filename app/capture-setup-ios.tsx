import { View, Text, Pressable, Linking } from 'react-native';
import { ScrollView as ScreenScroll } from '../components/Scroll';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Copy, ExternalLink, Check } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { PlanScreen } from '../components/PlanShell';
import { RCard, REyebrow, RButton } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { useAccountCurrency, captureKeywordsFor } from '../lib/captureKeywords';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { S } from '../lib/theme';

/**
 * /capture-setup-ios - one-time setup for the iOS bank-message capture. Apple blocks
 * reading other apps' notifications, but a Personal Automation can fire when a message
 * arrives that contains a keyword. Every Egyptian bank SMS carries the currency, so ONE
 * automation on "EGP" covers all banks. Seshat ships a native Shortcuts action
 * ("Log bank message") that the automation runs; it opens the Capture screen.
 */

export default function CaptureSetupIosScreen() {
  const { tok, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const ar = lang === 'ar';
  const currency = useAccountCurrency();
  const KEYWORDS = captureKeywordsFor(currency);
  const [copied, setCopied] = useState<string | null>(null);

  const copyKeyword = async (k: string) => {
    await Clipboard.setStringAsync(k);
    setCopied(k);
    setTimeout(() => setCopied(null), 1500);
  };

  const para = {
    fontFamily: fontBody(lang), fontSize: 13, lineHeight: 19, color: tok.muted,
    textAlign: ar ? 'right' : 'left',
  } as const;

  return (
    <PlanScreen
      title={ar ? 'إعداد رصد الرسائل' : 'Message capture setup'}
      subtitle={ar ? 'لـ iOS - مرة واحدة' : 'iOS - one-time setup'}
    >
      <ScreenScroll contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + S[6], paddingTop: 8 }}>
        <RCard padding={16} style={{ marginBottom: 14 }}>
          <REyebrow style={{ marginBottom: 6, textAlign: ar ? 'right' : 'left' }}>
            {ar ? 'كيف تعمل؟' : 'How it works'}
          </REyebrow>
          <Text style={[para, { fontSize: 13.5, lineHeight: 20 }]}>
            {ar
              ? `كل رسالة بنكية تحمل العملة. أتمتة واحدة تعمل عندما تصلك رسالة تحتوي على "${currency}"، وتشغّل إجراء سيشات الجاهز داخل تطبيق الاختصارات. الرسالة تُفتح داخل سيشات على نفس الهاتف ولا تُرسل لأي مكان آخر.`
              : `Every bank message carries the currency. One automation fires when a message containing "${currency}" arrives and runs Seshat's own action inside the Shortcuts app. The text opens in Seshat on this phone and is not sent anywhere else.`}
          </Text>
        </RCard>

        <StepCard step={1} title={ar ? 'افتح الاختصارات ← الأتمتة' : 'Shortcuts → Automation'} tok={tok} lang={lang}>
          <Text style={para}>
            {ar
              ? 'افتح تطبيق "الاختصارات" على iPhone، واذهب إلى تبويب "الأتمتة" ثم اضغط +، واختر "رسالة" (Message).'
              : 'Open the Shortcuts app on your iPhone, go to the Automation tab, tap +, and choose "Message".'}
          </Text>
          <RButton
            full
            onPress={() => { void Linking.openURL('shortcuts://').catch(() => {}); }}
            style={{ marginTop: 12 }}
            icon={<ExternalLink size={14} color={tok.void} />}
          >
            {ar ? 'فتح الاختصارات' : 'Open Shortcuts'}
          </RButton>
        </StepCard>

        <StepCard step={2} title={ar ? 'الكلمة المفتاحية' : 'Keyword: "Message Contains"'} tok={tok} lang={lang}>
          <Text style={[para, { marginBottom: 10 }]}>
            {ar
              ? 'في "الرسالة تحتوي على" ألصق الكلمة. اضغط لنسخها. أضف أتمتة ثانية بالكلمة العربية لو بنكك يرسل بالعربي.'
              : 'In "Message Contains" paste the keyword (tap to copy). Add a second automation with the Arabic word if your bank texts in Arabic.'}
          </Text>
          <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 8, flexWrap: 'wrap' }}>
            {KEYWORDS.map((k) => (
              <Pressable
                key={k}
                onPress={() => copyKeyword(k)}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10,
                  backgroundColor: copied === k ? tok.glowShellBg : tok.coreBg,
                  borderWidth: 1, borderColor: copied === k ? tok.glowShellBorder : tok.border,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ fontFamily: fontMono(), fontSize: 14, color: tok.bone }}>{k}</Text>
                {copied === k ? <Check size={14} color={tok.gold} /> : <Copy size={13} color={tok.muted} />}
              </Pressable>
            ))}
          </View>
        </StepCard>

        <StepCard step={3} title={ar ? 'الإجراء: Log bank message' : 'Action: "Log bank message"'} tok={tok} lang={lang}>
          <Text style={para}>
            {ar
              ? 'اضغط "التالي" ثم "أتمتة جديدة فارغة". اضغط "إضافة إجراء"، وابحث عن "Seshat" واختر "Log bank message". اضغط على "Message" واختر "مدخل الاختصار" (Shortcut Input).'
              : 'Tap Next, then "New Blank Automation". Tap "Add Action", search "Seshat" and pick "Log bank message". Tap "Message" and choose "Shortcut Input".'}
          </Text>
        </StepCard>

        <StepCard step={4} title={ar ? 'شغّلها فوراً' : 'Run Immediately'} tok={tok} lang={lang}>
          <Text style={para}>
            {ar
              ? 'اضغط "التالي"، اختر "تشغيل فوراً" (Run Immediately) وأوقف "إشعار عند التشغيل"، ثم "تم". من الآن كل رسالة بنكية تفتح سيشات بالمعاملة جاهزة للتأكيد.'
              : 'Tap Next, pick "Run Immediately" and turn off "Notify When Run", then Done. From now on every bank message opens Seshat with the entry ready to confirm.'}
          </Text>
        </StepCard>
      </ScreenScroll>
    </PlanScreen>
  );
}

function StepCard({
  step, title, tok, lang, children,
}: { step: number; title: string; tok: any; lang: 'en' | 'ar'; children: React.ReactNode }) {
  return (
    <RCard padding={16} style={{ marginBottom: 12 }}>
      <View style={{
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', gap: 10, marginBottom: 8,
      }}>
        <View style={{
          width: 26, height: 26, borderRadius: 13,
          backgroundColor: tok.gold,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontFamily: fontMono(), fontSize: 12, color: tok.void }}>{step}</Text>
        </View>
        <Text style={{
          flex: 1, fontFamily: fontHead(lang), fontSize: 15, color: tok.bone,
          textAlign: lang === 'ar' ? 'right' : 'left',
        }}>{title}</Text>
      </View>
      {children}
    </RCard>
  );
}
