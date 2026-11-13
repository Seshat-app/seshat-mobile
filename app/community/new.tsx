import { useEffect, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView as ScreenScroll } from '../../components/Scroll';
import { PlanScreen } from '../../components/PlanShell';
import { RButton, RField, RPill, REyebrow } from '../../components/ui';
import { CommunityGuidelines } from '../../components/CommunityGuidelines';
import { useI18n } from '../../lib/i18n';
import { fontBody } from '../../lib/fonts';
import { apiFetch } from '../../lib/api';
import { TAGS, tagLabel, acceptGuidelines, communityState, type CQuestion } from '../../lib/community';

/** Ask a question. The guidelines are shown first, once. */
export default function NewQuestionScreen() {
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tag, setTag] = useState<string>('saving');
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState(false);

  useEffect(() => { communityState().then((s) => { if (!s.accepted) setRules(true); }).catch(() => {}); }, []);

  const post = async () => {
    setBusy(true);
    try {
      const r = await apiFetch<{ data: CQuestion }>('/community/questions', { method: 'POST', body: JSON.stringify({ title: title.trim(), body: body.trim(), tag }) });
      router.replace(`/community/${r.data.id}` as never);
    } catch (e) {
      Alert.alert(ar ? 'تعذّر النشر' : 'Could not post', e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  return (
    <PlanScreen title={ar ? 'سؤال جديد' : 'Ask a question'} subtitle={ar ? 'اكتب سؤالاً واضحاً ومحدداً' : 'Be clear and specific'}>
      <ScreenScroll contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40, paddingTop: 8, gap: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <RField label={ar ? 'السؤال' : 'QUESTION'} value={title} onChange={setTitle} maxLength={140} placeholder={ar ? 'مثلاً: كم يكفي كصندوق طوارئ؟' : 'e.g. How big should an emergency fund be?'} />
        <RField label={ar ? 'تفاصيل (اختياري)' : 'DETAILS (OPTIONAL)'} value={body} onChange={setBody} multiline minHeight={120} maxLength={2000} placeholder={ar ? 'أضف ما يساعد على الإجابة' : 'Add what helps someone answer'} />
        <View>
          <REyebrow style={{ marginBottom: 8, textAlign: ar ? 'right' : 'left' }}>{ar ? 'الموضوع' : 'TOPIC'}</REyebrow>
          <View style={{ flexDirection: ar ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
            {TAGS.map((t) => <RPill key={t} active={tag === t} onPress={() => setTag(t)}>{tagLabel(t, ar)}</RPill>)}
          </View>
        </View>
        <Text style={{ fontFamily: fontBody(lang), fontSize: 12.5, lineHeight: 18, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>
          {ar ? 'يراه كل أعضاء سيشات باسمك المعروض. لا تضع أرقام حسابات أو بطاقات أو هواتف أو روابط.' : 'Every Seshat member sees it with your display name. Keep account, card and phone numbers, and links, out of it.'}
        </Text>
        <RButton full onPress={post} loading={busy} disabled={busy || title.trim().length < 8}>{ar ? 'انشر السؤال' : 'Post question'}</RButton>
      </ScreenScroll>
      <CommunityGuidelines
        visible={rules}
        onClose={() => { setRules(false); router.back(); }}
        onAgree={() => { void acceptGuidelines().catch(() => {}); setRules(false); }}
      />
    </PlanScreen>
  );
}
