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
              ? `كل رسالة بنكية تحمل العملة. أتمتة واحدة تعمل عندما تصلك رسالة تحتوي على "${currency}"، وتسجّلها سيشات في الخلفية دون فتح التطبيق: المبلغ والتاجر والفئة والبطاقة. يصلك إشعار بما سُجّل، وتجد كل بطاقة في الملف الشخصي ← البطاقات.`
              : `Every bank message carries the currency. One automation fires when a message containing "${currency}" arrives, and Seshat logs it in the background without opening the app: amount, merchant, category and card. You get a notification of what was logged, and each card shows up under Profile → Cards.`}
          </Text>
        </RCard>

        <StepCard step={1} title={ar ? 'افتح الاختصارات واضغط +' : 'Open Shortcuts and tap +'} tok={tok} lang={lang}>
          <Text style={para}>
            {ar
              ? 'افتح تطبيق "الاختصارات" واضغط زر + في الأسفل لإنشاء اختصار جديد.'
              : 'Open the Shortcuts app and tap the + button at the bottom to start a new shortcut.'}
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

        <StepCard step={2} title={ar ? 'اختر محفّز "رسالة"' : 'Pick the "Message" trigger'} tok={tok} lang={lang}>
          <Text style={para}>
            {ar
              ? 'في شريط البحث بالأسفل اضغط على "Automation" (الأتمتة)، ثم اختر "Message" (عندما أستلم رسالة).'
              : 'In the search panel at the bottom, tap "Automation", then choose "Message" ("When I receive a message").'}
          </Text>
        </StepCard>

        <StepCard step={3} title={ar ? 'الكلمة المفتاحية' : 'Set the keyword'} tok={tok} lang={lang}>
          <Text style={[para, { marginBottom: 10 }]}>
            {ar
              ? 'سيظهر "Sender is": اضغط على "Sender" وغيّرها إلى "Message" (الرسالة). ثم اضغط الخانة بعد "contains" واكتب الكلمة (اضغط لنسخها)، ثم علامة ✓ في لوحة المفاتيح.'
              : 'You will see "Sender is": tap "Sender" and change it to "Message". Then tap the empty box after "contains", type the keyword (tap to copy), and press ✓ on the keyboard.'}
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
          <Text style={[para, { marginTop: 10 }]}>
            {ar ? 'لو بنكك يرسل بالعربي كرّر الخطوات بالكلمة العربية.' : 'If your bank texts in Arabic, repeat once with the Arabic word.'}
          </Text>
        </StepCard>

        <StepCard step={4} title={ar ? 'أضف إجراء سيشات' : 'Add the Seshat action'} tok={tok} lang={lang}>
          <Text style={para}>
            {ar
              ? 'في شريط البحث بالأسفل اكتب "Seshat"، ثم اضغط "Log bank message". سيظهر تحت المحفّز.'
              : 'In the search panel at the bottom, type "Seshat", then tap "Log bank message". It appears under the trigger.'}
          </Text>
        </StepCard>

        <StepCard step={5} title={ar ? 'مرّر الرسالة' : 'Pass the message'} tok={tok} lang={lang}>
          <Text style={para}>
            {ar
              ? 'اضغط على كلمة "Message" الزرقاء الباهتة داخل الإجراء، ثم من الشريط فوق لوحة المفاتيح اختر "Message".'
              : 'Tap the faded blue "Message" inside the action, then in the bar above the keyboard choose "Message".'}
          </Text>
        </StepCard>

        <StepCard step={6} title={ar ? 'احفظ' : 'Save'} tok={tok} lang={lang}>
          <Text style={para}>
            {ar
              ? 'اضغط سهم الرجوع أعلى اليسار. تُحفظ الأتمتة وتعمل وحدها. جرّب بإرسال رسالة تحتوي على العملة من رقم آخر، ثم افتح الملف الشخصي ← البطاقات.'
              : 'Tap the back arrow at the top left. The automation saves and runs on its own. Test it by texting yourself a message containing the currency from another number, then open Profile → Cards.'}
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
