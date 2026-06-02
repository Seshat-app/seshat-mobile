import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView, View, Text, RefreshControl, StyleSheet, useWindowDimensions,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
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

  // Dashboard views the user swipes between; the choice persists on settle.
  const VIEWS: DashView[] = ['numbers', 'hud', 'bento'];

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

      {(() => {
        const banners = (
          <>
            {needsSalary && <SalaryBanner onPress={() => setSalaryOpen(true)} />}
            {!needsSalary && checkIn.needed && (
              <SalaryCheckInBanner status={checkIn} onPress={() => setCheckInOpen(true)} />
            )}
          </>
        );
        const refreshCtl = (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchDashboard('refresh')}
            tintColor={tok.gold}
            colors={[tok.gold]}
            progressBackgroundColor={tok.surface}
            progressViewOffset={headerH}
          />
        );
        if (loading) return <DashboardSkeleton topPad={headerH + 14} />;
        const isEmpty = !data || (data.current.income.count === 0 && data.current.expense.count === 0);
        if (isEmpty) {
          return (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingTop: headerH + 14, flexGrow: 1 }}
              refreshControl={refreshCtl}
            >
              {banners}
              <View style={{ flex: 1, minHeight: 400 }}><EmptyState /></View>
            </ScrollView>
          );
        }
        return (
          <DashboardViewPager
            views={VIEWS}
            view={view}
            onViewChange={onViewChange}
            headerH={headerH}
            bottomInset={insets.bottom}
            refreshing={refreshing}
            onRefresh={() => fetchDashboard('refresh')}
            banners={banners}
            data={data!}
            currency={currency}
          />
        );
      })()}

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

// ─────────────────────────────────────────────────────────────
// DashboardViewPager — the dashboard is a horizontal carousel of the three
// views (Numbers / Instrument / Bento). Each page is the real, full view in
// its own vertical scroll; swiping between them shows the actual charts (no
// placeholder) and the chosen view persists on settle. The horizontal gutter
// between pages comes from each view's own 16px side padding.
// ─────────────────────────────────────────────────────────────
function DashboardViewPager({
  views, view, onViewChange, headerH, bottomInset, refreshing, onRefresh, banners, data, currency,
}: {
  views: DashView[];
  view: DashView;
  onViewChange: (v: DashView) => void;
  headerH: number;
  bottomInset: number;
  refreshing: boolean;
  onRefresh: () => void;
  banners: React.ReactNode;
  data: DashboardData;
  currency: string;
}) {
  const { tok } = useI18n();
  const { width } = useWindowDimensions();
  const ref = useRef<ScrollView>(null);
  const activeIndex = Math.max(0, views.indexOf(view));

  // Keep the carousel aligned to the active view (mount + external changes).
  useEffect(() => {
    const id = setTimeout(() => ref.current?.scrollTo({ x: activeIndex * width, y: 0, animated: false }), 0);
    return () => clearTimeout(id);
  }, [activeIndex, width]);

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (views[i] && views[i] !== view) onViewChange(views[i]);
  };

  return (
    <ScrollView
      ref={ref}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      contentOffset={{ x: activeIndex * width, y: 0 }}
      onMomentumScrollEnd={onEnd}
      decelerationRate="fast"
    >
      {views.map((v) => (
        <View key={v} style={{ width }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: headerH + 14, paddingBottom: bottomInset + 24 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={tok.gold}
                colors={[tok.gold]}
                progressBackgroundColor={tok.surface}
                progressViewOffset={headerH}
              />
            }
          >
            <PageDots count={views.length} active={activeIndex} />
            {banners}
            {v === 'numbers' && <DashboardNumbers data={data} currency={currency} />}
            {v === 'hud' && <DashboardHud data={data} currency={currency} />}
            {v === 'bento' && <DashboardBento data={data} currency={currency} />}
          </ScrollView>
        </View>
      ))}
    </ScrollView>
  );
}

function PageDots({ count, active }: { count: number; active: number }) {
  const { tok } = useI18n();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingBottom: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === active ? 18 : 6, height: 6, borderRadius: 3,
            backgroundColor: i === active ? tok.gold : tok.borderHi,
          }}
        />
      ))}
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

// Loading skeleton — real card shells (glass shields) with placeholders for the
// DATA only, so loading looks like the app, not grey blocks. Mirrors the Bento
// layout: glow hero, income/expense tiles, a category card, recent rows.
function DashboardSkeleton({ topPad = 0 }: { topPad?: number }) {
  const { tok } = useI18n();
  const SkelRow = ({ last }: { last?: boolean }) => (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14,
      borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: tok.border,
    }}>
      <Skeleton width={40} height={40} radius={12} />
      <View style={{ flex: 1, gap: 7 }}>
        <Skeleton width="65%" height={13} />
        <Skeleton width="38%" height={9} />
      </View>
      <Skeleton width={56} height={14} />
    </View>
  );
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: 16, paddingTop: topPad, gap: 12, paddingBottom: 120 }}>
        <RCard large glow>
          <Skeleton width={96} height={10} />
          <Skeleton width="52%" height={38} radius={8} style={{ marginTop: 16 }} />
          <Skeleton width="100%" height={30} radius={6} style={{ marginTop: 22 }} />
          <Skeleton width={130} height={9} style={{ marginTop: 14 }} />
        </RCard>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {[0, 1].map((i) => (
            <RCard key={i} padding={16} style={{ flex: 1 }}>
              <Skeleton width={64} height={9} />
              <Skeleton width="72%" height={22} radius={6} style={{ marginTop: 12 }} />
              <Skeleton width={52} height={9} style={{ marginTop: 14 }} />
            </RCard>
          ))}
        </View>
        <RCard padding={16}>
          <Skeleton width={84} height={9} />
          <Skeleton width="48%" height={20} radius={6} style={{ marginTop: 12 }} />
          <Skeleton width="100%" height={3} radius={2} style={{ marginTop: 16 }} />
        </RCard>
        <RCard style={{ paddingHorizontal: 18, paddingVertical: 4 }}>
          <SkelRow />
          <SkelRow />
          <SkelRow last />
        </RCard>
      </View>
    </ScrollView>
  );
}
