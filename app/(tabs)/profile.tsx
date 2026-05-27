import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet, Alert, Linking, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  Sun, Moon, Globe, Wallet, Target, CreditCard, ChevronRight, Banknote, Send, Tags, Camera, LifeBuoy,
} from 'lucide-react-native';
import { uploadAvatar } from '../../lib/cloudinary';
import { apiFetch, hasToken } from '../../lib/api';
import { signOut } from '../../lib/auth';
import { useI18n, type Lang, formatAmount, currencyLabel } from '../../lib/i18n';
import { useAppData } from '../../lib/appData';
import { fontBody, fontHead, fontMono } from '../../lib/fonts';
import { RCard, REyebrow, RButton } from '../../components/ui';
import { Skeleton } from '../../components/Skeleton';
import { SetSalarySheet } from '../../components/SalaryBanner';
import { resetTour } from '../../components/Tour';
import * as Updates from 'expo-updates';

const CURRENCIES = ['EGP', 'SAR', 'AED', 'USD', 'EUR', 'GBP'];

type Profile = {
  displayName?: string;
  avatarUrl?: string;
  email: string;
  language: 'en' | 'ar';
  currency: string;
  monthlySalary?: number | null;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { tok, lang, t, mode, setMode, setLang } = useI18n();
  const { refresh, profile: appProfile, bumpVersion } = useAppData();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [currency, setCurrency] = useState('EGP');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  // Danger zone is collapsed by default so users don't tap delete by reflex
  // while scrolling. Opening it reveals the typed-email confirm field.
  const [dangerOpen, setDangerOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    (async () => {
      const has = await hasToken();
      if (!has) { router.replace('/'); return; }
      try {
        const res = await apiFetch<{ data: Profile }>('/me');
        setProfile(res.data);
        setDisplayName(res.data.displayName ?? '');
        setCurrency(res.data.currency);
        if (res.data.language === 'en' || res.data.language === 'ar') setLang(res.data.language);
      } catch (err) {
        console.warn('me fetch failed', err);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true); setSaved(false);
    try {
      await apiFetch('/me', { method: 'PATCH', body: JSON.stringify({ displayName, language: lang, currency }) });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      refresh();
    } catch (err) {
      console.warn('save profile failed', err);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePhoto = async () => {
    // Ask for gallery permission. iOS shows a system prompt the first time;
    // Android Tiramisu+ shows the photo picker without a permission entry.
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        lang === 'ar' ? 'الإذن مطلوب' : 'Permission needed',
        lang === 'ar' ? 'افتحي إعدادات التطبيق وامنحي صلاحية الصور.' : 'Open app settings and grant photo access.',
      );
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    setUploadingAvatar(true);
    try {
      const { secureUrl } = await uploadAvatar(picked.assets[0].uri);
      await apiFetch('/me', { method: 'PATCH', body: JSON.stringify({ avatarUrl: secureUrl }) });
      setProfile((p) => p ? { ...p, avatarUrl: secureUrl } : p);
      refresh();
    } catch (err) {
      Alert.alert(
        lang === 'ar' ? 'فشل الرفع' : 'Upload failed',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    // Token is cleared, but `router.replace('/')` from inside the (tabs)
    // group bounces to (tabs)/index because of expo-router's route group
    // resolution. Force a JS bundle reload so the whole tree re-mounts
    // fresh: AuthRouter at app/index.tsx sees no token and shows login,
    // AppDataProvider drops its cached profile/categories. Works in both
    // a production APK (Updates.reloadAsync) and Expo Go (DevSettings).
    try {
      await Updates.reloadAsync();
    } catch {
      try {
        const RN = require('react-native');
        RN.DevSettings?.reload?.();
      } catch {
        router.replace('/');
      }
    }
  };

  const handleDeleteAccount = async () => {
    // Final confirmation alert AFTER the typed-email gate has been passed.
    // The typed email IS the primary friction; this alert is the last
    // chance to back out and exists mostly because Alert blocks the UI so
    // users can't accidentally tap "delete" twice during the network call.
    Alert.alert(
      lang === 'ar' ? 'حذف الحساب' : 'Delete account',
      lang === 'ar'
        ? 'سيتم حذف حسابك وكل بياناتك نهائياً. هذا الإجراء لا يمكن التراجع عنه.'
        : 'Your account and all your data will be permanently deleted. This cannot be undone.',
      [
        { text: lang === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'ar' ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiFetch('/me', { method: 'DELETE' });
              await signOut();
              try {
                await Updates.reloadAsync();
              } catch {
                try {
                  const RN = require('react-native');
                  RN.DevSettings?.reload?.();
                } catch {
                  router.replace('/');
                }
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Failed';
              Alert.alert(
                lang === 'ar' ? 'فشل الحذف' : 'Delete failed',
                msg,
              );
            }
          },
        },
      ],
    );
  };

  const initial = (profile?.displayName?.[0] ?? profile?.email?.[0] ?? 'R').toUpperCase();
  const salary = appProfile?.monthlySalary ?? profile?.monthlySalary;

  const saveSalary = async (amount: number) => {
    await apiFetch('/me', { method: 'PATCH', body: JSON.stringify({ monthlySalary: amount }) });
    const res = await apiFetch<{ data: Profile }>('/me');
    setProfile(res.data);
    await refresh();
    bumpVersion();
    setSalaryOpen(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: tok.void, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>
        <Text style={{
          fontFamily: fontHead(lang),
          fontSize: 22, color: tok.bone, letterSpacing: -0.4,
          textAlign: lang === 'ar' ? 'right' : 'left',
        }}>{t('profile')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {/* Identity card */}
        <RCard large>
          <View style={{
            flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
            alignItems: 'center', gap: 14,
          }}>
            {!profile ? (
              <>
                <Skeleton width={56} height={56} radius={28} />
                <View style={{ flex: 1, gap: 8 }}>
                  <Skeleton width="60%" height={22} />
                  <Skeleton width="80%" height={10} />
                </View>
              </>
            ) : (
              <>
                <Pressable
                  onPress={handleChangePhoto}
                  disabled={uploadingAvatar}
                  style={({ pressed }) => ({
                    width: 56, height: 56,
                    // No overflow clip here - the badge sits at bottom-right
                    // extending past the avatar circle and would get cut off
                    // if the parent clipped its children.
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  {/* Inner circle wraps the image and clips to a round shape.
                      Keeping the clip on this child instead of the parent
                      lets the badge below extend outside the circle bounds. */}
                  <View style={{
                    width: 56, height: 56, borderRadius: 28,
                    backgroundColor: tok.elevated,
                    borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
                    alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                    {profile.avatarUrl ? (
                      <Image
                        source={{ uri: profile.avatarUrl }}
                        style={{ width: 56, height: 56 }}
                      />
                    ) : (
                      <Text style={{
                        color: tok.gold, fontFamily: fontHead(lang),
                        fontSize: 20, letterSpacing: -0.4,
                      }}>{initial}</Text>
                    )}
                  </View>
                  {/* Camera badge - sits over the bottom-right edge of the
                      circle as a tap hint. Border matches the card surface so
                      the badge reads as separate from the avatar disc. */}
                  <View style={{
                    position: 'absolute', bottom: -2, right: -2,
                    width: 22, height: 22, borderRadius: 11,
                    backgroundColor: tok.gold,
                    borderWidth: 2, borderColor: tok.surface,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {uploadingAvatar
                      ? <ActivityIndicator size="small" color="#0D0D0D" />
                      : <Camera size={11} color="#0D0D0D" strokeWidth={2.2} />}
                  </View>
                </Pressable>
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder={t('namePlaceholder')}
                    placeholderTextColor={tok.muted}
                    style={{
                      fontFamily: fontHead(lang),
                      fontSize: 20, color: tok.bone, letterSpacing: -0.4, padding: 0,
                      textAlign: lang === 'ar' ? 'right' : 'left',
                    }}
                  />
                  <REyebrow style={{ marginTop: 4, writingDirection: 'ltr' }}>{profile.email}</REyebrow>
                </View>
              </>
            )}
          </View>
        </RCard>

        {/* Plan — Budgets / Goals / Debts navigation */}
        <View style={{ marginTop: 18 }}>
          <REyebrow style={{ paddingHorizontal: 4, marginBottom: 8, textAlign: lang === 'ar' ? 'right' : 'left' }}>
            {lang === 'ar' ? 'الخطة' : 'Plan'}
          </REyebrow>
          <RCard padding={0} style={{ paddingHorizontal: 16 }}>
            <PlanRow
              icon={Banknote}
              title={lang === 'ar' ? 'الراتب الشهري' : 'Monthly salary'}
              hint={salary
                ? `${formatAmount(salary, { decimals: 0 })} ${currencyLabel(currency, lang)}`
                : (lang === 'ar' ? 'لم يُحدَّد بعد — اضغط لإضافته' : 'Not set — tap to add')}
              onPress={() => setSalaryOpen(true)}
            />
            <PlanRow
              icon={Wallet}
              title={lang === 'ar' ? 'الميزانيات' : 'Budgets'}
              hint={lang === 'ar' ? 'حد شهري لكل فئة' : 'A monthly cap per category'}
              onPress={() => router.push('/budgets')}
            />
            <PlanRow
              icon={Target}
              title={lang === 'ar' ? 'الأهداف' : 'Goals'}
              hint={lang === 'ar' ? 'ما الذي تدّخر له' : 'What you are saving toward'}
              onPress={() => router.push('/goals')}
            />
            <PlanRow
              icon={CreditCard}
              title={lang === 'ar' ? 'الديون' : 'Debts'}
              hint={lang === 'ar' ? 'ما الذي تدين به' : 'What you still owe'}
              onPress={() => router.push('/debts')}
            />
            <PlanRow
              icon={Tags}
              title={lang === 'ar' ? 'التصنيفات' : 'Categories'}
              hint={lang === 'ar' ? 'افتراضية + مخصصة' : 'Defaults + your own'}
              onPress={() => router.push('/categories')}
              last
            />
          </RCard>
        </View>

        {/* Channels — other places to talk to Seshat. */}
        <View style={{ marginTop: 18 }}>
          <REyebrow style={{ paddingHorizontal: 4, marginBottom: 8, textAlign: lang === 'ar' ? 'right' : 'left' }}>
            {lang === 'ar' ? 'القنوات' : 'Channels'}
          </REyebrow>
          <RCard padding={0} style={{ paddingHorizontal: 16 }}>
            <PlanRow
              icon={Send}
              title={lang === 'ar' ? 'بوت تيليجرام' : 'Telegram bot'}
              hint={lang === 'ar' ? 'تحدّث مع Seshat من تيليجرام' : 'Chat with Seshat from Telegram'}
              onPress={async () => {
                // Mint a one-time deep-link token so the bot can auto-link this
                // chat to the signed-in user without a second email + OTP step.
                // Falls back to the plain bot URL if the mint or open fails.
                let url = 'https://t.me/seshat_app_bot';
                try {
                  const r = await apiFetch<{ data: { deepLink: string } }>(
                    '/me/telegram/link-token',
                    { method: 'POST' },
                  );
                  if (r.data?.deepLink) url = r.data.deepLink;
                } catch (e) { /* fall through to plain URL */ }
                Linking.openURL(url).catch(() => {});
              }}
              last
            />
          </RCard>
        </View>

        {/* Help — support contact + future help articles */}
        <View style={{ marginTop: 18 }}>
          <REyebrow style={{ paddingHorizontal: 4, marginBottom: 8, textAlign: lang === 'ar' ? 'right' : 'left' }}>
            {lang === 'ar' ? 'المساعدة' : 'Help'}
          </REyebrow>
          <RCard padding={0} style={{ paddingHorizontal: 16 }}>
            <PlanRow
              icon={LifeBuoy}
              title={lang === 'ar' ? 'الدعم' : 'Support'}
              hint={lang === 'ar' ? 'أبلغي عن مشكلة أو اطلبي مساعدة' : 'Report a problem or ask for help'}
              onPress={() => router.push('/support')}
              last
            />
          </RCard>
        </View>

        {/* Preferences — icon-only toggles for theme + language */}
        <View style={{ marginTop: 18 }}>
          <REyebrow style={{ paddingHorizontal: 4, marginBottom: 8, textAlign: lang === 'ar' ? 'right' : 'left' }}>
            {lang === 'ar' ? 'التفضيلات' : 'Preferences'}
          </REyebrow>
          <RCard padding={14}>
            <View style={{
              flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
              gap: 10,
            }}>
              <IconToggle
                left={{ icon: Sun, label: t('light'), active: mode === 'light' }}
                right={{ icon: Moon, label: t('dark'), active: mode === 'dark' }}
                onLeft={() => setMode('light')}
                onRight={() => setMode('dark')}
              />
              <LangToggle
                lang={lang}
                onChange={(l) => setLang(l)}
              />
            </View>
          </RCard>
        </View>

        {/* Currency */}
        <View style={{ marginTop: 18 }}>
          <REyebrow style={{ paddingHorizontal: 4, marginBottom: 8, textAlign: lang === 'ar' ? 'right' : 'left' }}>
            {t('defaultCurrency')}
          </REyebrow>
          <RCard padding={14}>
            <View style={{
              flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
              flexWrap: 'wrap', gap: 8,
            }}>
              {CURRENCIES.map((c) => {
                const a = currency === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCurrency(c)}
                    style={({ pressed }) => ({
                      borderWidth: 1, borderColor: a ? tok.gold : tok.border,
                      backgroundColor: a ? tok.gold : 'transparent',
                      borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Text style={{
                      color: a ? '#0D0D0D' : tok.bone,
                      fontFamily: fontMono('medium'), fontSize: 12, letterSpacing: 1,
                    }}>{c}</Text>
                  </Pressable>
                );
              })}
            </View>
          </RCard>
        </View>

        <View style={{ marginTop: 22 }}>
          <RButton full onPress={handleSave} disabled={saving}>
            {saving ? t('saving') : saved ? t('saved') : t('saveChanges')}
          </RButton>
        </View>

        <View style={{ marginTop: 14 }}>
          <RButton full variant="destructive" onPress={handleSignOut}>{t('signOut')}</RButton>
        </View>

        {/* Manual OTA check. Useful when the background updater hasn't applied
            a new bundle yet and the user wants to force-pull the latest. */}
        <Pressable
          onPress={async () => {
            try {
              const check = await Updates.checkForUpdateAsync();
              if (check.isAvailable) {
                await Updates.fetchUpdateAsync();
                Alert.alert(
                  lang === 'ar' ? 'تم تحميل التحديث' : 'Update downloaded',
                  lang === 'ar'
                    ? 'سيتم إعادة تشغيل التطبيق الآن.'
                    : 'The app will reload now.',
                  [{
                    text: 'OK',
                    onPress: () => Updates.reloadAsync().catch(() => {}),
                  }],
                );
              } else {
                Alert.alert(
                  lang === 'ar' ? 'محدّث' : 'Up to date',
                  lang === 'ar'
                    ? 'أنتِ بالفعل على آخر إصدار.'
                    : 'You are already on the latest build.',
                );
              }
            } catch (e) {
              Alert.alert(
                lang === 'ar' ? 'فشل التحقق' : 'Check failed',
                e instanceof Error ? e.message : String(e),
              );
            }
          }}
          hitSlop={8}
          style={({ pressed }) => ({
            marginTop: 18, paddingVertical: 10,
            alignItems: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{
            color: tok.gold,
            fontFamily: fontMono('regular'),
            fontSize: 11,
            letterSpacing: lang === 'ar' ? 0 : 1.4,
            textTransform: lang === 'ar' ? 'none' : 'uppercase',
          }}>
            {lang === 'ar' ? 'تحقّق من التحديثات' : 'Check for updates'}
          </Text>
        </Pressable>

        {/* Replay first-launch tour. Useful if the user dismissed it accidentally
            or wants a refresher after new features ship. */}
        <Pressable
          onPress={async () => { await resetTour(); router.replace('/(tabs)'); }}
          hitSlop={8}
          style={({ pressed }) => ({
            marginTop: 4, paddingVertical: 10,
            alignItems: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{
            color: tok.muted,
            fontFamily: fontMono('regular'),
            fontSize: 11,
            letterSpacing: lang === 'ar' ? 0 : 1.4,
            textTransform: lang === 'ar' ? 'none' : 'uppercase',
          }}>
            {lang === 'ar' ? 'إعادة التعريف بالتطبيق' : 'Replay app tour'}
          </Text>
        </Pressable>

        {/* Danger zone. Collapsed by default so the delete button isn't a
            single careless tap away. Tapping the toggle reveals the typed-
            email confirmation gate; the actual delete button is disabled
            until what the user types exactly matches their account email.
            Apple Guideline 5.1.1(v) is still satisfied: account deletion
            is reachable in 3 taps + 1 typed email + 1 confirmation alert. */}
        <Pressable
          onPress={() => {
            setDangerOpen((o) => !o);
            if (dangerOpen) setDeleteConfirmText('');
          }}
          hitSlop={6}
          style={({ pressed }) => ({
            marginTop: 32, paddingVertical: 8,
            alignItems: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{
            color: tok.muted,
            fontFamily: fontMono('regular'),
            fontSize: 10,
            letterSpacing: 1.4,
          }}>
            {dangerOpen
              ? (lang === 'ar' ? 'إخفاء' : 'HIDE')
              : (lang === 'ar' ? 'منطقة الخطر' : 'DANGER ZONE')}
          </Text>
        </Pressable>

        {dangerOpen && (
          <View style={{
            marginTop: 4, marginBottom: 24,
            padding: 16, borderRadius: 12,
            backgroundColor: tok.surface,
            borderWidth: StyleSheet.hairlineWidth, borderColor: tok.alertText,
            gap: 12,
          }}>
            <Text style={{
              color: tok.bone, fontFamily: fontBody(lang, 'semibold'), fontSize: 14,
              textAlign: lang === 'ar' ? 'right' : 'left',
            }}>
              {lang === 'ar' ? 'حذف الحساب نهائياً' : 'Delete account permanently'}
            </Text>
            <Text style={{
              color: tok.muted, fontFamily: fontBody(lang), fontSize: 12, lineHeight: 18,
              textAlign: lang === 'ar' ? 'right' : 'left',
              writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
            }}>
              {lang === 'ar'
                ? `لتأكيد الحذف، اكتب بريدك الإلكتروني (${profile?.email ?? ''}) في الحقل أدناه. سيتم حذف الحساب وجميع البيانات (المعاملات، الميزانيات، الأهداف، الفئات) نهائياً ولا يمكن استرجاعها.`
                : `To confirm, type your email (${profile?.email ?? ''}) below. Your account and all data (transactions, budgets, goals, categories) will be permanently deleted.`}
            </Text>
            <TextInput
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder={profile?.email ?? ''}
              placeholderTextColor={tok.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={{
                borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
                borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
                color: tok.bone, fontFamily: fontMono('regular'), fontSize: 13,
                backgroundColor: tok.elevated,
                writingDirection: 'ltr',
              }}
            />
            <Pressable
              onPress={handleDeleteAccount}
              disabled={deleteConfirmText.trim().toLowerCase() !== (profile?.email?.toLowerCase() ?? '__NEVER_MATCH__')}
              style={({ pressed }) => {
                const enabled = deleteConfirmText.trim().toLowerCase() === (profile?.email?.toLowerCase() ?? '');
                return {
                  borderRadius: 10, paddingVertical: 12,
                  alignItems: 'center',
                  backgroundColor: enabled ? tok.alertText : tok.elevated,
                  opacity: pressed && enabled ? 0.85 : 1,
                };
              }}
            >
              <Text style={{
                color: deleteConfirmText.trim().toLowerCase() === (profile?.email?.toLowerCase() ?? '')
                  ? '#FFFFFF' : tok.muted,
                fontFamily: fontMono('regular'),
                fontSize: 11, letterSpacing: 1.4,
              }}>
                {lang === 'ar' ? 'حذف الحساب' : 'DELETE ACCOUNT'}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <SetSalarySheet
        visible={salaryOpen}
        onClose={() => setSalaryOpen(false)}
        onSave={saveSalary}
        defaultCurrency={currency}
        initialAmount={salary}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// PlanRow — single navigation row inside the Plan card
// ─────────────────────────────────────────────────────────────
function PlanRow({
  icon: Icon, title, hint, onPress, last,
}: { icon: any; title: string; hint: string; onPress: () => void; last?: boolean }) {
  const { tok, lang } = useI18n();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', gap: 12, paddingVertical: 14,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: tok.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: tok.elevated,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} color={tok.gold} strokeWidth={1.6} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            color: tok.bone, fontFamily: fontBody(lang, 'medium'), fontSize: 14,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}
        >{title}</Text>
        <Text
          numberOfLines={1}
          style={{
            marginTop: 2, color: tok.muted, fontFamily: fontBody(lang), fontSize: 12,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}
        >{hint}</Text>
      </View>
      <ChevronRight size={16} color={tok.muted} style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }} />
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// IconToggle — two-option pill with icons, used for theme
// ─────────────────────────────────────────────────────────────
function IconToggle({
  left, right, onLeft, onRight,
}: {
  left: { icon: any; label: string; active: boolean };
  right: { icon: any; label: string; active: boolean };
  onLeft: () => void; onRight: () => void;
}) {
  const { tok } = useI18n();
  return (
    <View style={{
      flex: 1, flexDirection: 'row', borderRadius: 10,
      backgroundColor: tok.elevated, padding: 3, gap: 2,
    }}>
      <ToggleHalf {...left} onPress={onLeft} />
      <ToggleHalf {...right} onPress={onRight} />
    </View>
  );
}

function ToggleHalf({
  icon: Icon, label, active, onPress,
}: { icon: any; label: string; active: boolean; onPress: () => void }) {
  const { tok, lang } = useI18n();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        backgroundColor: active ? tok.gold : 'transparent', borderRadius: 8,
        paddingVertical: 10, opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icon size={14} color={active ? '#0D0D0D' : tok.bone} strokeWidth={1.6} />
      <Text style={{
        color: active ? '#0D0D0D' : tok.bone,
        fontFamily: fontBody(lang, 'semibold'), fontSize: 12,
      }}>{label}</Text>
    </Pressable>
  );
}

function LangToggle({ lang, onChange }: { lang: 'en' | 'ar'; onChange: (l: 'en' | 'ar') => void }) {
  const { tok } = useI18n();
  return (
    <Pressable
      onPress={() => onChange(lang === 'ar' ? 'en' : 'ar')}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingHorizontal: 14, paddingVertical: 10,
        backgroundColor: tok.elevated, borderRadius: 10,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Globe size={14} color={tok.gold} strokeWidth={1.6} />
      <Text style={{
        color: tok.bone, fontFamily: fontMono('medium'), fontSize: 12, letterSpacing: 1.2,
      }}>{lang === 'ar' ? 'العربية' : 'EN'}</Text>
    </Pressable>
  );
}
