import { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Sparkles } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { radius } from '../lib/theme';
import { RButton } from './ui';
import { RELEASE_NOTES, type ReleaseNote } from '../lib/releaseNotes';

/**
 * The "What's new" panel: a sheet listing the newest release, with earlier releases below. Shown once after an
 * update (see ReleaseNotesGate) and reopened any time from Profile.
 */
export function ReleaseNotesModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { tok, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const ar = lang === 'ar';
  const [showOlder, setShowOlder] = useState(false);
  const [latest, ...older] = RELEASE_NOTES;

  const Release = ({ r, big }: { r: ReleaseNote; big?: boolean }) => (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(201,168,76,0.14)', borderWidth: 1, borderColor: tok.gold }}>
          <Text style={{ fontFamily: fontMono('medium'), fontSize: 11, color: tok.gold }}>v{r.version}</Text>
        </View>
        <Text style={{ fontFamily: fontMono('regular'), fontSize: 11, color: tok.muted }}>
          {new Date(r.date + 'T00:00:00Z').toLocaleDateString(ar ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
        </Text>
      </View>
      <Text style={{ fontFamily: fontHead(lang), fontSize: big ? 20 : 16, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{ar ? r.title.ar : r.title.en}</Text>
      {r.items.map((it, i) => (
        <View key={i} style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 10 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tok.gold, marginTop: 8 }} />
          <Text style={{ flex: 1, fontFamily: fontBody(lang), fontSize: 14, lineHeight: 21, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{ar ? it.ar : it.en}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)' }} onPress={onClose} />
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%',
        backgroundColor: tok.void, borderTopLeftRadius: radius.modal, borderTopRightRadius: radius.modal,
        paddingHorizontal: 20, paddingTop: 10, paddingBottom: insets.bottom + 16,
        borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
      }}>
        <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 999, backgroundColor: tok.border, marginBottom: 12 }} />
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color={tok.gold} />
            <Text style={{ fontFamily: fontMono('medium'), fontSize: 12, letterSpacing: ar ? 0 : 1.6, color: tok.gold, textTransform: ar ? 'none' : 'uppercase' }}>
              {ar ? 'ما الجديد' : "What's new"}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10}><X size={20} color={tok.muted} /></Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 22, paddingBottom: 8 }}>
          <Release r={latest} big />
          {older.length > 0 && (showOlder
            ? older.map((r) => <Release key={r.id} r={r} />)
            : (
              <Pressable onPress={() => setShowOlder(true)} hitSlop={8}>
                <Text style={{ fontFamily: fontBody(lang), fontSize: 13.5, color: tok.gold, textAlign: ar ? 'right' : 'left' }}>
                  {ar ? 'الإصدارات السابقة' : 'Earlier releases'}
                </Text>
              </Pressable>
            ))}
        </ScrollView>
        <View style={{ marginTop: 14 }}>
          <RButton full onPress={onClose}>{ar ? 'تمام' : 'Got it'}</RButton>
        </View>
      </View>
    </Modal>
  );
}
