import { View, Text, Pressable, Linking } from 'react-native';
import { Download, X } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { fontBody } from '../lib/fonts';
import { RCard } from './ui';
import { useAndroidUpdate } from '../lib/androidUpdate';

// Android only: a newer APK has been uploaded. Tap to download and install it.
export function UpdateBanner() {
  const { tok, lang } = useI18n();
  const { update, dismiss } = useAndroidUpdate();
  if (!update) return null;
  const ar = lang === 'ar';
  const notes = ar ? (update.notesAr || update.notes) : update.notes;

  return (
    <Pressable
      onPress={() => { void Linking.openURL(update.url); }}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      <RCard accent padding={14} style={{ marginHorizontal: 16, marginTop: 6, marginBottom: 12 }}>
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
          <View style={{
            width: 36, height: 36, borderRadius: 10, backgroundColor: tok.elevated,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Download size={18} color={tok.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{
              color: tok.bone, fontFamily: fontBody(lang, 'semibold'), fontSize: 14,
              textAlign: ar ? 'right' : 'left',
            }}>
              {ar ? 'يوجد إصدار جديد من سيشات' : 'Get the latest version of Seshat'}
            </Text>
            <Text style={{
              marginTop: 3, color: tok.muted, fontFamily: fontBody(lang), fontSize: 12,
              textAlign: ar ? 'right' : 'left',
            }}>
              {notes || (ar ? `الإصدار ${update.versionName} جاهز. اضغط للتحميل والتثبيت.` : `Version ${update.versionName} is ready. Tap to download and install.`)}
            </Text>
          </View>
          <Pressable onPress={dismiss} hitSlop={10} accessibilityLabel={ar ? 'إغلاق' : 'Dismiss'}>
            <X size={16} color={tok.muted} />
          </Pressable>
        </View>
      </RCard>
    </Pressable>
  );
}
