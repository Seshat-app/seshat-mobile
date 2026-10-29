import { memo, useEffect, useRef } from 'react';
import { View, Text, Animated, ActivityIndicator } from 'react-native';
import { Sparkles, Scale, Search, ArrowRightLeft, Check, AlertCircle } from 'lucide-react-native';
import type { LucideProps } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useI18n } from '../lib/i18n';
import { fontMono } from '../lib/fonts';
import type { ActivityStep, ActivityKind } from '../lib/chatStream';

/**
 * The assistant's live-activity trace — the Claude-style "thinking / doing"
 * steps shown above a reply. Rendered as a plain list of rows (a kind-specific
 * icon + the step label), with a subtle staggered fade-in so the steps read as
 * they happen. No container, no collapse — just the activities. Gold-on-void,
 * theme + RTL aware. Ports the spirit of the web ActivityTrace.
 */

// Icon per step kind. A tool step that read entries gets a Search glyph; every
// other tool (weighing, drawing, recording) gets the Scale — Maat's balance.
function iconFor(step: ActivityStep): ComponentType<LucideProps> {
  switch (step.kind) {
    case 'think':
      return Sparkles;
    case 'handoff':
      return ArrowRightLeft;
    case 'result':
      return Check;
    case 'tool':
    default:
      return /read|recent|entr/i.test(step.label) ? Search : Scale;
  }
}

function Row({ step, index, busy }: { step: ActivityStep; index: number; busy?: boolean }) {
  const { tok, lang } = useI18n();
  const anim = useRef(new Animated.Value(0)).current;
  // While a step is the one in flight, breathe its label so the trace reads as
  // live work rather than a finished list.
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!busy) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.45, duration: 620, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 620, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [busy, pulse]);

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }).start();
    }, index * 40);
    return () => clearTimeout(t);
    // Only animate in on first appearance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const failed = step.kind === 'tool' && step.ok === false;
  const Icon = failed ? AlertCircle : iconFor(step);
  const kindTone: Record<ActivityKind, string> = {
    think: tok.muted,
    tool: tok.gold,
    handoff: tok.gold,
    result: tok.posText,
  };
  const tone = failed ? tok.alertText : kindTone[step.kind];

  const dir = lang === 'ar' ? -4 : 4;

  return (
    <Animated.View
      style={{
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        gap: 8,
        paddingVertical: 1,
        opacity: anim,
        transform: [
          {
            translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [dir, 0] }),
          },
        ],
      }}
    >
      <View style={{ marginTop: 2, width: 12, alignItems: 'center', justifyContent: 'center' }}>
        {busy ? (
          <ActivityIndicator
            size="small"
            color={tok.gold}
            style={{ transform: [{ scale: 0.6 }] }}
          />
        ) : (
          <Icon size={12} color={tone} strokeWidth={1.9} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Animated.Text
          style={{
            fontFamily: fontMono('regular'),
            fontSize: 11,
            letterSpacing: 0.3,
            lineHeight: 16,
            color: busy ? tok.gold : tok.muted,
            opacity: busy ? pulse : 1,
            textAlign: lang === 'ar' ? 'right' : 'left',
            writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
          }}
        >
          {step.label}
        </Animated.Text>
        {!!step.detail && (
          <Text
            style={{
              fontFamily: fontMono('regular'),
              fontSize: 10,
              letterSpacing: 0.2,
              marginTop: 1,
              color: tok.muted,
              opacity: 0.75,
              textAlign: lang === 'ar' ? 'right' : 'left',
              writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
            }}
          >
            {step.detail}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

// Shown the instant a turn starts — before the first step frame lands — so the
// trace always leads with a visible loading state instead of dead space.
function PendingRow() {
  const { tok, lang } = useI18n();
  return (
    <View
      style={{
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 1,
      }}
    >
      <View style={{ width: 12, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="small" color={tok.gold} style={{ transform: [{ scale: 0.6 }] }} />
      </View>
      <Text
        style={{
          fontFamily: fontMono('regular'),
          fontSize: 11,
          letterSpacing: 0.3,
          lineHeight: 16,
          color: tok.gold,
          textAlign: lang === 'ar' ? 'right' : 'left',
          writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
        }}
      >
        {lang === 'ar' ? 'جارٍ العمل…' : 'Working…'}
      </Text>
    </View>
  );
}

function ActivityTraceInner({ steps, active }: { steps?: ActivityStep[]; active?: boolean }) {
  const list = steps ?? [];
  if (list.length === 0 && !active) return null;

  // Drop consecutive duplicates so a repeated step doesn't read twice in a row.
  const rows = list.filter(
    (s, i) => !(i > 0 && s.label === list[i - 1].label && s.kind === list[i - 1].kind),
  );

  return (
    // minWidth stops the trace — and the streaming bubble wrapped around it —
    // from shrink-wrapping so tightly that a label breaks mid-word.
    <View style={{ gap: 3, marginTop: 2, marginBottom: 6, minWidth: 210 }}>
      {rows.map((step, i) => (
        <Row
          key={`${i}-${step.kind}-${step.label}`}
          step={step}
          index={i}
          busy={!!active && i === rows.length - 1}
        />
      ))}
      {active && rows.length === 0 && <PendingRow />}
    </View>
  );
}

export const ActivityTrace = memo(ActivityTraceInner);
export default ActivityTrace;
