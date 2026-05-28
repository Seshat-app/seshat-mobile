import { useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, Alert, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { PlanScreen } from '../../components/PlanShell';
import { REyebrow, RButton } from '../../components/ui';
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
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 + kbHeight }}
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

        <REyebrow style={{ marginBottom: 6, textAlign: lang === 'ar' ? 'right' : 'left' }}>
          {lang === 'ar' ? 'اسم المنظمة' : 'ORGANIZATION NAME'}
        </REyebrow>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={lang === 'ar' ? 'مثل: شركة الرادار' : 'e.g. Acme Corp'}
          placeholderTextColor={tok.muted}
          autoFocus
          maxLength={80}
          style={{
            borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
            backgroundColor: tok.surface,
            borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12,
            color: tok.bone, fontFamily: fontBody(lang), fontSize: 16,
            marginBottom: 22,
            textAlign: lang === 'ar' ? 'right' : 'left',
            writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
          }}
        />

        <REyebrow style={{ marginBottom: 6, textAlign: lang === 'ar' ? 'right' : 'left' }}>
          {lang === 'ar' ? 'العملة' : 'CURRENCY'}
        </REyebrow>
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          flexWrap: 'wrap', gap: 8, marginBottom: 24,
        }}>
          {CURRENCIES.map((c) => {
            const active = c === currency;
            return (
              <Pressable
                key={c}
                onPress={() => setCurrency(c)}
                style={({ pressed }) => ({
                  borderWidth: 1, borderColor: active ? tok.gold : tok.border,
                  backgroundColor: active ? tok.gold : 'transparent',
                  borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{
                  color: active ? '#0D0D0D' : tok.bone,
                  fontFamily: fontMono('medium'), fontSize: 12, letterSpacing: 1,
                }}>{c}</Text>
              </Pressable>
            );
          })}
        </View>

        <RButton full onPress={submit} disabled={submitting || !name.trim()}>
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
      </ScrollView>
    </PlanScreen>
  );
}
