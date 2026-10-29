import { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
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
      const org = await createOrg(name.trim(), currency);
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
      title={lang === 'ar' ? 'منظمة جديدة' : 'New organization'}
      subtitle={lang === 'ar' ? 'مساحة مشتركة لفريقكِ' : 'A shared space for your team'}
    >
      <ScreenScroll
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 + kbHeight + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={{
          fontFamily: fontBody(lang), fontSize: 13, color: tok.muted, lineHeight: 19,
          marginBottom: 24,
          textAlign: lang === 'ar' ? 'right' : 'left',
          writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
        }}>
          {lang === 'ar'
            ? 'بعد الإنشاء، يمكنكِ دعوة فريقكِ بالبريد الإلكتروني وربطها بمجموعة تيليجرام لتسجيل المصاريف من المحادثة.'
            : 'After creating, invite your team by email and link a Telegram group so anyone can log expenses by chatting.'}
        </Text>

        <RField
          label={lang === 'ar' ? 'اسم المنظمة' : 'ORGANIZATION NAME'}
          value={name}
          onChange={setName}
          placeholder={lang === 'ar' ? 'مثل: شركة أكمي' : 'e.g. Acme Corp'}
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
            : (lang === 'ar' ? 'إنشاء المنظمة' : 'Create organization')}
        </RButton>

        <Text style={{
          marginTop: 18,
          fontFamily: fontMono('regular'), fontSize: 10, color: tok.muted, letterSpacing: 1.2,
          textAlign: 'center', lineHeight: 16,
        }}>
          {lang === 'ar'
            ? 'تنشأ مع 11 تصنيفًا افتراضيًا · يمكنكِ التخصيص لاحقًا'
            : 'CREATED WITH 11 DEFAULT CATEGORIES · CUSTOMIZE LATER'}
        </Text>
      </ScreenScroll>
    </PlanScreen>
  );
}
