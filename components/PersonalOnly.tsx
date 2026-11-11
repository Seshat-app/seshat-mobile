import { View, Text } from 'react-native';
import { Lock } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { useAppData } from '../lib/appData';
import { fontBody } from '../lib/fonts';
import { RButton } from './ui';
import { PlanScreen } from './PlanShell';

/** What an organization workspace shows in place of a personal-profile feature (gam3yas, savings). */
export function PersonalOnly({ title, what }: { title: string; what: { en: string; ar: string } }) {
  const { tok, lang } = useI18n();
  const { openWorkspaceSheet } = useAppData();
  const ar = lang === 'ar';
  return (
    <PlanScreen title={title}>
      <View style={{ paddingTop: 60, paddingHorizontal: 28, alignItems: 'center', gap: 10 }}>
        <Lock size={28} color={tok.muted} />
        <Text style={{ color: tok.bone, fontFamily: fontBody(lang, 'medium'), fontSize: 16, textAlign: 'center' }}>{ar ? 'هذا للملف الشخصي فقط' : 'This is for your personal profile'}</Text>
        <Text style={{ color: tok.muted, fontFamily: fontBody(lang), fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 300 }}>
          {ar ? what.ar : what.en}
        </Text>
        <View style={{ marginTop: 14 }}><RButton onPress={openWorkspaceSheet}>{ar ? 'التبديل إلى الشخصي' : 'Switch to personal'}</RButton></View>
      </View>
    </PlanScreen>
  );
}
