import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Tabs, useSegments } from 'expo-router';
import { Home as HomeIcon, List, Sparkles, User } from 'lucide-react-native';
import { useI18n } from '../../lib/i18n';
import { useAppData } from '../../lib/appData';
import { apiFetch, newIdempotencyKey } from '../../lib/api';
import { fontMono } from '../../lib/fonts';
import { RFAB } from '../../components/shell';
import { AddTransactionSheet, type AddTxPayload, type AddTxPrefill } from '../../components/AddTransactionSheet';
import { AddOptionsSheet } from '../../components/AddOptionsSheet';
import { RToast } from '../../components/ui';
import { Tour, hasTourBeenSeen } from '../../components/Tour';

// NOTE: this is the original JS tab bar. The native variant (using
// react-native-bottom-tabs / @bottom-tabs/react-navigation, for Liquid
// Glass on iOS 26) is installed and ready in package.json, but requires
// an EAS build with proper Apple credentials. We'll swap back to the
// native variant once that's unblocked.

export default function TabsLayout() {
  const { tok, lang, t } = useI18n();
  const { categories, profile, bumpVersion, refresh } = useAppData();

  // Re-fetch profile + categories whenever the tabs mount. Covers both fresh
  // login (AppDataProvider's startup fetch fired before a token existed) and
  // app-restart with an already-stored token.
  useEffect(() => { refresh(); }, [refresh]);
  const segments = useSegments();
  const currentTab = segments[segments.length - 1];
  const hideFab = currentTab === 'seshat';

  const [sheetOpen, setSheetOpen] = useState(false);
  // The FAB now opens this chooser first; selecting an option then opens
  // the AddTransactionSheet with the right prefill (manual entry vs auto-
  // trigger the receipt-scan flow).
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [sheetPrefill, setSheetPrefill] = useState<AddTxPrefill | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(false);

  // First-launch tour. Wait a beat so the screen actually paints behind the
  // overlay — the goal is "user sees their app, then guidance arrives", not a
  // tour-before-the-app-loads experience.
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
      // Fresh idempotency key per Save tap. If the network drops mid-request
      // and the SDK retries, the server returns the same response without
      // creating a second tx.
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
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: tok.navBg,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: tok.border,
            height: Platform.OS === 'ios' ? 84 : 70,
            paddingTop: 8,
            paddingBottom: Platform.OS === 'ios' ? 26 : 8,
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

      {!hideFab && <RFAB onPress={() => setOptionsOpen(true)} />}

      <RToast visible={!!toast}>{toast ?? ''}</RToast>

      <AddOptionsSheet
        visible={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        onPickManual={() => { setSheetPrefill(undefined); setSheetOpen(true); }}
        onPickReceipt={() => {
          // Open the AddTransactionSheet with autoTriggerScan -> the sheet
          // fires the Camera/Library prompt itself once it's mounted.
          setSheetPrefill({ autoTriggerScan: true, source: 'receipt-ocr' });
          setSheetOpen(true);
        }}
      />

      <AddTransactionSheet
        visible={sheetOpen}
        onClose={() => { setSheetOpen(false); setSheetPrefill(undefined); }}
        onSave={onSave}
        categories={categories}
        defaultCurrency={profile?.currency ?? 'EGP'}
        prefill={sheetPrefill}
      />

      <Tour visible={tourOpen} onClose={() => setTourOpen(false)} />
    </View>
  );
}

function TabLabel({ focused, color, children }: { focused: boolean; color: string; children: string }) {
  const { lang } = useI18n();
  // Design rule (radar-shared.jsx RBottomNav): show the tab label on every tab,
  // active gets full opacity, inactive gets muted.
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
