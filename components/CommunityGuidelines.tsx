import { Modal, View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView } from './Scroll';
import { useI18n } from '../lib/i18n';
import { fontBody, fontHead } from '../lib/fonts';
import { radius } from '../lib/theme';
import { RButton } from './ui';

/** The community rules, shown once before someone posts. Agreeing is recorded on the account. */
export function CommunityGuidelines({ visible, onAgree, onClose }: { visible: boolean; onAgree: () => void; onClose: () => void }) {
  const { tok, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const ar = lang === 'ar';
  const rules = ar ? [
    'كن لطيفاً ومحترماً. لا إساءة ولا سخرية من أحد.',
    'الإجابات هنا آراء أعضاء وليست نصيحة مالية. قارن وفكّر قبل أن تتصرف.',
    'لا تشارك بياناتك الخاصة: أرقام الحسابات أو البطاقات أو الهواتف أو البريد أو الروابط.',
    'يمكنك الإبلاغ عن أي منشور أو حظر أي عضو في أي وقت.',
    'قد تُزال المنشورات المخالفة، وقد يُمنع صاحبها من النشر.',
  ] : [
    'Be kind and respectful. No abuse, and no mocking anyone.',
    'Answers here are members’ opinions, not financial advice. Compare and think before you act.',
    'Keep private details out: no account or card numbers, phone numbers, emails or links.',
    'You can report any post or block any member at any time.',
    'Posts that break these rules may be removed, and the author may lose the right to post.',
  ];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={onClose} />
      <View style={{
        backgroundColor: tok.void, borderTopLeftRadius: radius.modal, borderTopRightRadius: radius.modal,
        paddingHorizontal: 20, paddingTop: 20, paddingBottom: insets.bottom + 16, borderTopWidth: 1, borderColor: tok.border, maxHeight: '85%',
      }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={{ fontFamily: fontHead(lang), fontSize: 22, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{ar ? 'قواعد المجتمع' : 'Community guidelines'}</Text>
          <Text style={{ marginTop: 6, fontFamily: fontBody(lang), fontSize: 13, color: tok.muted, lineHeight: 19, textAlign: ar ? 'right' : 'left' }}>
            {ar ? 'مكان لأسئلة المال وإجاباتها بين أعضاء سيشات. قبل أن تنشر:' : 'A place for Seshat members to ask and answer money questions. Before you post:'}
          </Text>
          <View style={{ marginTop: 14, gap: 12 }}>
            {rules.map((r) => (
              <View key={r} style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-start' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tok.gold, marginTop: 8 }} />
                <Text style={{ flex: 1, fontFamily: fontBody(lang), fontSize: 14, lineHeight: 21, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{r}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 10, marginTop: 18 }}>
          <View style={{ flex: 1 }}><RButton full variant="ghost" onPress={onClose}>{ar ? 'ليس الآن' : 'Not now'}</RButton></View>
          <View style={{ flex: 1 }}><RButton full onPress={onAgree}>{ar ? 'أوافق' : 'I agree'}</RButton></View>
        </View>
      </View>
    </Modal>
  );
}
