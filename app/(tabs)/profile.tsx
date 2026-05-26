import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Sun, Moon, Globe, Wallet, Target, CreditCard, ChevronRight, Banknote,
} from 'lucide-react-native';
import { apiFetch, hasToken } from '../../lib/api';
import { signOut } from '../../lib/auth';
import { useI18n, type Lang, formatAmount, currencyLabel } from '../../lib/i18n';
import { useAppData } from '../../lib/appData';
import { fontBody, fontHead, fontMono } from '../../lib/fonts';
import { RCard, REyebrow, RButton } from '../../components/ui';
import { Skeleton } from '../../components/Skeleton';
import { SetSalarySheet } from '../../components/SalaryBanner';

const CURRENCIES = ['EGP', 'SAR', 'AED', 'USD', 'EUR', 'GBP'];

type Profile = {
  displayName?: string;
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

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  const handleDeleteAccount = () => {
    // Apple Guideline 5.1.1(v) — destructive enough to warrant a double-tap
    // confirmation, not a single tap. First Alert explains what will go;
    // only on "Continue" does the second Alert ask the actual yes/no.
    const lines = lang === 'ar'
      ? [
          'سيتم حذف حسابك وكل بياناتك نهائياً.',
          'لا يمكن التراجع.',
          'هل أنت متأكد؟',
        ]
      : [
          'Your account and all your data will be permanently deleted.',
          'This cannot be undone.',
          'Are you sure?',
        ];
    Alert.alert(
      lang === 'ar' ? 'حذف الحساب' : 'Delete account',
      lines.join('\n\n'),
      [
        { text: lang === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'ar' ? 'حذف نهائياً' : 'Delete permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiFetch('/me', { method: 'DELETE' });
              await signOut();
              router.replace('/');
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
                <View style={{
                  width: 56, height: 56, borderRadius: 28,
                  backgroundColor: tok.elevated,
                  borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{
                    color: tok.gold, fontFamily: fontHead(lang),
                    fontSize: 20, letterSpacing: -0.4,
                  }}>{initial}</Text>
                </View>
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

        {/* Account deletion — Apple Guideline 5.1.1(v). Visually softer than
            sign-out (smaller, ghost-style link) so users don't tap it by accident. */}
        <Pressable
          onPress={handleDeleteAccount}
          hitSlop={8}
          style={({ pressed }) => ({
            marginTop: 18, paddingVertical: 10,
            alignItems: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{
            color: tok.alertText,
            fontFamily: fontMono('regular'),
            fontSize: 11,
            letterSpacing: lang === 'ar' ? 0 : 1.4,
            textTransform: lang === 'ar' ? 'none' : 'uppercase',
          }}>{lang === 'ar' ? 'حذف الحساب نهائياً' : 'Delete account permanently'}</Text>
        </Pressable>
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
