import { useEffect, useRef } from 'react';
import { View, Text, Pressable, Modal, Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Receipt, Sparkles, X } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { fontBody, fontHead, fontMono } from '../lib/fonts';

/**
 * The bottom-sheet chooser that pops when the user taps the + FAB.
 *
 * Two large options:
 *  - "Scan receipt" -> opens the AddTransactionSheet which itself prompts
 *    Camera vs Library for the photo source, then runs OCR.
 *  - "Add manually" -> opens AddTransactionSheet in normal manual/AI mode.
 *
 * The chooser exists because the FAB used to dump straight into the
 * manual sheet - users with a paper receipt in hand had no obvious path
 * to "snap and Seshat will fill it in for me".
 */
type Props = {
  visible: boolean;
  onClose: () => void;
  onPickManual: () => void;
  onPickReceipt: () => void;
};

export function AddOptionsSheet({ visible, onClose, onPickManual, onPickReceipt }: Props) {
  const { tok, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;
  const overlay = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, { toValue: visible ? 1 : 0, duration: 240, useNativeDriver: true }),
      Animated.timing(overlay, { toValue: visible ? 1 : 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <Animated.View
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', opacity: overlay }}
          pointerEvents={visible ? 'auto' : 'none'}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            backgroundColor: tok.void,
            borderTopLeftRadius: 22, borderTopRightRadius: 22,
            borderTopWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
            paddingHorizontal: 18, paddingTop: 18,
            paddingBottom: insets.bottom + 18,
            transform: [{ translateY }],
            gap: 10,
          }}
        >
          <View style={{
            flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
            justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 4,
          }}>
            <Text style={{
              fontFamily: fontHead(lang), fontSize: 18, color: tok.bone, letterSpacing: -0.3,
            }}>
              {lang === 'ar' ? 'إضافة معاملة' : 'Add a transaction'}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={tok.muted} />
            </Pressable>
          </View>

          <OptionRow
            icon={<Receipt size={20} color={tok.gold} strokeWidth={1.6} />}
            title={lang === 'ar' ? 'تصوير إيصال' : 'Scan a receipt'}
            subtitle={lang === 'ar'
              ? 'صوّر إيصال أو اختر من المعرض - سيشات ستملأ التفاصيل.'
              : 'Take a photo or pick one - Seshat will fill in the details.'}
            onPress={() => { onClose(); onPickReceipt(); }}
            tok={tok}
            lang={lang}
          />

          <OptionRow
            icon={<Sparkles size={20} color={tok.gold} strokeWidth={1.6} />}
            title={lang === 'ar' ? 'إضافة يدوية أو بالذكاء' : 'Add manually or with AI'}
            subtitle={lang === 'ar'
              ? 'أدخل الرقم، أو املي عليّ، أو اكتب جملة عادية.'
              : 'Type a number, talk to me, or describe it in plain language.'}
            onPress={() => { onClose(); onPickManual(); }}
            tok={tok}
            lang={lang}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

function OptionRow({
  icon, title, subtitle, onPress, tok, lang,
}: { icon: React.ReactNode; title: string; subtitle: string; onPress: () => void; tok: any; lang: 'en' | 'ar' }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', gap: 12,
        paddingVertical: 14, paddingHorizontal: 14,
        borderRadius: 14,
        backgroundColor: pressed ? tok.elevated : tok.surface,
        borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
      })}
    >
      <View style={{
        width: 42, height: 42, borderRadius: 12,
        backgroundColor: tok.elevated,
        alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{
          fontFamily: fontBody(lang, 'semibold'), fontSize: 15, color: tok.bone,
          textAlign: lang === 'ar' ? 'right' : 'left',
        }}>
          {title}
        </Text>
        <Text
          numberOfLines={2}
          style={{
            marginTop: 2,
            fontFamily: fontBody(lang), fontSize: 12, color: tok.muted,
            textAlign: lang === 'ar' ? 'right' : 'left',
            lineHeight: 17,
          }}
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}
