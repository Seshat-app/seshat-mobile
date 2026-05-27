import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, Animated, Dimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useI18n } from '../lib/i18n';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { RadarMark } from './RadarMark';

// First-launch spotlight tour. Each step (after a centered welcome) dims the
// whole screen except a rectangle around the UI element being explained, with
// a tooltip card positioned just outside that rectangle. Driver.js-style.

const TOUR_FLAG_KEY = 'tour_v2_seen';

type Rect = { x: number; y: number; w: number; h: number };

type StepOpts = {
  W: number;
  H: number;
  insetTop: number;
  insetBottom: number;
};

type Step = {
  titleEn: string; titleAr: string;
  bodyEn: string; bodyAr: string;
  // null = no spotlight (welcome / closing card centered on dim overlay)
  target: ((o: StepOpts) => Rect) | null;
  // Hint to the layout: where to put the tooltip relative to the spotlight.
  cardPosition?: 'above' | 'below' | 'center';
};

// Approximate UI geometry. The tab bar is at the bottom (~58px above the home
// indicator on iOS, similar on Android with edge-to-edge enabled). The FAB
// floats above the tab bar at bottom: 92px right: 20px in RFAB.
function tabRect(tabIndex: 0 | 1 | 2 | 3, o: StepOpts): Rect {
  const tabBarH = 56;
  const tabW = o.W / 4;
  const y = o.H - o.insetBottom - tabBarH;
  return {
    x: tabIndex * tabW + 6,
    y: y + 4,
    w: tabW - 12,
    h: tabBarH - 12,
  };
}

function fabRect(o: StepOpts): Rect {
  // RFAB lives in a flex:1 container that extends to the bottom of the
  // screen (it does NOT respect the bottom safe-area inset). So we measure
  // from the raw screen bottom, not from the safe-area top. Subtracting
  // insetBottom here would push the highlight upward by ~34pt on iPhone.
  const size = 56;
  return {
    x: o.W - 20 - size,
    y: o.H - 92 - size,
    w: size,
    h: size,
  };
}

const STEPS: Step[] = [
  {
    titleEn: 'Welcome.',
    titleAr: 'أهلاً.',
    bodyEn: 'I am Seshat, your scribe of finance. Let me show you the four corners of your ledger.',
    bodyAr: 'أنا Seshat، كاتبتكِ المالية. دعيني أعرّفكِ على أركان دفتركِ الأربعة.',
    target: null,
    cardPosition: 'center',
  },
  {
    titleEn: 'Log anything.',
    titleAr: 'سجّلي أي شيء.',
    bodyEn: 'The gold + button opens a quick entry. Or speak to me in the chat next door and say "spent 200 on coffee".',
    bodyAr: 'زر + الذهبي يفتح إدخالاً سريعًا. أو كلّميني في الدردشة وقولي "صرفت 200 على القهوة".',
    target: fabRect,
    cardPosition: 'above',
  },
  {
    titleEn: 'Your records.',
    titleAr: 'سجلّكِ.',
    bodyEn: 'Every transaction lives in this tab, grouped by day. Long-press any row to edit or delete.',
    bodyAr: 'كل معاملة في هذا التبويب، مجمّعة حسب اليوم. اضغطي مطوّلاً على أي صف للتعديل أو الحذف.',
    target: (o) => tabRect(1, o),
    cardPosition: 'above',
  },
  {
    titleEn: 'Talk to Seshat.',
    titleAr: 'تحدّثي مع Seshat.',
    bodyEn: 'This is where we converse. Ask for a summary, move an entry, set a budget, or just say hi.',
    bodyAr: 'هنا نتحدّث. اطلبي ملخصًا، انقلي معاملة، حدّدي ميزانية، أو فقط قولي مرحبًا.',
    target: (o) => tabRect(2, o),
    cardPosition: 'above',
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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Use screen.height (full physical screen) not window.height. On edge-to-edge
  // Android, window.height excludes the bottom nav-bar height while the Modal
  // we render extends across the full screen. Using window made the spotlight
  // float ~80px above the FAB on Android phones with on-screen nav bars.
  const { width: W, height: H } = Dimensions.get('screen');
  const [step, setStep] = useState(0);

  // Animation for the tooltip card sliding in
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (!visible) { setStep(0); return; }
    // Pin the user on the home tab while the tour runs so the spotlight
    // targets actually have UI under them. Without this, opening from
    // Profile would highlight empty space.
    try { router.replace('/(tabs)'); } catch { /* router not ready */ }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    fade.setValue(0); slide.setValue(20);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [step, visible]);

  if (!visible) return null;

  const cur = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const opts: StepOpts = { W, H, insetTop: insets.top, insetBottom: insets.bottom };
  const targetRect = cur.target ? cur.target(opts) : null;

  const close = async () => {
    await markTourSeen();
    onClose();
  };
  const next = () => (isLast ? close() : setStep((s) => s + 1));

  // Decide tooltip position. If a target is in the lower half, put the card
  // above it. If upper half, below. Centered when no target.
  const cardWidth = Math.min(360, W - 36);
  const cardLeft = (W - cardWidth) / 2;

  let cardTop = 0;
  let cardPlacement: 'above' | 'below' | 'center' = cur.cardPosition ?? 'below';
  if (!targetRect) {
    cardPlacement = 'center';
    cardTop = H / 2 - 160; // approx half the card height up
  } else {
    if (cardPlacement === 'above') {
      // 16px gap above the highlight
      cardTop = targetRect.y - 16 - 220;
      if (cardTop < insets.top + 16) cardPlacement = 'below';
    }
    if (cardPlacement === 'below') {
      cardTop = targetRect.y + targetRect.h + 16;
      if (cardTop + 220 > H - insets.bottom - 16) cardPlacement = 'above';
    }
    if (cardPlacement === 'above') {
      cardTop = targetRect.y - 16 - 220;
      if (cardTop < insets.top + 16) cardTop = insets.top + 16;
    } else if (cardPlacement === 'below') {
      cardTop = Math.max(insets.top + 16, Math.min(cardTop, H - insets.bottom - 220 - 16));
    } else {
      cardTop = H / 2 - 160;
    }
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View style={{ flex: 1 }}>
        {/* Dim layer drawn as four rectangles surrounding the target, so the
            target area itself stays bright. When there's no target, the whole
            screen is dimmed evenly. */}
        {targetRect ? (
          <>
            {/* TOP */}
            <View style={[dim, { top: 0, left: 0, width: W, height: targetRect.y }]} pointerEvents="auto" />
            {/* BOTTOM */}
            <View style={[dim, { top: targetRect.y + targetRect.h, left: 0, width: W, height: H - (targetRect.y + targetRect.h) }]} pointerEvents="auto" />
            {/* LEFT */}
            <View style={[dim, { top: targetRect.y, left: 0, width: targetRect.x, height: targetRect.h }]} pointerEvents="auto" />
            {/* RIGHT */}
            <View style={[dim, { top: targetRect.y, left: targetRect.x + targetRect.w, width: W - (targetRect.x + targetRect.w), height: targetRect.h }]} pointerEvents="auto" />

            {/* Gold ring around the target, slightly inset so it sits inside
                the bright window. Non-interactive so taps go through to the
                element if they want to try it (we still gate Next on the
                button). */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: targetRect.y - 3,
                left: targetRect.x - 3,
                width: targetRect.w + 6,
                height: targetRect.h + 6,
                borderRadius: 16,
                borderWidth: 2,
                borderColor: tok.gold,
              }}
            />
          </>
        ) : (
          <View style={[dim, { top: 0, left: 0, width: W, height: H }]} pointerEvents="auto" />
        )}

        {/* Tooltip card */}
        <Animated.View
          style={{
            position: 'absolute',
            top: cardTop, left: cardLeft, width: cardWidth,
            opacity: fade,
            transform: [{ translateY: slide }],
            backgroundColor: tok.surface,
            borderRadius: 18,
            borderWidth: 1, borderColor: tok.border,
            paddingVertical: 18, paddingHorizontal: 18,
            gap: 12,
            // Lift the card so its shadow reads against the dim
            shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 6 },
            elevation: 12,
          }}
        >
          {/* Top row: step indicator + Skip */}
          <View style={{
            flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
            alignItems: 'center', justifyContent: 'space-between',
          }}>
            <Text style={{
              fontFamily: fontMono('regular'), fontSize: 10, color: tok.gold,
              letterSpacing: 1.6,
            }}>
              {lang === 'ar'
                ? `${step + 1} من ${STEPS.length}`
                : `STEP ${step + 1} / ${STEPS.length}`}
            </Text>
            <Pressable onPress={close} hitSlop={10}>
              <Text style={{
                fontFamily: fontMono('regular'), fontSize: 11, letterSpacing: 1.4, color: tok.muted,
              }}>{lang === 'ar' ? 'تخطّي' : 'SKIP'}</Text>
            </Pressable>
          </View>

          {/* Welcome step gets the RadarMark; the rest are tight and focused */}
          {!targetRect && (
            <View style={{ alignItems: 'center', paddingVertical: 4 }}>
              <RadarMark size={56} gold={tok.gold} lightRing />
            </View>
          )}

          <Text style={{
            fontFamily: fontHead(lang), fontSize: 22, color: tok.bone,
            letterSpacing: -0.4,
            textAlign: targetRect ? (lang === 'ar' ? 'right' : 'left') : 'center',
          }}>
            {lang === 'ar' ? cur.titleAr : cur.titleEn}
          </Text>

          <Text style={{
            fontFamily: fontBody(lang), fontSize: 14, color: tok.bone, opacity: 0.85,
            lineHeight: 21,
            textAlign: targetRect ? (lang === 'ar' ? 'right' : 'left') : 'center',
            writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
          }}>
            {lang === 'ar' ? cur.bodyAr : cur.bodyEn}
          </Text>

          {/* Dots + Next button */}
          <View style={{
            flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
            alignItems: 'center', justifyContent: 'space-between',
            marginTop: 2,
          }}>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {STEPS.map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === step ? 16 : 5, height: 5, borderRadius: 3,
                    backgroundColor: i === step ? tok.gold : tok.border,
                  }}
                />
              ))}
            </View>

            <Pressable
              onPress={next}
              style={({ pressed }) => ({
                backgroundColor: pressed ? tok.goldLight : tok.gold,
                paddingVertical: 9, paddingHorizontal: 18,
                borderRadius: 999,
              })}
            >
              <Text style={{
                fontFamily: fontMono('regular'), fontSize: 11, letterSpacing: 1.4,
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

const dim = {
  position: 'absolute' as const,
  backgroundColor: Platform.select({
    ios: 'rgba(8, 8, 10, 0.78)',
    default: 'rgba(8, 8, 10, 0.84)',
  }),
};
