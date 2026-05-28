import { Stack } from 'expo-router';

// The /orgs/* surface uses a Stack so the back chevron does the right thing
// from invite/accept screens. No header chrome - each screen renders its own
// (matches the Budgets / Goals / Debts pattern via PlanScreen).
export default function OrgsLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
