import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, Animated, Dimensions } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useI18n } from '../lib/i18n';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { RadarMark } from './RadarMark';

// First-launch walkthrough. 4 stops, dismissable at any time, runs once per
// install (persisted in expo-secure-store). User can re-trigger it from
// Profile → "Replay tour" if they want a refresher.

const TOUR_FLAG_KEY = 'tour_v1_seen';

type Step = {
  titleEn: string; titleAr: string;
  bodyEn: string; bodyAr: string;
};

const STEPS: Step[] = [
  {
    titleEn: 'Welcome.',
    titleAr: 'أهلاً.',
    bodyEn: 'I am Seshat — your scribe of finance. This is your home: income, balance, and what you have been spending most on, all at a glance.',
    bodyAr: 'أنا Seshat، كاتبتكِ المالية. هذه شاشتكِ الرئيسية: الدخل، الرصيد، وأكثر ما تنفقين عليه، في نظرة واحدة.',
  },
  {
    titleEn: 'Your records.',
    titleAr: 'سجلّكِ.',
    bodyEn: 'The Records tab holds every transaction, grouped by day. Long-press any row to edit it or delete it.',
    bodyAr: 'تبويب السجلات يحتوي على كل معاملة، مجمّعة حسب اليوم. اضغطي مطوّلاً على أي صف لتعديله أو حذفه.',
  },
  {
    titleEn: 'Log something.',
    titleAr: 'سجّلي شيئًا.',
    bodyEn: 'Tap the gold + button in the bottom corner to add a transaction. Or just talk to me — say "spent 200 on coffee" and I will record it.',
    bodyAr: 'اضغطي على زر + الذهبي في الزاوية لإضافة معاملة. أو تحدّثي معي مباشرةً — قولي "صرفت 200 على القهوة" وأنا أسجّلها.',
  },
  {
    titleEn: 'Talk to me.',
    titleAr: 'تحدّثي معي.',
    bodyEn: 'The Seshat tab is where we converse. Ask for a summary, set a budget, move an entry to a different category — whatever you need. I am ready.',
    bodyAr: 'تبويب Seshat هو حيث نتحدّث. اطلبي ملخصًا، حدّدي ميزانية، انقلي معاملة لتصنيف آخر — مهما احتجتِ. أنا جاهزة.',
  },
];

export async function hasTourBeenSeen(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(TOUR_FLAG_KEY);
    return v === '1';
  } catch { return false; }
}

export async function markTourSeen(): Promise<void> {
  try { await SecureStore.setItemAsync(TOUR_FLAG_KEY, '1'); } catch { /* swallow */ }
}

export async function resetTour(): Promise<void> {
  try { await SecureStore.deleteItemAsync(TOUR_FLAG_KEY); } catch { /* swallow */ }
}

export function Tour({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { tok, lang } = useI18n();
  const [step, setStep] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (!visible) { setStep(0); return; }
    fade.setValue(0); slide.setValue(20);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [visible, step]);

  if (!visible) return null;

  const cur = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const close = async () => {
    await markTourSeen();
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      {/* Heavy dim — the underlying screen is still visible faintly so users
          orient themselves to where things are. */}
      <View style={{
        flex: 1, backgroundColor: 'rgba(8,8,10,0.88)',
        alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 22,
      }}>
        <Animated.View style={{
          width: '100%', maxWidth: 380,
          opacity: fade,
          transform: [{ translateY: slide }],
          backgroundColor: tok.surface,
          borderRadius: 22,
          borderWidth: 1, borderColor: tok.border,
          paddingVertical: 28, paddingHorizontal: 22,
          gap: 18,
        }}>
          <View style={{ alignItems: 'center' }}>
            <RadarMark size={64} gold={tok.gold} lightRing />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{
              fontFamily: fontMono('regular'), fontSize: 10, color: tok.gold,
              letterSpacing: 1.6, textAlign: 'center',
            }}>
              {lang === 'ar'
                ? `${step + 1} من ${STEPS.length}`
                : `STEP ${step + 1} / ${STEPS.length}`}
            </Text>
            <Text style={{
              fontFamily: fontHead(lang), fontSize: 24, color: tok.bone,
              textAlign: 'center', letterSpacing: -0.4,
            }}>
              {lang === 'ar' ? cur.titleAr : cur.titleEn}
            </Text>
          </View>

          <Text style={{
            fontFamily: fontBody(lang), fontSize: 15, color: tok.bone, opacity: 0.85,
            textAlign: 'center', lineHeight: 22,
            writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
          }}>
            {lang === 'ar' ? cur.bodyAr : cur.bodyEn}
          </Text>

          {/* Dots row */}
          <View style={{
            flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 2,
          }}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === step ? 18 : 6, height: 6, borderRadius: 3,
                  backgroundColor: i === step ? tok.gold : tok.border,
                }}
              />
            ))}
          </View>

          {/* Actions */}
          <View style={{
            flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
            alignItems: 'center', justifyContent: 'space-between',
            marginTop: 4,
          }}>
            <Pressable onPress={close} hitSlop={10}>
              <Text style={{
                fontFamily: fontMono('regular'), fontSize: 11, letterSpacing: 1.4,
                color: tok.muted,
              }}>{lang === 'ar' ? 'تخطّي' : 'SKIP'}</Text>
            </Pressable>

            <Pressable
              onPress={() => (isLast ? close() : setStep((s) => s + 1))}
              style={({ pressed }) => ({
                backgroundColor: pressed ? tok.goldLight : tok.gold,
                paddingVertical: 11, paddingHorizontal: 22,
                borderRadius: 999,
              })}
            >
              <Text style={{
                fontFamily: fontMono('regular'), fontSize: 11, letterSpacing: 1.6,
                color: '#0D0D0D',
              }}>
                {isLast
                  ? (lang === 'ar' ? 'لنبدأ' : "LET'S BEGIN")
                  : (lang === 'ar' ? 'التالي' : 'NEXT')}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
