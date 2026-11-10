import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView as ScreenScroll } from '../../components/Scroll';
import { useI18n } from '../../lib/i18n';
import { PlanScreen } from '../../components/PlanShell';
import { Gam3yaForm } from '../../components/Gam3yaForm';

/** Add a gam3ya. Opened from the list, or from a suggestion (the numbers arrive as parameters). */
export default function NewGam3yaScreen() {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = useLocalSearchParams<{ goal?: string; goalAr?: string; amount?: string; members?: string; turn?: string }>();
  const seed = p.goal ? { goalName: p.goal, goalNameAr: p.goalAr ?? p.goal, amount: Number(p.amount), members: Number(p.members), turn: Number(p.turn) } : undefined;
  return (
    <PlanScreen title={ar ? 'جمعية جديدة' : 'New gam3ya'} subtitle={ar ? 'أدخل شروط جمعيتك' : 'Enter the terms of yours'}>
      <ScreenScroll contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40, paddingTop: 8 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Gam3yaForm seed={seed} onDone={() => router.back()} />
      </ScreenScroll>
    </PlanScreen>
  );
}
