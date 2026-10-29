import { Fragment, useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, TextInput, Animated, Easing,
  ScrollView, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, Check } from 'lucide-react-native';
import { useI18n, currencyLabel } from '../lib/i18n';
import { apiFetch } from '../lib/api';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { RField } from './ui';
import { SeshatSeal } from './SeshatSeal';
import { ScreenAtmosphere } from './ScreenAtmosphere';

// ─────────────────────────────────────────────────────────────
// OnboardingTour — a guided, ceremonial walk that mirrors the landing's
// chamber tour. One fixed gold-on-void atmosphere; each scene rises in, Seshat
// narrates, one thing is collected, and the last scene is the threshold into
// the app. Scenes: Gate, Name (EN + AR), Salary, Month-start, Threshold.
//
// On finish it PATCHes /me with whatever the traveler supplied (name, Arabic
// name, salary, month-start day) and calls onDone. Anything skipped is simply
// omitted so it stays editable later from Profile.
// ─────────────────────────────────────────────────────────────
// iPhones get one extra scene: installing the bank-SMS capture Shortcut (Apple does not
// let apps read other apps' notifications, so the Shortcuts app does the capturing).
const SCENES = (Platform.OS === 'ios'
  ? ['gate', 'name', 'salary', 'month', 'capture', 'threshold']
  : ['gate', 'name', 'salary', 'month', 'threshold']) as readonly ('gate' | 'name' | 'salary' | 'month' | 'capture' | 'threshold')[];
const SHORTCUT_URL =
  'shortcuts://import-shortcut?url=' + encodeURIComponent('https://seshat.site/seshat-capture.shortcut') + '&name=' + encodeURIComponent('Seshat Capture');
// The stepper shows for the four numbered scenes (Gate..Month); the threshold
// is the finale and drops it.
const RAIL_COUNT = Platform.OS === 'ios' ? 5 : 4;
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

export function OnboardingTour({
  initialName, currency = 'EGP', onDone,
}: { initialName?: string; currency?: string; onDone: () => void }) {
  const { tok, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const ar = lang === 'ar';

  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName ?? '');
  const [nameAr, setNameAr] = useState('');
  const [salary, setSalary] = useState('');
  const [monthDay, setMonthDay] = useState(1);
  const [busy, setBusy] = useState(false);

  const scene = SCENES[step];

  // Per-scene rise-in: opacity + lift, replayed on every step change.
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    rise.setValue(0);
    Animated.timing(rise, {
      toValue: 1, duration: 540, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  const riseStyle = {
    opacity: rise,
    transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }],
  };

  const goNext = () => setStep((s) => Math.min(SCENES.length - 1, s + 1));
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const finish = async () => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { monthStartDay: monthDay };
      if (name.trim()) body.displayName = name.trim();
      if (nameAr.trim()) body.displayNameAr = nameAr.trim();
      const sal = parseFloat(salary.replace(/,/g, '')) || 0;
      if (sal > 0) body.monthlySalary = sal;
      await apiFetch('/me', { method: 'PATCH', body: JSON.stringify(body) });
    } catch (err) {
      console.warn('onboarding save failed', err);
    } finally {
      setBusy(false);
      onDone();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: tok.void }}>
      <ScreenAtmosphere />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, paddingTop: insets.top }}
      >
        {/* Top bar: animated stepper (hidden on the threshold finale) + back */}
        <View style={{
          height: 40, paddingHorizontal: 22, marginTop: 6,
          flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {scene !== 'threshold' && step > 0 ? (
            <Pressable onPress={goBack} hitSlop={10}>
              <Text style={{
                color: tok.muted, fontFamily: fontMono('regular'), fontSize: 10,
                letterSpacing: 1.6, textTransform: ar ? 'none' : 'uppercase',
              }}>{ar ? 'رجوع' : 'Back'}</Text>
            </Pressable>
          ) : <View style={{ width: 40 }} />}
          {scene !== 'threshold' && <StepRail active={step} ar={ar} />}
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[{ flex: 1 }, riseStyle]}>

            {scene === 'gate' && (
              <Centered>
                <Medallion size={92} animate />
                <Narration text={ar
                  ? 'أهلاً. سيشات تحفظ الحساب، وماعت تقرأ الحقيقة.'
                  : 'Welcome. Seshat keeps the count, Maat reads the truth.'} />
                <Headline l1={ar ? 'تفضّل' : 'Step'} l2={ar ? 'بالدخول' : 'inside'} />
                <Spacer />
                <CTA label={ar ? 'لنبدأ' : 'Begin'} onPress={goNext} />
                <BeginHint label={ar ? `${RAIL_COUNT} لحظات قصيرة` : `${RAIL_COUNT} quick scenes`} />
              </Centered>
            )}

            {scene === 'name' && (
              <SceneBody
                narration={ar ? 'أولاً، بم نناديك؟ تناديك سيشات باسمك.' : 'First, what shall we call you? Seshat greets you by name.'}
                l1={ar ? 'ما' : 'Your'} l2={ar ? 'اسمك' : 'name'}
              >
                <View style={{ gap: 12, marginTop: 26 }}>
                  <RField label={ar ? 'الاسم' : 'Name'} value={name} onChange={setName}
                    placeholder={ar ? 'اسمك' : 'Your name'} autoFocus />
                  <RField label={ar ? 'الاسم بالعربي' : 'Arabic name'} value={nameAr} onChange={setNameAr}
                    placeholder={ar ? 'للترحيب بالعربية' : 'مؤمن'} />
                </View>
                <Spacer />
                <CTA label={ar ? 'متابعة' : 'Continue'} onPress={goNext} />
              </SceneBody>
            )}

            {scene === 'salary' && (
              <SceneBody
                narration={ar ? 'كم يدخل كل شهر؟ تقيس سيشات الباقي بالنسبة له.' : 'What flows in each month? Seshat measures the rest against it.'}
                l1={ar ? 'الراتب' : 'Monthly'} l2={ar ? 'الشهري' : 'salary'}
              >
                <View style={{
                  marginTop: 30, flexDirection: 'row', alignItems: 'baseline',
                  justifyContent: 'center', gap: 10,
                }}>
                  <TextInput
                    value={salary}
                    onChangeText={(v) => setSalary(v.replace(/[^0-9.]/g, ''))}
                    placeholder="0"
                    placeholderTextColor={tok.muted}
                    keyboardType="decimal-pad"
                    autoFocus
                    style={{
                      color: tok.bone, fontFamily: fontMono('medium'), fontSize: 48,
                      letterSpacing: -1.5, padding: 0, minWidth: 70, textAlign: 'center',
                      writingDirection: 'ltr',
                    }}
                  />
                  <Text style={{ color: tok.muted, fontFamily: fontMono('regular'), fontSize: 16 }}>
                    {currencyLabel(currency, lang)}
                  </Text>
                </View>
                <Pressable onPress={goNext} hitSlop={8} style={{ alignSelf: 'center', marginTop: 12 }}>
                  <Text style={{ color: tok.muted, fontFamily: fontBody(lang), fontSize: 12.5 }}>
                    {ar ? 'تخطّي الآن' : 'Skip for now'}
                  </Text>
                </Pressable>
                <Spacer />
                <CTA label={ar ? 'متابعة' : 'Continue'} onPress={goNext} />
              </SceneBody>
            )}

            {scene === 'month' && (
              <SceneBody
                narration={ar ? 'متى يبدأ شهرك؟ حدّد يوم راتبك.' : 'When does your month begin? Set your payday.'}
                l1={ar ? '' : 'Your'} l2={ar ? 'شهرك' : 'month'}
              >
                <DayGrid value={monthDay} onSelect={setMonthDay} />
                <Text style={{
                  marginTop: 14, textAlign: 'center', fontFamily: fontMono('regular'),
                  fontSize: 11.5, color: tok.bone,
                }}>
                  <Text style={{ color: tok.muted }}>{ar ? 'شهرك: ' : 'Your month: '}</Text>
                  <Text style={{ color: tok.gold }}>{windowLabel(monthDay, lang)}</Text>
                </Text>
                <Spacer />
                <CTA label={ar ? 'متابعة' : 'Continue'} onPress={goNext} />
              </SceneBody>
            )}

            {scene === 'capture' && (
              <SceneBody
                narration={ar
                  ? 'ليسجّل سيشات معاملات بنكك تلقائياً: ثبّت اختصار "Seshat Capture"، ثم اضبط الأتمتة مرة واحدة.'
                  : 'Let Seshat log your bank messages automatically: add the "Seshat Capture" shortcut, then set up the automation once.'}
                l1={ar ? 'الرصد' : 'Auto'} l2={ar ? 'التلقائي' : 'capture'}
              >
                <Text style={{
                  marginTop: 22, textAlign: 'center', fontFamily: fontBody(lang), fontSize: 13.5,
                  lineHeight: 20, color: tok.muted,
                }}>
                  {ar
                    ? 'بعد إضافة الاختصار افتح تطبيق الاختصارات ← الأتمتة ← أتمتة شخصية ← رسالة، واختر اسم بنكك. الخطوات الكاملة في الملف الشخصي ← الرصد التلقائي.'
                    : 'After adding it, open Shortcuts → Automation → New Personal Automation → Message, and pick your bank. Full steps are always in Profile → Auto-capture.'}
                </Text>
                <Spacer />
                <CTA label={ar ? 'إضافة الاختصار' : 'Get the Shortcut'} onPress={() => { void Linking.openURL(SHORTCUT_URL).catch(() => {}); }} />
                <Pressable onPress={goNext} hitSlop={8} style={{ alignSelf: 'center', marginTop: 14 }}>
                  <Text style={{ color: tok.muted, fontFamily: fontBody(lang), fontSize: 12.5 }}>
                    {ar ? 'لاحقاً' : 'Maybe later'}
                  </Text>
                </Pressable>
              </SceneBody>
            )}

            {scene === 'threshold' && (
              <Centered>
                <Medallion size={104} animate big />
                <Narration text={ar
                  ? `تمّ${name.trim() ? ` يا ${name.trim()}` : ''}. سجلّك مفتوح.`
                  : `It is done${name.trim() ? `, ${name.trim()}` : ''}. Your ledger is open.`} />
                <Headline l1={ar ? 'ادخل' : 'Enter'} l2={ar ? 'سيشات' : 'Seshat'} />
                <Spacer />
                <CTA label={ar ? 'ابدأ' : 'Enter'} onPress={finish} loading={busy} icon="enter" />
              </Centered>
            )}

          </Animated.View>
        </ScrollView>

        {/* Hairline doorway rule, echoing the landing's gate */}
        <View pointerEvents="none" style={{
          position: 'absolute', bottom: insets.bottom + 12, left: '18%', right: '18%', height: 1,
          backgroundColor: tok.glowShellBorder,
        }} />
      </KeyboardAvoidingView>
    </View>
  );
}

// ── layout helpers ───────────────────────────────────────────
function Centered({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 0 }}>{children}</View>;
}
function SceneBody({
  narration, l1, l2, children,
}: { narration: string; l1: string; l2: string; children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, paddingTop: 18 }}>
      <Narration text={narration} align />
      <Headline l1={l1} l2={l2} align />
      {children}
    </View>
  );
}
function Spacer() { return <View style={{ flex: 1, minHeight: 24 }} />; }

// ── animated stepper ─────────────────────────────────────────
// Each node carries its own spring (0 = pending, 1 = reached). The colour and
// scale interpolate off it; the active node also rides a looping halo pulse.
// Connectors fade gold as their right-hand node is reached. The whole rail
// re-springs (staggered) on every step change for the "fancy" feel.
function StepRail({ active, ar }: { active: number; ar: boolean }) {
  const { tok } = useI18n();
  const vals = useRef(Array.from({ length: RAIL_COUNT }, (_, i) => new Animated.Value(i <= active ? 1 : 0))).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // JS driver (not native): these values drive backgroundColor + color
    // interpolations, which the native animated module does not support.
    Animated.stagger(70, vals.map((v, i) => Animated.spring(v, {
      toValue: i <= active ? 1 : 0, useNativeDriver: false, friction: 7, tension: 70,
    }))).start();
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const nodes = Array.from({ length: RAIL_COUNT });
  return (
    <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center' }}>
      {nodes.map((_, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <Animated.View style={{
              width: 16, height: 1.5, borderRadius: 1,
              backgroundColor: tok.glowShellBorder,
              opacity: vals[i].interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
            }}>
              <Animated.View style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, right: 0,
                backgroundColor: tok.gold, borderRadius: 1, opacity: vals[i],
              }} />
            </Animated.View>
          )}
          <RailNode val={vals[i]} pulse={pulse} active={i === active} label={ROMAN[i]} tok={tok} />
        </Fragment>
      ))}
    </View>
  );
}

function RailNode({ val, pulse, active, label, tok }: {
  val: Animated.Value; pulse: Animated.Value; active: boolean; label: string; tok: any;
}) {
  const scale = val.interpolate({ inputRange: [0, 1], outputRange: [0.92, active ? 1.12 : 1] });
  return (
    <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
      {active && (
        <Animated.View style={{
          position: 'absolute', width: 22, height: 22, borderRadius: 11,
          backgroundColor: tok.glowShellBg,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.85] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] }) }],
        }} />
      )}
      <Animated.View style={{
        width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: tok.glowShellBorder,
        transform: [{ scale }],
        backgroundColor: val.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.03)', tok.gold] }),
      }}>
        <Animated.Text style={{
          fontFamily: fontMono('medium'), fontSize: 8.5, letterSpacing: 0.5,
          color: val.interpolate({ inputRange: [0, 1], outputRange: [tok.muted, tok.void] }),
        }}>{label}</Animated.Text>
      </Animated.View>
    </View>
  );
}

// ── shared scene atoms ───────────────────────────────────────
function Medallion({ size = 92, animate }: { size?: number; animate?: boolean; big?: boolean }) {
  const { tok } = useI18n();
  return (
    <View style={{ marginBottom: 22 }}>
      <SeshatSeal size={size} animate={animate} gold={tok.gold} />
    </View>
  );
}

function Narration({ text, align }: { text: string; align?: boolean }) {
  const { tok, lang } = useI18n();
  return (
    <Text style={{
      fontFamily: fontBody(lang), fontWeight: '300', fontSize: 13.5, lineHeight: 21,
      color: tok.muted, maxWidth: 280,
      textAlign: align ? (lang === 'ar' ? 'right' : 'left') : 'center',
      writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
      marginTop: align ? 4 : 18,
    }}>{text}</Text>
  );
}

function Headline({ l1, l2, align }: { l1: string; l2: string; align?: boolean }) {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  return (
    <Text style={{
      fontFamily: fontHead(lang), fontSize: ar ? 34 : 42, lineHeight: ar ? 46 : 44,
      letterSpacing: ar ? 0 : -1.8, color: tok.bone, marginTop: 14,
      textAlign: align ? (ar ? 'right' : 'left') : 'center',
      writingDirection: ar ? 'rtl' : 'ltr',
    }}>
      {l1}{l1 && l2 ? (ar ? ' ' : '\n') : ''}<Text style={{ color: tok.gold }}>{l2}</Text>
    </Text>
  );
}

function BeginHint({ label }: { label: string }) {
  const { tok } = useI18n();
  return (
    <View style={{ alignItems: 'center', gap: 6, marginTop: 18 }}>
      <Text style={{
        fontFamily: fontMono('regular'), fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: tok.muted,
      }}>{label}</Text>
    </View>
  );
}

function CTA({ label, onPress, loading, icon = 'arrow' }: {
  label: string; onPress: () => void; loading?: boolean; icon?: 'arrow' | 'enter';
}) {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const Icon = icon === 'enter' ? Check : ArrowRight;
  return (
    <Pressable
      onPress={loading ? undefined : onPress}
      disabled={loading}
      style={({ pressed }) => ({
        alignSelf: 'center',
        flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 10,
        paddingVertical: 11, paddingHorizontal: 12,
        paddingLeft: ar ? 12 : 22, paddingRight: ar ? 22 : 12,
        borderRadius: 999, backgroundColor: tok.gold,
        opacity: pressed || loading ? 0.9 : 1, minWidth: 180, justifyContent: 'center',
        shadowColor: tok.gold, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
      })}
    >
      <Text style={{
        fontFamily: fontMono('medium'), fontSize: 12.5, letterSpacing: 1, textTransform: ar ? 'none' : 'uppercase',
        color: tok.void,
      }}>{label}</Text>
      <View style={{
        width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(13,13,13,0.16)',
      }}>
        <Icon size={14} color={tok.void} strokeWidth={2.2} style={{ transform: [{ scaleX: ar && icon === 'arrow' ? -1 : 1 }] }} />
      </View>
    </Pressable>
  );
}

// ── day grid ─────────────────────────────────────────────────
function DayGrid({ value, onSelect }: { value: number; onSelect: (d: number) => void }) {
  const { tok } = useI18n();
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 22 }}>
      {days.map((d) => {
        const on = d === value;
        return (
          <Pressable
            key={d}
            onPress={() => onSelect(d)}
            style={({ pressed }) => ({
              width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
              backgroundColor: on ? tok.gold : 'rgba(255,255,255,0.03)',
              borderWidth: 1, borderColor: on ? tok.gold : tok.border,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{
              fontFamily: fontMono(on ? 'medium' : 'regular'), fontSize: 12,
              color: on ? tok.void : tok.muted,
            }}>{d}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Build a friendly "Jun 25 → Jul 24" window from the chosen start day, anchored
// to today. Clamps the day to each month's length so day 31 still resolves.
function windowLabel(day: number, lang: 'en' | 'ar'): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  let sy = y, sm = m;
  if (d < day) { sm = m - 1; if (sm < 0) { sm = 11; sy = y - 1; } }
  const clamp = (yy: number, mm: number) => Math.min(day, new Date(yy, mm + 1, 0).getDate());
  const start = new Date(sy, sm, clamp(sy, sm));
  const end = new Date(sy, sm + 1, clamp(sy, sm + 1));
  end.setDate(end.getDate() - 1);
  const fmt = (dt: Date) => dt.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)} → ${fmt(end)}`;
}
