import { useEffect, useRef } from 'react';
import { View, Text, Pressable, Modal, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useI18n } from '../lib/i18n';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { SeshatMark } from './SeshatMark';

// First-launch welcome. One calm, premium screen (gold-on-void) that sets the
// tone and introduces Seshat (the record) and Maat (the voice you talk to),
// instead of the old driver.js-style coachmark spotlight that dimmed the app
// and pointed at tab bars. Same flag + mount wiring as before.

const TOUR_FLAG_KEY = 'tour_v2_seen';

export async function hasTourBeenSeen(): Promise<boolean> {
  try { return (await SecureStore.getItemAsync(TOUR_FLAG_KEY)) === '1'; } catch { return false; }
}
export async function markTourSeen(): Promise<void> {
  try { await SecureStore.setItemAsync(TOUR_FLAG_KEY, '1'); } catch { /* swallow */ }
}
export async function resetTour(): Promise<void> {
  try { await SecureStore.deleteItemAsync(TOUR_FLAG_KEY); } catch { /* swallow */ }
}

export function Tour({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { tok, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const ar = lang === 'ar';

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    if (!visible) { fade.setValue(0); rise.setValue(24); return; }
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [visible]);

  if (!visible) return null;

  const close = async () => { await markTourSeen(); onClose(); };

  const beats: { en: string; ar: string }[] = [
    {
      en: "Log by text, voice, a receipt photo, or your bank's alert.",
      ar: 'سجّل بالكتابة أو الصوت أو صورة إيصال أو تنبيه بنكك.',
    },
    {
      en: 'Talk to Maat — ask for a summary, set a budget, or just say hi.',
      ar: 'تحدّث مع ماعت — اطلب ملخصاً، حدّد ميزانية، أو قل مرحباً.',
    },
    {
      en: 'English or Egyptian Arabic, from the first word.',
      ar: 'إنجليزي أو عربي مصري، من أول كلمة.',
    },
  ];

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: tok.void }}>
        {/* gold atmosphere behind the seal */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '62%' }}>
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="welcomeGlow" cx="50%" cy="28%" r="62%">
                <Stop offset="0" stopColor={tok.gold} stopOpacity="0.16" />
                <Stop offset="1" stopColor={tok.gold} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx="50%" cy="28%" r="62%" fill="url(#welcomeGlow)" />
          </Svg>
        </View>

        <Animated.View
          style={{
            flex: 1,
            paddingTop: insets.top + 64,
            paddingBottom: insets.bottom + 28,
            paddingHorizontal: 28,
            opacity: fade,
            transform: [{ translateY: rise }],
            alignItems: 'center',
          }}
        >
          <SeshatMark size={72} gold={tok.gold} animate />

          <Text style={{
            fontFamily: fontMono('regular'), fontSize: 11, letterSpacing: 3,
            color: tok.gold, textTransform: 'uppercase', marginTop: 26,
          }}>{ar ? 'سيشات' : 'SESHAT'}</Text>

          <Text style={{
            fontFamily: fontHead(lang, 'bold'), fontSize: ar ? 34 : 38, color: tok.bone,
            letterSpacing: ar ? 0 : -0.5, marginTop: 10, textAlign: 'center',
          }}>{ar ? 'أهلاً بك.' : 'Welcome.'}</Text>

          <Text style={{
            fontFamily: fontBody(lang), fontSize: 15, lineHeight: 22, color: tok.muted,
            marginTop: 12, textAlign: 'center', maxWidth: 320,
            writingDirection: ar ? 'rtl' : 'ltr',
          }}>{ar
            ? 'سيشات تحفظ كل سجل. وماعت تقرأه لك بصدق.'
            : 'Seshat keeps every record. Maat reads it back to you, honestly.'}</Text>

          <View style={{ marginTop: 36, gap: 18, width: '100%', maxWidth: 380 }}>
            {beats.map((b, i) => (
              <View key={i} style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 14 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tok.gold, marginTop: 7 }} />
                <Text style={{
                  flex: 1, fontFamily: fontBody(lang), fontSize: 14.5, lineHeight: 21, color: tok.bone,
                  textAlign: ar ? 'right' : 'left', writingDirection: ar ? 'rtl' : 'ltr',
                }}>{ar ? b.ar : b.en}</Text>
              </View>
            ))}
          </View>

          <View style={{ flex: 1 }} />

          <Pressable
            onPress={close}
            style={({ pressed }) => ({
              backgroundColor: tok.gold, borderRadius: 999, paddingVertical: 15,
              alignItems: 'center', width: '100%', maxWidth: 380,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{
              fontFamily: fontMono('regular'), fontSize: 13, letterSpacing: 1.6,
              color: '#0D0D0D', textTransform: 'uppercase',
            }}>{ar ? 'لنبدأ' : 'Begin'}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}
