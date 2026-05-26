import { ReactNode, useState } from 'react';
import {
  View, Text, Pressable, TextInput, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { useI18n } from '../lib/i18n';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { RButton, REyebrow } from './ui';
import { RadarMark } from './RadarMark';

// ─────────────────────────────────────────────────────────────
// Shared chrome for all auth screens
// ─────────────────────────────────────────────────────────────
export function AuthChrome({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const { tok, lang, setLang } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: tok.void, paddingTop: insets.top }}
    >
      <View style={{
        paddingTop: 14, paddingHorizontal: 22,
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          alignItems: 'center', gap: 10,
        }}>
          <RadarMark size={20} gold={tok.gold} lightRing />
          <Text style={{
            // Syne ExtraBold for the wordmark — loaded in _layout.tsx
            fontFamily: 'Syne_800ExtraBold',
            fontSize: 14, color: tok.gold, letterSpacing: -0.6,
          }}>Radar</Text>
        </View>
        <Pressable
          onPress={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          style={({ pressed }) => ({
            borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
            borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{
            color: tok.muted, fontFamily: fontMono('regular'), fontSize: 10,
            letterSpacing: 1.6, textTransform: 'uppercase',
          }}>{lang === 'ar' ? 'EN' : 'AR'}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 30 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        {children}
      </ScrollView>

      {footer && <View style={{ paddingHorizontal: 22, paddingBottom: 34 }}>{footer}</View>}
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────
// Hero block — eyebrow + headline + subline
// ─────────────────────────────────────────────────────────────
export function AuthHero({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  const { tok, lang } = useI18n();
  return (
    <View style={{ marginTop: 38, marginBottom: 8 }}>
      <REyebrow color={tok.gold} style={{ textAlign: lang === 'ar' ? 'right' : 'left' }}>{eyebrow}</REyebrow>
      <Text style={{
        marginTop: 14,
        fontFamily: fontHead(lang),
        fontSize: lang === 'ar' ? 34 : 36, color: tok.bone,
        letterSpacing: lang === 'ar' ? 0 : -1.4,
        lineHeight: lang === 'ar' ? 42 : 40,
        textAlign: lang === 'ar' ? 'right' : 'left',
        writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
      }}>{title}</Text>
      <Text style={{
        marginTop: 10,
        fontFamily: fontBody(lang), fontSize: lang === 'ar' ? 15 : 14,
        color: tok.muted, lineHeight: 22,
        textAlign: lang === 'ar' ? 'right' : 'left',
        writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
      }}>{sub}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Field — eyebrow label + optional secondary slot + bordered input
// ─────────────────────────────────────────────────────────────
export function AuthField({
  label, value, onChange, placeholder, secureTextEntry, keyboardType, autoFocus, autoComplete,
  textContentType, secondary,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  autoFocus?: boolean;
  autoComplete?: any;
  textContentType?: any;
  secondary?: ReactNode;
}) {
  const { tok, lang } = useI18n();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginTop: 18 }}>
      <View style={{
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        justifyContent: 'space-between', alignItems: 'baseline', gap: 8,
      }}>
        <REyebrow style={{ flexShrink: 1 }}>{label}</REyebrow>
        {secondary}
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={tok.muted}
        secureTextEntry={secureTextEntry}
        // Always pass a concrete keyboardType. RN's TextInput on some Android
        // builds keeps the previous keyboard (e.g. the numeric one from the
        // verify-code screen) when keyboardType is left undefined.
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        textContentType={textContentType}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          marginTop: 8,
          backgroundColor: tok.surface,
          borderWidth: 1, borderColor: focused ? tok.gold : tok.border,
          borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13,
          color: tok.bone,
          fontFamily: keyboardType === 'email-address' ? fontMono('regular') : fontBody(lang),
          fontSize: 14,
          writingDirection: keyboardType === 'email-address' ? 'ltr' : (lang === 'ar' ? 'rtl' : 'ltr'),
          textAlign: keyboardType === 'email-address' ? 'left' : (lang === 'ar' ? 'right' : 'left'),
        }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Inline link — small all-caps in gold or muted
// ─────────────────────────────────────────────────────────────
export function AuthLink({ children, onPress, gold }: { children: ReactNode; onPress?: () => void; gold?: boolean }) {
  const { tok } = useI18n();
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      <Text style={{
        color: gold ? tok.gold : tok.muted,
        fontFamily: fontMono('regular'), fontSize: 10,
        letterSpacing: 1.6, textTransform: 'uppercase',
      }}>{children}</Text>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// SSO buttons — Google + Apple (visual only for now)
// ─────────────────────────────────────────────────────────────
export function SSOButton({ provider, onPress, label }: { provider: 'google' | 'apple'; onPress?: () => void; label: string }) {
  const { tok, lang } = useI18n();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderWidth: 1, borderColor: tok.borderHi, borderRadius: 10,
        paddingVertical: 12, paddingHorizontal: 14,
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: pressed ? tok.surface : 'transparent',
      })}
    >
      {provider === 'google' ? (
        <Svg width={16} height={16} viewBox="0 0 24 24">
          <Path
            fill="#EA4335"
            d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6.2s2.7-6.2 6-6.2c1.9 0 3.1.8 3.9 1.5l2.6-2.5C16.9 3.4 14.7 2.4 12 2.4 6.5 2.4 2 6.9 2 12.4S6.5 22.4 12 22.4c6.4 0 10.6-4.5 10.6-10.8 0-.7-.1-1.3-.2-1.9H12z"
          />
        </Svg>
      ) : (
        <Svg width={15} height={15} viewBox="0 0 24 24">
          <Path
            fill={tok.bone}
            d="M17.05 12.04c.03-2.4 1.96-3.56 2.05-3.61-1.12-1.63-2.86-1.86-3.48-1.88-1.48-.15-2.89.87-3.64.87-.76 0-1.92-.85-3.16-.83-1.62.02-3.13.94-3.97 2.4-1.7 2.94-.43 7.28 1.22 9.66.81 1.16 1.77 2.47 3.02 2.42 1.22-.05 1.68-.79 3.16-.79s1.89.79 3.18.76c1.32-.02 2.15-1.18 2.95-2.35.94-1.35 1.32-2.66 1.34-2.73-.03-.01-2.56-.98-2.59-3.92zM14.71 4.94c.66-.81 1.12-1.93.99-3.04-.96.04-2.12.64-2.8 1.44-.61.71-1.15 1.85-1 2.95 1.07.08 2.16-.55 2.81-1.35z"
          />
        </Svg>
      )}
      <Text style={{ color: tok.bone, fontFamily: fontBody(lang, 'semibold'), fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// Separator with "or"
// ─────────────────────────────────────────────────────────────
export function AuthOr() {
  const { tok, t } = useI18n();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginVertical: 18,
    }}>
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: tok.border }} />
      <Text style={{
        color: tok.muted, fontFamily: fontMono('regular'), fontSize: 10,
        letterSpacing: 1.8, textTransform: 'uppercase',
      }}>{t('or')}</Text>
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: tok.border }} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Back link with chevron — for the Forgot Password screen
// ─────────────────────────────────────────────────────────────
export function AuthBackLink({ onPress, label }: { onPress: () => void; label: string }) {
  const { tok, lang } = useI18n();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', justifyContent: 'center', gap: 6,
        marginTop: 18,
      }}
    >
      <ChevronLeft size={12} color={tok.muted} style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }} />
      <Text style={{
        color: tok.muted, fontFamily: fontMono('regular'), fontSize: 10,
        letterSpacing: 1.6, textTransform: 'uppercase',
      }}>{label}</Text>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// Error banner — small left-bordered red strip above forms
// ─────────────────────────────────────────────────────────────
export function AuthError({ message }: { message?: string }) {
  const { tok, lang } = useI18n();
  if (!message) return null;
  return (
    <View style={{
      borderLeftWidth: lang === 'ar' ? 0 : 2, borderRightWidth: lang === 'ar' ? 2 : 0,
      borderColor: tok.alertText,
      paddingLeft: lang === 'ar' ? 0 : 10, paddingRight: lang === 'ar' ? 10 : 0,
      paddingVertical: 4, marginTop: 16,
    }}>
      <Text style={{
        color: tok.alertText, fontFamily: fontBody(lang), fontSize: 13,
        textAlign: lang === 'ar' ? 'right' : 'left',
      }}>{message}</Text>
    </View>
  );
}

// Re-export RButton for convenience in auth screens
export { RButton };
