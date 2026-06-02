import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, RefreshControl, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glass } from '../../components/Glass';
import * as SecureStore from 'expo-secure-store';
import { apiFetch, hasToken } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { useAppData } from '../../lib/appData';
import { fontBody } from '../../lib/fonts';
import { RHomeHeader, type DashView } from '../../components/shell';
import { ScreenAtmosphere } from '../../components/ScreenAtmosphere';
import { DashboardNumbers, DashboardHud, DashboardBento, type DashboardData } from '../../components/dashboards';
import { SkeletonCard, Skeleton, SkeletonRow } from '../../components/Skeleton';
import { RCard } from '../../components/ui';
import { SalaryBanner, SetSalarySheet } from '../../components/SalaryBanner';
import {
  SalaryCheckInBanner, SalaryCheckInSheet, fetchSalaryCheckIn, type CheckInStatus,
} from '../../components/SalaryCheckInBanner';
import { useRouter } from 'expo-router';

const VIEW_KEY = 'seshat.dashboardView';

export default function HomeScreen() {
  const router = useRouter();
  const { tok, lang, t, mode } = useI18n();
  const { profile, dataVersion, refresh, bumpVersion } = useAppData();
  const insets = useSafeAreaInsets();
  const [headerH, setHeaderH] = useState(0);
  const [view, setView] = useState<DashView>('bento');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [salaryOpen, setSalaryOpen] = useState(false);
  // Monthly salary confirmation: server tells us once per month whether the
  // user owes a check-in for the current month. We keep the result here so
  // the banner only renders when it actually applies.
  const [checkIn, setCheckIn] = useState<CheckInStatus>({ needed: false });
  const [checkInOpen, setCheckInOpen] = useState(false);

  // Re-fetch dashboard + profile/categories. Used by both initial load and
  // pull-to-refresh, so the "refreshing" spinner shows in both.
  const fetchDashboard = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    const has = await hasToken();
    if (!has) { router.replace('/'); return; }
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    try {
      const res = await apiFetch<{ data: DashboardData }>('/dashboard');
      setData(res.data);
      if (mode === 'refresh') await refresh(); // also pull /me + /categories
    } catch (err) {
      console.warn('dashboard fetch failed', err);
    } finally {
      if (mode === 'initial') setLoading(false);
      else setRefreshing(false);
    }
  }, [router, refresh]);

  // Restore last view choice.
  useEffect(() => {
    SecureStore.getItemAsync(VIEW_KEY).then((v) => {
      if (v === 'numbers' || v === 'hud' || v === 'bento') setView(v);
    });
  }, []);

  const onViewChange = useCallback((v: DashView) => {
    setView(v);
    SecureStore.setItemAsync(VIEW_KEY, v).catch(() => {});
  }, []);

  // Fetch dashboard on mount and when a tx was added (dataVersion bumps).
  useEffect(() => { fetchDashboard('initial'); }, [dataVersion, fetchDashboard]);

  // Salary check-in state: refreshed whenever the data version bumps (so
  // confirming the check-in itself hides the banner without a re-mount).
  useEffect(() => {
    (async () => setCheckIn(await fetchSalaryCheckIn()))();
  }, [dataVersion]);

  // In Arabic, greet with the user's Arabic name when they've set one; fall
  // back to their display name, then a friendly default.
  const userName =
    (lang === 'ar' ? (profile?.displayNameAr || profile?.displayName) : profile?.displayName)
    || (lang === 'ar' ? 'ليلى' : 'there');
  const currency = profile?.currency ?? 'EGP';

  const needsSalary = profile !== null && (profile.monthlySalary == null || profile.monthlySalary === 0);

  const saveSalary = async (amount: number) => {
    await apiFetch('/me', { method: 'PATCH', body: JSON.stringify({ monthlySalary: amount }) });
    await refresh();
    bumpVersion();
    setSalaryOpen(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: tok.void }}>
      <ScreenAtmosphere />

      {loading ? (
        <DashboardSkeleton topPad={headerH} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: headerH }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchDashboard('refresh')}
              tintColor={tok.gold}
              colors={[tok.gold]}
              progressBackgroundColor={tok.surface}
              progressViewOffset={headerH}
            />
          }
        >
          {needsSalary && <SalaryBanner onPress={() => setSalaryOpen(true)} />}
          {!needsSalary && checkIn.needed && (
            <SalaryCheckInBanner status={checkIn} onPress={() => setCheckInOpen(true)} />
          )}
          {!data || (data.current.income.count === 0 && data.current.expense.count === 0) ? (
            <View style={{ flex: 1, minHeight: 400 }}>
              <EmptyState />
            </View>
          ) : (
            <>
              {view === 'numbers' && <DashboardNumbers data={data} currency={currency} />}
              {view === 'hud' && <DashboardHud data={data} currency={currency} />}
              {view === 'bento' && <DashboardBento data={data} currency={currency} />}
            </>
          )}
        </ScrollView>
      )}

      {/* Overlay glass header — no border, just a gradient fade at the bottom
          so content dissolves naturally as it scrolls under. */}
      <View
        onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}
      >
        <Glass
          variant="liquid"
          dark={mode !== 'light'}
          fallbackColor={mode === 'light' ? 'rgba(245,244,239,0.55)' : 'rgba(13,13,13,0.45)'}
          style={{
            paddingTop: insets.top,
          }}
        >
          <RHomeHeader userName={userName} view={view} onViewChange={onViewChange} refreshing={refreshing} />
        </Glass>
      </View>

      <SetSalarySheet
        visible={salaryOpen}
        onClose={() => setSalaryOpen(false)}
        onSave={saveSalary}
        defaultCurrency={currency}
        initialAmount={profile?.monthlySalary}
      />

      <SalaryCheckInSheet
        visible={checkInOpen}
        onClose={() => setCheckInOpen(false)}
        status={checkIn}
        onDone={() => { bumpVersion(); }}
      />
    </View>
  );
}

function EmptyState() {
  const { tok, lang, t } = useI18n();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
      <Text style={{
        color: tok.bone, fontFamily: fontBody(lang, 'medium'), fontSize: 18,
        textAlign: 'center', lineHeight: 26,
      }}>{t('noRecords')}</Text>
      <Text style={{
        marginTop: 10, color: tok.muted, fontFamily: fontBody(lang), fontSize: 14,
        textAlign: 'center', lineHeight: 22,
      }}>{t('noRecordsSub')}</Text>
    </View>
  );
}

function DashboardSkeleton({ topPad = 0 }: { topPad?: number }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: 16, paddingTop: topPad + 4, gap: 10, paddingBottom: 120 }}>
        <SkeletonCard height={172} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <SkeletonCard height={96} style={{ flex: 1 }} />
          <SkeletonCard height={96} style={{ flex: 1 }} />
        </View>
        <SkeletonCard height={108} />
        <SkeletonCard height={86} />
        <RCard padding={18}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </RCard>
      </View>
    </ScrollView>
  );
}
