import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Tabs, useSegments, withLayoutContext, router } from 'expo-router';
import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { Home as HomeIcon, List, Sparkles, User } from 'lucide-react-native';
import { useI18n } from '../../lib/i18n';
import { useAppData } from '../../lib/appData';
import { apiFetch, newIdempotencyKey } from '../../lib/api';
import { fontMono } from '../../lib/fonts';
import * as Haptics from 'expo-haptics';
import { RFAB, RecordingBanner } from '../../components/shell';
import { AddTransactionSheet, type AddTxPayload, type AddTxPrefill } from '../../components/AddTransactionSheet';
import { AddOptionsSheet } from '../../components/AddOptionsSheet';
import { RToast } from '../../components/ui';
import { Tour, hasTourBeenSeen } from '../../components/Tour';
import { useRecorder } from '../../components/useRecorder';

// On iOS we use react-native-bottom-tabs' native UITabBar (renders as Liquid
// Glass on iOS 26+, regular blur on 17/18). On Android we keep the JS Tabs
// from expo-router, since the native variant is iOS-tuned and Android's
// Material 3 NavigationBar doesn't gain anything from going native here.
const NativeTabsNavigator = withLayoutContext(createNativeBottomTabNavigator().Navigator);

export default function TabsLayout() {
  const { tok, lang, t } = useI18n();
  const { categories, projects, profile, bumpVersion, refresh } = useAppData();

  useEffect(() => { refresh(); }, [refresh]);
  const segments = useSegments();
  const currentTab = segments[segments.length - 1];
  const hideFab = currentTab === 'seshat';

  const [sheetOpen, setSheetOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [sheetPrefill, setSheetPrefill] = useState<AddTxPrefill | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(false);

  // FAB long-press → voice flow: recorder lives at the layout level so the
  // mic stays alive across navigation (the user can hold the FAB, release on
  // the Seshat tab, and we still own the recording instance). useRecorder is
  // careful to clean up on unmount, so worst-case the press is cancelled.
  const fabRecorder = useRecorder();

  // Drives the top-of-screen RecordingBanner. The FAB owns its own red
  // visual, but the finger covers it, so this is the only confirmation the
  // user can actually see while holding to record.
  const [voiceRecording, setVoiceRecording] = useState(false);

  // Haptics are guarded: expo-haptics may not be in an older installed
  // binary, and a missing native module would otherwise throw mid-press.
  const haptic = (fn: () => Promise<unknown>) => {
    try { fn().catch(() => {}); } catch { /* native module absent → no-op */ }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const seen = await hasTourBeenSeen();
      if (!alive || seen) return;
      setTimeout(() => alive && setTourOpen(true), 900);
    })();
    return () => { alive = false; };
  }, []);

  const onSave = async (p: AddTxPayload) => {
    try {
      await apiFetch('/transactions', {
        method: 'POST',
        body: JSON.stringify(p),
        idempotencyKey: newIdempotencyKey(),
      });
      bumpVersion();
      const cat = categories.find((c) => c._id === p.categoryId);
      const catName = lang === 'ar' && cat?.nameAr ? cat.nameAr : (cat?.nameEn ?? '');
      const msg = lang === 'ar'
        ? `تم رصده. ${p.amount.toLocaleString()} ج.م · ${catName}`
        : `Detected. ${p.amount.toLocaleString()} ${p.currency} · ${catName}`;
      setToast(msg);
      setSheetOpen(false);
      setTimeout(() => setToast(null), 2800);
    } catch (err) {
      console.warn('save tx failed', err);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: tok.void }}>
      {Platform.OS === 'ios' ? (
        <NativeTabsNavigator
          tabBarActiveTintColor={tok.gold}
          tabBarInactiveTintColor={tok.muted}
          hapticFeedbackEnabled
        >
          <NativeTabsNavigator.Screen
            name="index"
            options={{
              title: t('home'),
              tabBarIcon: () => ({ sfSymbol: 'house' }),
            }}
          />
          <NativeTabsNavigator.Screen
            name="transactions"
            options={{
              title: t('transactions'),
              tabBarIcon: () => ({ sfSymbol: 'list.bullet' }),
            }}
          />
          <NativeTabsNavigator.Screen
            name="seshat"
            options={{
              title: t('seshat'),
              tabBarIcon: () => ({ sfSymbol: 'sparkles' }),
            }}
          />
          <NativeTabsNavigator.Screen
            name="profile"
            options={{
              title: t('profile'),
              tabBarIcon: () => ({ sfSymbol: 'person.crop.circle' }),
            }}
          />
        </NativeTabsNavigator>
      ) : (
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: tok.navBg,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: tok.border,
              height: 70,
              paddingTop: 8,
              paddingBottom: 8,
            },
            tabBarActiveTintColor: tok.gold,
            tabBarInactiveTintColor: tok.muted,
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: t('home'),
              tabBarIcon: ({ color }) => <HomeIcon size={22} color={color} strokeWidth={1.5} />,
              tabBarLabel: ({ focused, color }) => <TabLabel focused={focused} color={color}>{t('home')}</TabLabel>,
            }}
          />
          <Tabs.Screen
            name="transactions"
            options={{
              title: t('transactions'),
              tabBarIcon: ({ color }) => <List size={22} color={color} strokeWidth={1.5} />,
              tabBarLabel: ({ focused, color }) => <TabLabel focused={focused} color={color}>{t('transactions')}</TabLabel>,
            }}
          />
          <Tabs.Screen
            name="seshat"
            options={{
              title: t('seshat'),
              tabBarIcon: ({ color }) => <Sparkles size={22} color={color} strokeWidth={1.5} />,
              tabBarLabel: ({ focused, color }) => <TabLabel focused={focused} color={color}>{t('seshat')}</TabLabel>,
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: t('profile'),
              tabBarIcon: ({ color }) => <User size={22} color={color} strokeWidth={1.5} />,
              tabBarLabel: ({ focused, color }) => <TabLabel focused={focused} color={color}>{t('profile')}</TabLabel>,
            }}
          />
        </Tabs>
      )}

      {!hideFab && (
        <RFAB
          onPress={() => setOptionsOpen(true)}
          onVoiceStart={async () => {
            // Long-press detected → kick off the mic immediately. We do NOT
            // navigate yet so the user keeps holding on the FAB (sliding the
            // finger off cancels). On iOS the permission prompt fires here
            // the very first time; subsequent presses are silent.
            haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
            setVoiceRecording(true);
            const ok = await fabRecorder.start();
            // Permission denied / mic failed → pull the banner back down.
            if (!ok) setVoiceRecording(false);
          }}
          onVoiceRelease={async () => {
            // Release → stop, transcribe, navigate to Seshat with the
            // transcript as the initial message. The Seshat screen's
            // initialText effect auto-sends it on mount.
            haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
            setVoiceRecording(false);
            const audio = await fabRecorder.stop();
            if (!audio) return;
            try {
              const res = await apiFetch<{ data: { transcript: string } }>('/voice/transcribe', {
                method: 'POST',
                body: JSON.stringify(audio),
              });
              const text = res.data.transcript?.trim();
              if (!text) return;
              router.push({
                pathname: '/seshat/[id]',
                params: { id: 'new', text },
              });
            } catch (err) {
              console.warn('[fab voice] transcribe failed', err);
              setToast(lang === 'ar' ? 'تعذر الإرسال' : 'Could not send');
              setTimeout(() => setToast(null), 2400);
            }
          }}
          onVoiceCancel={() => {
            // Finger left the button mid-recording → throw the clip away.
            haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
            setVoiceRecording(false);
            void fabRecorder.cancel();
          }}
        />
      )}

      <RecordingBanner visible={voiceRecording} />

      <RToast visible={!!toast}>{toast ?? ''}</RToast>

      <AddOptionsSheet
        visible={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        onPickManual={() => { setSheetPrefill(undefined); setSheetOpen(true); }}
        onPickReceipt={() => {
          setSheetPrefill({ autoTriggerScan: true, source: 'receipt-ocr' });
          setSheetOpen(true);
        }}
      />

      <AddTransactionSheet
        visible={sheetOpen}
        onClose={() => { setSheetOpen(false); setSheetPrefill(undefined); }}
        onSave={onSave}
        categories={categories}
        projects={projects}
        defaultCurrency={profile?.currency ?? 'EGP'}
        prefill={sheetPrefill}
      />

      <Tour visible={tourOpen} onClose={() => setTourOpen(false)} />
    </View>
  );
}

function TabLabel({ focused, color, children }: { focused: boolean; color: string; children: string }) {
  const { lang } = useI18n();
  return (
    <Text
      numberOfLines={1}
      style={{
        color,
        fontFamily: fontMono('regular'),
        fontSize: 9.5,
        letterSpacing: lang === 'ar' ? 0 : 1.2,
        textTransform: lang === 'ar' ? 'none' : 'uppercase',
        opacity: focused ? 1 : 0.7,
        marginTop: 4,
      }}
    >{children}</Text>
  );
}
