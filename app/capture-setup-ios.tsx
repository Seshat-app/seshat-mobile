import { View, Text, ScrollView, Pressable, Linking, Alert } from 'react-native';
import { useState } from 'react';
import { Copy, ExternalLink, Check } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { PlanScreen } from '../components/PlanShell';
import { RCard, REyebrow, RButton } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { fontBody, fontHead, fontMono } from '../lib/fonts';

/**
 * /capture-setup-ios - one-time onboarding for the iOS notification capture
 * flow. Apple blocks reading other apps' push notifications, but lets us
 * trigger Personal Automations on incoming SMS content - which every
 * Egyptian bank still sends alongside their app push. The user installs
 * our published Shortcut once, then sets up a Personal Automation per bank.
 *
 * Steps shown:
 *  1. Install the Seshat Capture Shortcut (iCloud link).
 *  2. Open the Shortcuts app -> Automation tab -> New Personal Automation.
 *  3. Trigger: "Message" -> "Message Contains" -> keyword from your bank.
 *  4. Action: Run "Seshat Capture" with the Message Text as input.
 *  5. Disable "Ask Before Running" so it auto-runs.
 *  6. Repeat for each bank / payment app.
 */

// Hosted iCloud Shortcuts share URL. Replace with the real link once the
// Shortcut is published. Until then, the button shows "Coming soon".
const SHORTCUT_URL = 'https://www.icloud.com/shortcuts/SESHAT_CAPTURE_PLACEHOLDER';

const BANK_KEYWORDS: { label: string; keywords: string[] }[] = [
  { label: 'CIB', keywords: ['CIB', 'Commercial International'] },
  { label: 'NBE', keywords: ['NBE', 'National Bank of Egypt'] },
  { label: 'Banque Misr', keywords: ['Banque Misr', 'بنك مصر'] },
  { label: 'QNB Alahli', keywords: ['QNB', 'الأهلي'] },
  { label: 'Alex Bank', keywords: ['AlexBank', 'Alex Bank', 'بنك الإسكندرية'] },
  { label: 'InstaPay', keywords: ['InstaPay', 'انستاباي'] },
  { label: 'HSBC', keywords: ['HSBC'] },
  { label: 'Telda', keywords: ['Telda'] },
];

export default function CaptureSetupIosScreen() {
  const { tok, lang } = useI18n();
  const [copied, setCopied] = useState<string | null>(null);

  const copyKeyword = async (label: string, keyword: string) => {
    await Clipboard.setStringAsync(keyword);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const openShortcut = () => {
    if (SHORTCUT_URL.includes('PLACEHOLDER')) {
      Alert.alert(
        lang === 'ar' ? 'قريباً' : 'Coming soon',
        lang === 'ar'
          ? 'سنُتيح اختصار سيشات قريباً. حتى ذلك الحين تابع باقي الخطوات يدوياً.'
          : 'The Seshat Shortcut will be published shortly. Follow the rest of the steps for now.',
      );
      return;
    }
    Linking.openURL(SHORTCUT_URL);
  };

  return (
    <PlanScreen
      title={lang === 'ar' ? 'إعداد رصد الإشعارات' : 'Notification capture setup'}
      subtitle={lang === 'ar' ? 'لـ iOS — مرة واحدة' : 'iOS — one-time setup'}
    >
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, paddingTop: 8 }}>
        <RCard padding={16} style={{ marginBottom: 14 }}>
          <REyebrow style={{ marginBottom: 6, textAlign: lang === 'ar' ? 'right' : 'left' }}>
            {lang === 'ar' ? 'لماذا الإعداد؟' : 'Why this setup?'}
          </REyebrow>
          <Text style={{
            fontFamily: fontBody(lang), fontSize: 13.5, lineHeight: 20, color: tok.muted,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>
            {lang === 'ar'
              ? 'أبل لا تسمح للتطبيقات بقراءة إشعارات تطبيقات أخرى. لكن تطبيق "الاختصارات" يستطيع أن يشغّل عملية تلقائية عندما تصلك رسالة SMS بكلمة معينة. سنستخدم هذا لرصد رسائل البنوك تلقائياً.'
              : 'Apple does not allow apps to read other apps\' notifications. The Shortcuts app, however, can run a Personal Automation when an SMS arrives matching a keyword. We use this to capture bank SMS automatically.'}
          </Text>
        </RCard>

        <StepCard step={1} title={lang === 'ar' ? 'ثبّت اختصار سيشات' : 'Install the Seshat Shortcut'} tok={tok} lang={lang}>
          <Text style={{
            fontFamily: fontBody(lang), fontSize: 13, lineHeight: 19, color: tok.muted,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>
            {lang === 'ar'
              ? 'اضغط الزر لإضافة اختصار "Seshat Capture" من iCloud. الاختصار يأخذ نص الرسالة ويفتحه داخل التطبيق.'
              : 'Tap the button to add the "Seshat Capture" shortcut from iCloud. It takes the SMS body and opens it inside this app.'}
          </Text>
          <RButton full onPress={openShortcut} style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ExternalLink size={14} color={tok.void} />
              <Text style={{ color: tok.void, fontFamily: fontBody(lang), fontSize: 14 }}>
                {lang === 'ar' ? 'إضافة الاختصار' : 'Get the Shortcut'}
              </Text>
            </View>
          </RButton>
        </StepCard>

        <StepCard step={2} title={lang === 'ar' ? 'افتح تطبيق الاختصارات' : 'Open the Shortcuts app'} tok={tok} lang={lang}>
          <Text style={{
            fontFamily: fontBody(lang), fontSize: 13, lineHeight: 19, color: tok.muted,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>
            {lang === 'ar'
              ? 'افتح تطبيق "الاختصارات" المثبّت أصلاً على iPhone، ثم اذهب إلى تبويب "الأتمتة" (Automation) من الأسفل.'
              : 'Open the built-in "Shortcuts" app on your iPhone and tap the "Automation" tab at the bottom.'}
          </Text>
        </StepCard>

        <StepCard step={3} title={lang === 'ar' ? 'إنشاء أتمتة شخصية' : 'New Personal Automation'} tok={tok} lang={lang}>
          <Text style={{
            fontFamily: fontBody(lang), fontSize: 13, lineHeight: 19, color: tok.muted,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>
            {lang === 'ar'
              ? 'اضغط زر + ثم "إنشاء أتمتة شخصية"، واختر "رسالة" (Message) كمحفّز. فعّل خيار "تحتوي الرسالة على" (Message Contains).'
              : 'Tap +, then "Create Personal Automation", and choose "Message" as the trigger. Enable "Message Contains".'}
          </Text>
        </StepCard>

        <StepCard step={4} title={lang === 'ar' ? 'الكلمة المفتاحية لكل بنك' : 'Bank keywords'} tok={tok} lang={lang}>
          <Text style={{
            fontFamily: fontBody(lang), fontSize: 13, lineHeight: 19, color: tok.muted, marginBottom: 10,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>
            {lang === 'ar'
              ? 'اضغط على البنك لنسخ كلمة مفتاحية. ألصقها داخل "تحتوي الرسالة على". أنشئ أتمتة لكل بنك تتعامل معه.'
              : 'Tap a bank to copy a keyword. Paste it in "Message Contains". Create one automation per bank you use.'}
          </Text>
          <View style={{ gap: 6 }}>
            {BANK_KEYWORDS.map((b) => (
              <Pressable
                key={b.label}
                onPress={() => copyKeyword(b.label, b.keywords[0])}
                style={({ pressed }) => ({
                  flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                  alignItems: 'center', justifyContent: 'space-between',
                  paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
                  backgroundColor: pressed ? tok.elevated : tok.surface,
                  borderWidth: 1, borderColor: copied === b.label ? tok.gold : tok.border,
                })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontFamily: fontBody(lang), fontSize: 14, color: tok.bone,
                    textAlign: lang === 'ar' ? 'right' : 'left',
                  }}>
                    {b.label}
                  </Text>
                  <Text style={{
                    fontFamily: fontMono(), fontSize: 11, color: tok.muted, marginTop: 2,
                    textAlign: lang === 'ar' ? 'right' : 'left',
                  }}>
                    {b.keywords.join(' · ')}
                  </Text>
                </View>
                {copied === b.label
                  ? <Check size={16} color={tok.gold} />
                  : <Copy size={14} color={tok.muted} />}
              </Pressable>
            ))}
          </View>
        </StepCard>

        <StepCard step={5} title={lang === 'ar' ? 'إجراء الأتمتة' : 'Action: run Seshat Capture'} tok={tok} lang={lang}>
          <Text style={{
            fontFamily: fontBody(lang), fontSize: 13, lineHeight: 19, color: tok.muted,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>
            {lang === 'ar'
              ? 'بعد المحفّز، اضغط "التالي". أضف الإجراء "تشغيل الاختصار" واختر "Seshat Capture". مرّر "نص الرسالة" كمدخل.'
              : 'After the trigger, tap Next. Add the action "Run Shortcut" and pick "Seshat Capture". Pass "Message Text" as input.'}
          </Text>
        </StepCard>

        <StepCard step={6} title={lang === 'ar' ? 'تعطيل "اسأل قبل التشغيل"' : 'Turn off "Ask Before Running"'} tok={tok} lang={lang}>
          <Text style={{
            fontFamily: fontBody(lang), fontSize: 13, lineHeight: 19, color: tok.muted,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>
            {lang === 'ar'
              ? 'هذا هو السر — بدون تعطيله سيظهر سؤال في كل رسالة. الآن كل رسالة بنكية ستفتح سيشات مع المعاملة مرصودة جاهزة للتأكيد.'
              : 'This is the trick - without disabling it you\'ll get a confirm prompt on every SMS. After this, every bank SMS auto-opens Seshat with the entry ready to confirm.'}
          </Text>
        </StepCard>

        <RCard padding={16}>
          <REyebrow style={{ marginBottom: 6, textAlign: lang === 'ar' ? 'right' : 'left' }}>
            {lang === 'ar' ? 'ما الذي يحدث بعد ذلك؟' : 'What happens next'}
          </REyebrow>
          <Text style={{
            fontFamily: fontBody(lang), fontSize: 13.5, lineHeight: 20, color: tok.muted,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>
            {lang === 'ar'
              ? 'كل رسالة بنكية يحلّلها الذكاء الاصطناعي ويفتح صفحة "رصد" داخل سيشات بالمبلغ والتصنيف. أنت تؤكد أو تعدّل وتحفظ. تظل الخصوصية كاملة — الرسالة لا تُرسل لأي مكان آخر.'
              : 'Each bank SMS gets parsed by Seshat\'s AI and opens the Capture screen with the amount and category pre-filled. You confirm or edit and save. Full privacy - the SMS never goes anywhere else.'}
          </Text>
        </RCard>
      </ScrollView>
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
