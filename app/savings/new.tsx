import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView as ScreenScroll } from '../../components/Scroll';
import { useI18n } from '../../lib/i18n';
import { PlanScreen } from '../../components/PlanShell';
import { HoldingForm } from '../../components/SavingsSheets';

/** Add something you bought: gold, foreign currency, crypto or anything priced by hand. */
export default function NewHoldingScreen() {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <PlanScreen title={ar ? 'أضف ادخاراً' : 'Add a saving'} subtitle={ar ? 'ما اشتريته بفلوسك' : 'Something you bought with your money'}>
      <ScreenScroll contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40, paddingTop: 8 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <HoldingForm onDone={() => router.back()} />
      </ScreenScroll>
    </PlanScreen>
  );
}
