import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronUp, CheckCircle2, MoreHorizontal } from 'lucide-react-native';
import { ScrollView as ScreenScroll } from '../../components/Scroll';
import { PlanScreen } from '../../components/PlanShell';
import { RCard, RButton, RField, REyebrow } from '../../components/ui';
import { CommunityGuidelines } from '../../components/CommunityGuidelines';
import { useI18n } from '../../lib/i18n';
import { fontBody, fontHead, fontMono } from '../../lib/fonts';
import { apiFetch } from '../../lib/api';
import { tagLabel, timeAgo, acceptGuidelines, communityState, reportPost, blockAuthorOf, type CQuestion, type CAnswer } from '../../lib/community';

type Detail = { question: CQuestion; answers: CAnswer[] };
type Target = { type: 'question' | 'answer'; id: string; mine: boolean };

/** One question with its answers: vote, answer, mark the best answer, report or block. */
export default function QuestionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tok, lang } = useI18n();
  const ar = lang === 'ar';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<Detail | null>(null);
  const [gone, setGone] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState(false);

  const load = useCallback(async () => {
    try { const r = await apiFetch<{ data: Detail }>(`/community/questions/${id}`); setD(r.data); }
    catch { setGone(true); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const vote = async (type: 'question' | 'answer', tid: string) => {
    try {
      const r = await apiFetch<{ data: { votes: number; myVote: boolean } }>(`/community/${type === 'question' ? 'questions' : 'answers'}/${tid}/vote`, { method: 'POST', body: '{}' });
      setD((cur) => cur && (type === 'question'
        ? { ...cur, question: { ...cur.question, votes: r.data.votes, myVote: r.data.myVote } }
        : { ...cur, answers: cur.answers.map((a) => (a.id === tid ? { ...a, votes: r.data.votes, myVote: r.data.myVote } : a)) }));
    } catch (e) { Alert.alert(ar ? 'تعذّر التصويت' : 'Could not vote', e instanceof Error ? e.message : String(e)); }
  };

  const sendAnswer = async () => {
    setBusy(true);
    try {
      await apiFetch(`/community/questions/${id}/answers`, { method: 'POST', body: JSON.stringify({ body: text.trim() }) });
      setText(''); await load();
    } catch (e) { Alert.alert(ar ? 'تعذّر النشر' : 'Could not post', e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const answer = async () => {
    const s = await communityState().catch(() => null);
    if (s && !s.accepted) { setRules(true); return; }
    await sendAnswer();
  };

  const markBest = async (aid: string) => {
    try { await apiFetch(`/community/questions/${id}/accept`, { method: 'POST', body: JSON.stringify({ answerId: aid }) }); await load(); }
    catch (e) { Alert.alert(ar ? 'تعذّر' : 'Could not do that', e instanceof Error ? e.message : String(e)); }
  };

  const remove = (t: Target) => Alert.alert(
    t.type === 'question' ? (ar ? 'حذف السؤال؟' : 'Delete this question?') : (ar ? 'حذف الإجابة؟' : 'Delete this answer?'), '',
    [
      { text: ar ? 'إلغاء' : 'Cancel', style: 'cancel' },
      { text: ar ? 'حذف' : 'Delete', style: 'destructive', onPress: async () => {
        try { await apiFetch(`/community/${t.type === 'question' ? 'questions' : 'answers'}/${t.id}`, { method: 'DELETE' }); if (t.type === 'question') router.back(); else await load(); }
        catch (e) { Alert.alert(ar ? 'تعذّر الحذف' : 'Could not delete', e instanceof Error ? e.message : String(e)); }
      } },
    ],
  );
  const report = (t: Target) => Alert.alert(ar ? 'سبب البلاغ' : 'Why are you reporting this?', '', [
    ...(['spam', 'abuse', 'private', 'other'] as const).map((r) => ({
      text: { spam: ar ? 'مزعج أو إعلان' : 'Spam or advertising', abuse: ar ? 'إساءة' : 'Abusive', private: ar ? 'معلومات خاصة' : 'Private information', other: ar ? 'سبب آخر' : 'Something else' }[r],
      onPress: async () => { try { await reportPost(t.type, t.id, r); Alert.alert(ar ? 'شكراً' : 'Thank you', ar ? 'وصلنا بلاغك وسنراجعه.' : 'We received your report and will review it.'); } catch (e) { Alert.alert(ar ? 'تعذّر' : 'Could not report', e instanceof Error ? e.message : String(e)); } },
    })),
    { text: ar ? 'إلغاء' : 'Cancel', style: 'cancel' as const },
  ]);
  const block = (t: Target) => Alert.alert(ar ? 'حظر هذا العضو؟' : 'Block this member?', ar ? 'لن ترى منشوراته بعد الآن. يمكنك إلغاء الحظر من الملف الشخصي.' : 'You will no longer see their posts. You can undo this later.', [
    { text: ar ? 'إلغاء' : 'Cancel', style: 'cancel' },
    { text: ar ? 'حظر' : 'Block', style: 'destructive', onPress: async () => { try { await blockAuthorOf(t.type, t.id); if (t.type === 'question') router.back(); else await load(); } catch (e) { Alert.alert(ar ? 'تعذّر' : 'Could not block', e instanceof Error ? e.message : String(e)); } } },
  ]);
  const menu = (t: Target) => Alert.alert(ar ? 'خيارات' : 'Options', '', t.mine
    ? [{ text: ar ? 'حذف' : 'Delete', style: 'destructive', onPress: () => remove(t) }, { text: ar ? 'إلغاء' : 'Cancel', style: 'cancel' }]
    : [{ text: ar ? 'إبلاغ' : 'Report', onPress: () => report(t) }, { text: ar ? 'حظر هذا العضو' : 'Block this member', style: 'destructive', onPress: () => block(t) }, { text: ar ? 'إلغاء' : 'Cancel', style: 'cancel' }]);

  const VoteBtn = ({ n, on, onPress, disabled }: { n: number; on: boolean; onPress: () => void; disabled?: boolean }) => (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} style={{ alignItems: 'center', gap: 2, minWidth: 40, opacity: disabled ? 0.55 : 1 }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? tok.gold : tok.glowShellBg, borderWidth: 1, borderColor: tok.glowShellBorder }}>
        <ChevronUp size={18} color={on ? tok.void : tok.gold} strokeWidth={2.4} />
      </View>
      <Text style={{ fontFamily: fontMono('regular'), fontSize: 12, color: tok.muted }}>{n}</Text>
    </Pressable>
  );

  if (gone) return (
    <PlanScreen title={ar ? 'سؤال' : 'Question'}>
      <View style={{ paddingTop: 60, alignItems: 'center', gap: 8 }}>
        <Text style={{ color: tok.bone, fontFamily: fontBody(lang, 'medium'), fontSize: 16 }}>{ar ? 'هذا السؤال غير متاح.' : 'This question is not available.'}</Text>
        <View style={{ marginTop: 12 }}><RButton onPress={() => router.back()}>{ar ? 'رجوع' : 'Back'}</RButton></View>
      </View>
    </PlanScreen>
  );
  if (!d) return <PlanScreen title={ar ? 'سؤال' : 'Question'}><View style={{ paddingTop: 60 }}><ActivityIndicator color={tok.gold} /></View></PlanScreen>;
  const q = d.question;
  const qRtl = q.lang === 'ar';

  return (
    <PlanScreen title={ar ? 'سؤال' : 'Question'} subtitle={`${tagLabel(q.tag, ar)} · ${q.mine ? (ar ? 'أنت' : 'You') : q.authorName} · ${timeAgo(q.createdAt, ar)}`}>
      <ScreenScroll contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100, paddingTop: 8, gap: 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <RCard padding={16}>
          <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 12, alignItems: 'flex-start' }}>
            <VoteBtn n={q.votes} on={q.myVote} onPress={() => vote('question', q.id)} disabled={q.mine} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fontHead(lang), fontSize: 20, lineHeight: 27, color: tok.bone, textAlign: qRtl ? 'right' : 'left', writingDirection: qRtl ? 'rtl' : 'ltr' }}>{q.title}</Text>
              {q.body ? <Text style={{ marginTop: 8, fontFamily: fontBody(lang), fontSize: 14.5, lineHeight: 22, color: tok.bone, textAlign: qRtl ? 'right' : 'left', writingDirection: qRtl ? 'rtl' : 'ltr' }}>{q.body}</Text> : null}
            </View>
            <Pressable onPress={() => menu({ type: 'question', id: q.id, mine: q.mine })} hitSlop={10}><MoreHorizontal size={20} color={tok.muted} /></Pressable>
          </View>
          {q.status === 'hidden' ? <Text style={{ marginTop: 10, fontFamily: fontBody(lang), fontSize: 12, color: tok.alertText, textAlign: ar ? 'right' : 'left' }}>{ar ? 'مخفي حتى تراجعه الإدارة.' : 'Hidden until the team reviews it.'}</Text> : null}
        </RCard>

        <REyebrow style={{ textAlign: ar ? 'right' : 'left' }}>{d.answers.length === 0 ? (ar ? 'لا إجابات بعد' : 'No answers yet') : ar ? `${d.answers.length} إجابات` : `${d.answers.length} ${d.answers.length === 1 ? 'ANSWER' : 'ANSWERS'}`}</REyebrow>

        {d.answers.map((a) => {
          const aRtl = /[؀-ۿ]/.test(a.body);
          return (
            <RCard key={a.id} padding={16} accent={a.accepted}>
              <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 12, alignItems: 'flex-start' }}>
                <VoteBtn n={a.votes} on={a.myVote} onPress={() => vote('answer', a.id)} disabled={a.mine} />
                <View style={{ flex: 1 }}>
                  {a.accepted ? (
                    <View style={{ flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <CheckCircle2 size={15} color="#6FCF97" />
                      <Text style={{ fontFamily: fontMono('regular'), fontSize: 11, letterSpacing: 1, color: '#6FCF97' }}>{ar ? 'أفضل إجابة' : 'BEST ANSWER'}</Text>
                    </View>
                  ) : null}
                  <Text style={{ fontFamily: fontBody(lang), fontSize: 14.5, lineHeight: 22, color: tok.bone, textAlign: aRtl ? 'right' : 'left', writingDirection: aRtl ? 'rtl' : 'ltr' }}>{a.body}</Text>
                  <Text style={{ marginTop: 8, fontFamily: fontMono('regular'), fontSize: 11, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>{a.mine ? (ar ? 'أنت' : 'You') : a.authorName} · {timeAgo(a.createdAt, ar)}</Text>
                  {q.mine ? (
                    <Pressable onPress={() => markBest(a.id)} style={{ marginTop: 8 }}>
                      <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 13, color: tok.gold, textAlign: ar ? 'right' : 'left' }}>{a.accepted ? (ar ? 'إلغاء اختيارها' : 'Unmark best answer') : (ar ? 'اختر كأفضل إجابة' : 'Mark as best answer')}</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Pressable onPress={() => menu({ type: 'answer', id: a.id, mine: a.mine })} hitSlop={10}><MoreHorizontal size={20} color={tok.muted} /></Pressable>
              </View>
            </RCard>
          );
        })}

        <View style={{ gap: 10, marginTop: 4 }}>
          <RField label={ar ? 'إجابتك' : 'YOUR ANSWER'} value={text} onChange={setText} multiline minHeight={100} maxLength={2000} placeholder={ar ? 'اكتب إجابة تفيد السائل' : 'Write an answer that helps'} />
          <RButton full onPress={answer} loading={busy} disabled={busy || text.trim().length < 5}>{ar ? 'انشر الإجابة' : 'Post answer'}</RButton>
        </View>
      </ScreenScroll>
      <CommunityGuidelines
        visible={rules}
        onClose={() => setRules(false)}
        onAgree={async () => { await acceptGuidelines().catch(() => {}); setRules(false); await sendAnswer(); }}
      />
    </PlanScreen>
  );
}
