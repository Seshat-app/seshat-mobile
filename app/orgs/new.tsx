import { useState } from 'react';
import { View, Text, ScrollView, Alert, Pressable } from 'react-native';
import { Building2, Home } from 'lucide-react-native';
import { ScrollView as ScreenScroll } from '../../components/Scroll';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlanScreen } from '../../components/PlanShell';
import { REyebrow, RButton, RField, RPill } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { useAppData } from '../../lib/appData';
import { createOrg } from '../../lib/orgs';
import { fontBody, fontMono } from '../../lib/fonts';
import { useKeyboardHeight } from '../../components/useKeyboardHeight';
import type { OrgKind } from '../../lib/orgRoles';

const CURRENCIES = ['EGP', 'SAR', 'AED', 'USD', 'EUR', 'GBP'];

/**
 * /orgs/new - create a new organization.
 *
 * Name + currency only. Currency defaults to the user's personal currency
 * since the founder's instinct is usually "same money as before". Anyone
 * can change it post-creation via the org detail screen.
 *
 * On submit we:
 *   1. POST /orgs (server creates Organization + OrganizationMember owner
 *      + seeds default categories on the new ledger).
 *   2. switchLedger to the new org's ledgerId so the rest of the app
 *      immediately reflects the org context.
 *   3. Navigate to the org detail screen so the founder can immediately
 *      invite their teammates without an extra tap.
 */
export default function NewOrgScreen() {
  const router = useRouter();
  const { tok, lang } = useI18n();
  const { profile, switchLedger, refresh } = useAppData();
  const insets = useSafeAreaInsets();
  const kbHeight = useKeyboardHeight();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<string>(profile?.currency ?? 'EGP');
  const [submitting, setSubmitting] = useState(false);
  const [kind, setKind] = useState<OrgKind>('team');
  const ar = lang === 'ar';

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert(
        lang === 'ar' ? 'الاسم مطلوب' : 'Name required',
        lang === 'ar' ? 'سمّي منظمتكِ.' : 'Give your organization a name.',
      );
      return;
    }
    setSubmitting(true);
    try {
      const org = await createOrg(name.trim(), currency, kind);
      await switchLedger(org.ledgerId);
      await refresh();
      router.replace({ pathname: '/orgs/[id]', params: { id: org.id } });
    } catch (err) {
      Alert.alert(
        lang === 'ar' ? 'فشل الإنشاء' : 'Create failed',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PlanScreen
      title={kind === 'family' ? (ar ? 'عائلة جديدة' : 'New family') : (ar ? 'فريق جديد' : 'New team')}
      subtitle={kind === 'family' ? (ar ? 'ميزانية مشتركة للبيت' : 'One shared household ledger') : (ar ? 'مساحة مشتركة لفريقك' : 'A shared space for your team')}
    >
      <ScreenScroll
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 + kbHeight + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <REyebrow style={{ marginBottom: 8, textAlign: ar ? 'right' : 'left' }}>{ar ? 'نوع المساحة' : 'WHAT IS IT FOR'}</REyebrow>
        <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 10, marginBottom: 12 }}>
          {([['team', Building2, ar ? 'فريق' : 'Team', ar ? 'شركة أو مشروع. أدوار وصلاحيات.' : 'A company or project. Roles and permissions.'], ['family', Home, ar ? 'عائلة' : 'Family', ar ? 'بيت واحد. ميزانية مشتركة، ويمكن إضافة الأولاد.' : 'One household. A shared ledger; kids can join.']] as const).map(([k, Icon, label, hint]) => {
            const on = kind === k;
            return (
              <Pressable key={k} onPress={() => setKind(k)} style={{ flex: 1, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: on ? tok.gold : tok.border, backgroundColor: on ? tok.glowShellBg : 'transparent', gap: 6 }}>
                <Icon size={20} color={on ? tok.gold : tok.muted} strokeWidth={1.7} />
                <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 15, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{label}</Text>
                <Text style={{ fontFamily: fontBody(lang), fontSize: 12, lineHeight: 17, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>{hint}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{
          fontFamily: fontBody(lang), fontSize: 13, color: tok.muted, lineHeight: 19, marginBottom: 20,
          textAlign: ar ? 'right' : 'left', writingDirection: ar ? 'rtl' : 'ltr',
        }}>
          {kind === 'family'
            ? (ar ? 'بعد الإنشاء، ادعُ أفراد العائلة بالبريد وحدّد دور كلٍّ منهم: ولي أمر، بالغ، أو طفل يسجّل مصروفه فقط.' : 'After creating, invite your family by email and choose each person’s role: parent, adult, or a child who only logs their own spending.')
            : (ar ? 'بعد الإنشاء، ادعُ فريقك بالبريد وحدّد دور كلٍّ منهم، وصِل مجموعة تيليجرام لتسجيل المصاريف من المحادثة.' : 'After creating, invite your team by email, choose each person’s role, and link a Telegram group so anyone can log expenses by chatting.')}
        </Text>

        <RField
          label={kind === 'family' ? (ar ? 'اسم العائلة' : 'FAMILY NAME') : (ar ? 'اسم الفريق' : 'TEAM NAME')}
          value={name}
          onChange={setName}
          placeholder={kind === 'family' ? (ar ? 'مثل: بيت أحمد' : 'e.g. The Hassan household') : (ar ? 'مثل: شركة أكمي' : 'e.g. Acme Corp')}
          autoFocus
          autoCapitalize="words"
          maxLength={80}
          style={{ marginBottom: 22 }}
        />

        <REyebrow style={{ marginBottom: 6, textAlign: lang === 'ar' ? 'right' : 'left' }}>
          {lang === 'ar' ? 'العملة' : 'CURRENCY'}
        </REyebrow>
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          flexWrap: 'wrap', gap: 8, marginBottom: 24,
        }}>
          {CURRENCIES.map((c) => (
            <RPill key={c} active={c === currency} onPress={() => setCurrency(c)}>
              {c}
            </RPill>
          ))}
        </View>

        <RButton full onPress={submit} disabled={submitting || !name.trim()} loading={submitting}>
          {submitting
            ? (lang === 'ar' ? 'جارٍ الإنشاء...' : 'Creating...')
            : (kind === 'family' ? (ar ? 'إنشاء العائلة' : 'Create family') : (ar ? 'إنشاء الفريق' : 'Create team'))}
        </RButton>

        <Text style={{
          marginTop: 18,
          fontFamily: fontMono('regular'), fontSize: 10, color: tok.muted, letterSpacing: 1.2,
          textAlign: 'center', lineHeight: 16,
        }}>
          {lang === 'ar'
            ? 'تنشأ بتصنيفات جاهزة تناسبها · يمكنك التخصيص لاحقًا'
            : 'CREATED WITH READY-MADE CATEGORIES · CUSTOMIZE LATER'}
        </Text>
      </ScreenScroll>
    </PlanScreen>
  );
}
