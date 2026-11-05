import { useEffect, useState } from 'react';
import { View, Text, Pressable, Platform, Modal, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { LayoutGrid, X } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { fontBody, fontMono } from '../lib/fonts';
import { RCard, RButton } from './ui';

// One-time "new widgets" announcement on the iPhone home screen, shown to everyone who updates and
// opens the app. Tapping it opens a short how-to (adding a widget happens in iOS, not in the app, so
// the app can only explain it). Gone for good once seen or dismissed. Bump the key's suffix to announce
// a future batch of widgets the same way.
const KEY = 'whatsnew_widgets_v1';

export function WidgetsAnnouncement() {
  const { tok, lang } = useI18n();
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);
  const ar = lang === 'ar';

  useEffect(() => {
    if (Platform.OS !== 'ios') return; // widgets exist on iPhone only for now
    SecureStore.getItemAsync(KEY).then((v) => { if (!v) setShow(true); }).catch(() => {});
  }, []);

  if (Platform.OS !== 'ios') return null;

  const seen = () => { setShow(false); SecureStore.setItemAsync(KEY, 'done').catch(() => {}); };

  const steps = ar
    ? [
        'اضغط مطولاً على مكان فارغ في الشاشة الرئيسية.',
        'اضغط على زر + ثم ابحث عن "سيشات".',
        'اختر ودجت: شهرك بنظرة، الميزانيات والبطاقات، حكم ماعت، أو إضافة سريعة.',
        'للقفل: اضغط مطولاً على شاشة القفل ثم تخصيص ثم أضف ودجت سيشات.',
        'افتح سيشات مرة واحدة وأنت مسجّل الدخول لتظهر بياناتك في الودجت.',
      ]
    : [
        'Long-press an empty spot on your Home Screen.',
        'Tap the + button and search for “Seshat”.',
        'Pick a widget: Month at a glance, Budgets and cards, Maat’s verdict, or Quick add.',
        'For the Lock Screen: long-press it, tap Customize, then add a Seshat widget.',
        'Open Seshat once while signed in so the widgets can show your data.',
      ];

  return (
    <>
      {show && (
        <Pressable
          onPress={() => { seen(); setOpen(true); }}
          style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
        >
          <RCard accent padding={14} style={{ marginHorizontal: 16, marginTop: 6, marginBottom: 12 }}>
            <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: tok.elevated, alignItems: 'center', justifyContent: 'center' }}>
                <LayoutGrid size={18} color={tok.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: tok.bone, fontFamily: fontBody(lang, 'semibold'), fontSize: 14, textAlign: ar ? 'right' : 'left' }}>
                  {ar ? 'جديد: ودجت سيشات' : 'New: Seshat widgets'}
                </Text>
                <Text style={{ marginTop: 3, color: tok.muted, fontFamily: fontBody(lang), fontSize: 12, textAlign: ar ? 'right' : 'left' }}>
                  {ar ? 'شهرك وميزانياتك وحكم ماعت على شاشتك الرئيسية وشاشة القفل.' : 'Your month, budgets and Maat’s verdict on your Home and Lock Screen.'}
                </Text>
              </View>
              <Pressable onPress={seen} hitSlop={10} accessibilityLabel={ar ? 'إغلاق' : 'Dismiss'}>
                <X size={16} color={tok.muted} />
              </Pressable>
              <Text style={{ color: tok.gold, fontFamily: fontMono('regular'), fontSize: 14 }}>{ar ? '←' : '→'}</Text>
            </View>
          </RCard>
        </Pressable>
      )}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={{ backgroundColor: tok.void, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 34, borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border }}>
            <Text style={{ color: tok.bone, fontFamily: fontBody(lang, 'semibold'), fontSize: 18, textAlign: ar ? 'right' : 'left' }}>
              {ar ? 'أضف ودجت سيشات' : 'Add a Seshat widget'}
            </Text>
            <View style={{ marginTop: 16, gap: 12 }}>
              {steps.map((s, i) => (
                <View key={i} style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 12, alignItems: 'flex-start' }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: tok.elevated, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                    <Text style={{ color: tok.gold, fontFamily: fontMono('regular'), fontSize: 12 }}>{i + 1}</Text>
                  </View>
                  <Text style={{ flex: 1, color: tok.bone, fontFamily: fontBody(lang), fontSize: 14, lineHeight: 21, textAlign: ar ? 'right' : 'left' }}>{s}</Text>
                </View>
              ))}
            </View>
            <View style={{ marginTop: 22 }}>
              <RButton full onPress={() => setOpen(false)}>{ar ? 'تمام' : 'Got it'}</RButton>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
