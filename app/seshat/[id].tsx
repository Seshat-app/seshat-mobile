import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { FlatList as ScreenFlatList } from '../../components/Scroll';
import { FrostedHeader, FrostedFooter } from '../../components/FrostedHeader';
import { LiquidBackdrop } from '../../components/LiquidBackdrop';
import { isLiquid } from '../../components/Glass';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowUp, ChevronLeft, ImagePlus, Square } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { apiFetch, hasToken } from '../../lib/api';
import { streamChat, friendlyChatError } from '../../lib/chatStream';
import { useI18n } from '../../lib/i18n';
import { fontBody, fontHead, fontMono } from '../../lib/fonts';
import { radius } from '../../lib/theme';
import { REyebrow, RChip } from '../../components/ui';
import { ScreenScaffold } from '../../components/Screen';
import { useRecorder } from '../../components/useRecorder';
import { uploadReceipt } from '../../lib/cloudinary';
import { ChatBubble, TypingDots, RecordingMicIcon, type Message } from '../../components/ChatBubble';
import { type VisualBlock } from '../../components/ChatVisuals';
import { ImageViewer } from '../../components/ImageViewer';
import PersonaSwitch from '../../components/PersonaSwitch';
import { getPersona, loadPersona, setActivePersona, type Persona } from '../../lib/persona';

/**
 * Chat view for a single Seshat session.
 *
 * Routes here from /(tabs)/seshat (the session list) when the user taps a
 * row OR taps "+ New chat". Auto-creation happens server-side: the first
 * POST /chat without a sessionId creates one. Until that first send the
 * URL param can be the literal string "new" - the view stays in "no
 * messages yet" state and the first send replaces it.
 */
export default function ChatViewScreen() {
  const router = useRouter();
  const { tok, lang, t } = useI18n();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; text?: string; persona?: string }>();
  const initialId = typeof params.id === 'string' && params.id !== 'new' ? params.id : null;
  // Persona this thread runs under. A new chat inherits the persona passed from
  // the session list (falling back to the persisted active persona); an
  // existing session adopts whatever persona it was created with (from GET).
  const initialPersona: Persona =
    params.persona === 'maat' || params.persona === 'seshat' ? params.persona : getPersona();
  // Optional pre-filled message - used by the FAB long-press → voice flow.
  // When present we auto-send it once the screen mounts, so the user lands
  // straight on Seshat's reply instead of an empty composer.
  const initialText = typeof params.text === 'string' && params.text.trim() ? params.text.trim() : null;
  const autoSentRef = useRef(false);

  const [sessionId, setSessionId] = useState<string | null>(initialId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [title, setTitle] = useState<string>(lang === 'ar' ? 'محادثة جديدة' : 'New chat');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  // When set, the composer is editing a prior user message: on the next normal
  // send we truncate the thread from that message onward, then send fresh.
  const [editingId, setEditingId] = useState<string | null>(null);
  // Full-screen preview for a tapped receipt/attachment thumbnail.
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const scrollRef = useRef<FlatList<Message>>(null);
  const inputRef = useRef<TextInput>(null);
  const recorder = useRecorder();
  // Synchronous in-flight guard + abort handle for the streaming turn. `sending`
  // is async state, so two very fast taps can both pass the check before it
  // flips; this ref flips synchronously. abortRef lets the Stop button cancel.
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  // Active persona for this thread. Seshat = doer (read+write), Maat = read-only
  // analyst. The client just sends persona; the backend enforces capability.
  const [persona, setPersona] = useState<Persona>(initialPersona);

  // For a brand-new chat with no explicit persona param, sync to the persisted
  // active persona once it's read from storage.
  useEffect(() => {
    if (initialId || params.persona) return;
    loadPersona().then((p) => setPersona(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toggling the header switch changes this thread's persona AND persists it as
  // the active persona, so the session list + next new chat stay in sync.
  const changePersona = useCallback((p: Persona) => {
    setPersona(p);
    setActivePersona(p);
  }, []);

  // Load existing session messages on mount.
  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        if (!(await hasToken())) return;
        const r = await apiFetch<{ data: {
          id: string; title: string; lastMessageAt: string; persona?: Persona;
          messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; createdAt: string; createdTransactionIds?: string[]; visualBlocks?: VisualBlock[]; quickReplies?: string[]; activity?: Message['activity']; imageUrl?: string }>;
        } }>(`/chat/sessions/${sessionId}`);
        setTitle(r.data.title);
        if (r.data.persona === 'seshat' || r.data.persona === 'maat') setPersona(r.data.persona);
        setMessages(r.data.messages.map((m) => ({
          id: m.id, role: m.role, content: m.content,
          createdTransactionIds: m.createdTransactionIds,
          blocks: m.visualBlocks,
          quickReplies: m.quickReplies?.length ? m.quickReplies : undefined,
          activity: m.activity,
          imageUrl: m.imageUrl,
        })));
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 80);
      } catch (err) {
        console.warn('load session failed', err);
      }
    })();
  }, [sessionId]);

  // Non-stream JSON send — used for image/receipt turns (the streaming contract
  // is message-based) and as the fallback when streaming can't start.
  const sendViaJson = async (text: string, pendingId: string, imageUrl?: string) => {
    const res = await apiFetch<{ data: { reply: string; sessionId: string; createdTransactionIds?: string[]; visualBlocks?: VisualBlock[]; quickReplies?: string[]; activity?: Message['activity'] } }>('/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: text || undefined,
        imageUrl,
        sessionId: sessionId || undefined,
        persona,
      }),
    });
    if (!sessionId) setSessionId(res.data.sessionId);
    setMessages((prev) => prev.map((m) => (m.id === pendingId ? {
      ...m,
      content: res.data.reply,
      typing: true,
      pending: false,
      createdTransactionIds: res.data.createdTransactionIds,
      blocks: res.data.visualBlocks,
      quickReplies: res.data.quickReplies?.length ? res.data.quickReplies : undefined,
      activity: res.data.activity ?? m.activity,
    } : m)));
  };

  // Core streaming runner shared by a fresh send and a regenerate. Streams into
  // the given pending assistant bubble, falling back to the non-stream JSON path
  // only when NO frame ever arrived (a mid-stream break already ran the turn
  // server-side; retrying would double its side effects). Honors abort (Stop):
  // finalize the bubble, no error, no retry. Clears the in-flight flags in
  // `finally` so it owns the whole lifecycle of a streamed turn.
  const runStream = async (body: { message?: string; regenerate?: boolean }, pendingId: string) => {
    const patchPending = (patch: Partial<Message>) =>
      setMessages((prev) => prev.map((m) => (m.id === pendingId ? { ...m, ...patch } : m)));

    const controller = new AbortController();
    abortRef.current = controller;
    // Did at least one stream frame arrive? If so we must NOT fall back.
    let streamed = false;
    try {
      await streamChat({ ...body, sessionId: sessionId || undefined, persona }, (frame) => {
        streamed = true;
        if (frame.t === 'step') {
          setMessages((prev) => prev.map((m) => (m.id === pendingId
            ? { ...m, activity: [...(m.activity ?? []), frame.step] } : m)));
        } else if (frame.t === 'done') {
          if (!sessionId) setSessionId(frame.sessionId);
          // Keep the live-streamed steps if the terminal frame omits `activity`.
          setMessages((prev) => prev.map((m) => (m.id === pendingId ? {
            ...m,
            content: frame.reply,
            typing: true,
            pending: false,
            createdTransactionIds: frame.createdTransactionIds,
            blocks: frame.visualBlocks as VisualBlock[] | undefined,
            quickReplies: frame.quickReplies?.length ? frame.quickReplies : undefined,
            activity: frame.activity ?? m.activity,
          } : m)));
        } else if (frame.t === 'error') {
          console.warn('[chat] stream error:', frame.message);
          patchPending({ content: friendlyChatError(frame.message), typing: true, pending: false });
        }
      }, controller.signal);
    } catch (err) {
      if (controller.signal.aborted) {
        // User hit Stop — finalize the pending bubble with whatever streamed so
        // far (its activity trace); no error, no fallback.
        patchPending({ pending: false, typing: false });
      } else if (streamed) {
        // Broke mid-stream — surface an error on the pending bubble.
        const raw = err instanceof Error ? err.message : String(err);
        console.warn('[chat] stream broke mid-turn:', raw);
        patchPending({ content: friendlyChatError(raw), typing: true, pending: false });
      } else {
        // Streaming never started (unsupported / failed handshake) — fall back
        // to the plain non-stream JSON path on the same pending bubble.
        try {
          const res = await apiFetch<{ data: { reply: string; sessionId: string; createdTransactionIds?: string[]; visualBlocks?: VisualBlock[]; quickReplies?: string[]; activity?: Message['activity'] } }>('/chat', {
            method: 'POST',
            body: JSON.stringify({ ...body, sessionId: sessionId || undefined, persona }),
          });
          if (!sessionId) setSessionId(res.data.sessionId);
          setMessages((prev) => prev.map((m) => (m.id === pendingId ? {
            ...m,
            content: res.data.reply,
            typing: true,
            pending: false,
            createdTransactionIds: res.data.createdTransactionIds,
            blocks: res.data.visualBlocks,
            quickReplies: res.data.quickReplies?.length ? res.data.quickReplies : undefined,
            activity: res.data.activity ?? m.activity,
          } : m)));
        } catch (jsonErr) {
          const raw = jsonErr instanceof Error ? jsonErr.message : String(jsonErr);
          patchPending({ content: friendlyChatError(raw), typing: true, pending: false });
        }
      }
    } finally {
      inFlightRef.current = false;
      abortRef.current = null;
      setSending(false);
    }
  };

  const sendText = async (textOverride?: string, imageUrl?: string) => {
    const text = (textOverride ?? input).trim();
    if ((!text && !imageUrl) || sending || inFlightRef.current) return;

    if (!(await hasToken())) {
      setMessages((prev) => [...prev, { id: String(Date.now()), role: 'assistant', content: t('signInFirst') }]);
      return;
    }

    inFlightRef.current = true;

    // Edit mode: a NORMAL send (no override — i.e. the user pressed send on the
    // edited text) truncates the thread from the edited user message onward
    // (server + local) before sending fresh. Follow-up chips pass an override
    // and are never treated as edits.
    const editId = textOverride === undefined ? editingId : null;
    // An override send (follow-up chip / voice / auto-send) isn't an edit, but
    // it should still dismiss a dangling edit banner if one is open.
    if (textOverride !== undefined && editingId) setEditingId(null);
    if (editId) {
      const idx = messages.findIndex((m) => m.id === editId);
      if (idx >= 0) {
        const doomed = messages.slice(idx);
        setMessages((prev) => prev.slice(0, idx));
        if (sessionId) {
          await Promise.all(doomed.map((m) =>
            apiFetch(`/chat/sessions/${sessionId}/messages/${m.id}`, { method: 'DELETE' }).catch(() => {})));
        }
      }
      setEditingId(null);
    }

    const now = Date.now();
    const pendingId = String(now + 1);
    const userMsg: Message = {
      id: String(now),
      role: 'user',
      content: text || (lang === 'ar' ? '(إيصال مرفق)' : '(receipt attached)'),
      imageUrl,
    };
    // Push the user turn AND an empty pending assistant bubble at once, so the
    // activity trace + cursor appear the instant we send.
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: pendingId, role: 'assistant', content: '', activity: [], pending: true },
    ]);
    setInput('');
    setSending(true);

    // Image/receipt turns skip streaming (message-based contract) → JSON path.
    if (imageUrl) {
      try {
        await sendViaJson(text, pendingId, imageUrl);
      } catch {
        setMessages((prev) => prev.map((m) => (m.id === pendingId
          ? { ...m, content: t('somethingWrong'), typing: true, pending: false } : m)));
      } finally {
        inFlightRef.current = false;
        setSending(false);
      }
      return;
    }

    await runStream({ message: text }, pendingId);
  };

  // Regenerate the latest assistant reply: drop trailing assistant bubble(s)
  // from view, then re-stream via the regenerate flag against the session's
  // last user turn (the backend re-runs it and replaces the reply server-side).
  const regenerate = async () => {
    if (sending || inFlightRef.current || !sessionId) return;
    const base = [...messages];
    while (base.length && base[base.length - 1].role === 'assistant') base.pop();
    if (!base.some((m) => m.role === 'user')) return; // nothing to regenerate
    inFlightRef.current = true;
    const pendingId = String(Date.now());
    setMessages([...base, { id: pendingId, role: 'assistant', content: '', activity: [], pending: true }]);
    setSending(true);
    await runStream({ regenerate: true }, pendingId);
  };

  // Delete a single message (server + view) behind a confirm.
  const deleteMessage = (m: Message) => {
    Alert.alert(
      lang === 'ar' ? 'حذف هذه الرسالة؟' : 'Delete this message?',
      lang === 'ar' ? 'ستُحذف هذه الرسالة من السجل.' : 'This message will be struck from the record.',
      [
        { text: lang === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'ar' ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            setMessages((prev) => prev.filter((x) => x.id !== m.id));
            if (sessionId) {
              await apiFetch(`/chat/sessions/${sessionId}/messages/${m.id}`, { method: 'DELETE' }).catch(() => {});
            }
          },
        },
      ],
    );
  };

  // Put a user message back into the composer in edit mode.
  const editMessage = (m: Message) => {
    setEditingId(m.id);
    setInput(m.content);
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  // Stable identities for the per-bubble action callbacks so ChatBubble's memo
  // isn't defeated by a new closure each keystroke. They delegate to a ref that
  // always holds the latest implementation (which closes over current state).
  const handlersRef = useRef({ regenerate, deleteMessage, editMessage });
  handlersRef.current = { regenerate, deleteMessage, editMessage };
  const handleRegenerate = useCallback(() => handlersRef.current.regenerate(), []);
  const handleDelete = useCallback((m: Message) => handlersRef.current.deleteMessage(m), []);
  const handleEdit = useCallback((m: Message) => handlersRef.current.editMessage(m), []);

  // Abort the in-flight stream. The catch block finalizes the pending bubble
  // with whatever streamed so far.
  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // FAB long-press → voice flow: when the screen mounts with ?text=...,
  // auto-send that text as the user's first message. Guarded by autoSentRef
  // so a re-render or route change doesn't fire it twice.
  useEffect(() => {
    if (!initialText || autoSentRef.current || sessionId !== null) return;
    autoSentRef.current = true;
    sendText(initialText);
    // We deliberately leave `sendText` out of deps - it's recreated every
    // render but the autoSentRef guard ensures we only fire once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialText]);

  // Single effect that scrolls to the end whenever a message is added.
  // Replaces the scattered per-call setTimeout(scrollToEnd) calls to avoid
  // multiple competing scroll animations per turn.
  useEffect(() => {
    if (messages.length === 0) return;
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [messages.length]);

  // Stable callback for skipping a bubble's typing animation. Passed to all
  // ChatBubble instances so memoization actually fires.
  const handleSkipTyping = useCallback((id: string) => {
    setMessages((prev) => prev.map((p) => p.id === id ? { ...p, typing: false } : p));
  }, []);

  // Stable so ChatBubble's memo isn't defeated by a new closure each render.
  const handlePressImage = useCallback((uri: string) => setViewerUri(uri), []);

  // Voice: same flow as text + uses /voice/chat which now takes sessionId.
  const sendVoice = async () => {
    const res = await recorder.stop();
    if (!res || sending) return;
    if (!(await hasToken())) {
      setMessages((prev) => [...prev, { id: String(Date.now()), role: 'assistant', content: t('signInFirst'), typing: true }]);
      return;
    }
    setSending(true);
    try {
      const r = await apiFetch<{ data: { transcript: string; reply: string; sessionId: string; createdTransactionIds?: string[]; visualBlocks?: VisualBlock[] } }>('/voice/chat', {
        method: 'POST',
        body: JSON.stringify({
          audio_base64: res.base64, format: res.format, language: lang,
          sessionId: sessionId || undefined,
          persona,
        }),
      });
      if (!sessionId) setSessionId(r.data.sessionId);
      const ts = Date.now();
      setMessages((prev) => [
        ...prev,
        { id: String(ts), role: 'user', content: r.data.transcript || '🎙️' },
        {
          id: String(ts + 1), role: 'assistant', content: r.data.reply, typing: true,
          createdTransactionIds: r.data.createdTransactionIds,
          blocks: r.data.visualBlocks,
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('somethingWrong');
      setMessages((prev) => [...prev, { id: String(Date.now()), role: 'assistant', content: msg, typing: true }]);
    } finally {
      setSending(false);
    }
  };

  // Image attach: pick from camera or library, upload to Cloudinary,
  // send as an attachment to /chat which routes through receipt OCR.
  const attachImage = async () => {
    if (uploading || sending) return;
    Alert.alert(
      lang === 'ar' ? 'إرفاق إيصال' : 'Attach a receipt',
      lang === 'ar' ? 'من أين الصورة؟' : 'Where is the photo from?',
      [
        { text: lang === 'ar' ? 'الكاميرا' : 'Camera', onPress: () => pickAndSendImage('camera') },
        { text: lang === 'ar' ? 'الصور' : 'Photos', onPress: () => pickAndSendImage('library') },
        { text: lang === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
      ],
    );
  };
  const pickAndSendImage = async (source: 'camera' | 'library') => {
    try {
      const perm = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const picked = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: false,
          });
      if (picked.canceled || !picked.assets?.[0]?.uri) return;
      setUploading(true);
      // Transient "uploading" bubble so the user sees the receipt is in flight,
      // not just a tiny spinner on the icon. Removed once the upload resolves
      // (sendText then adds the real "(receipt attached)" turn).
      const tempId = '__uploading__' + Date.now();
      setMessages((prev) => [...prev, {
        id: tempId, role: 'user', uploading: true,
        content: lang === 'ar' ? 'جارٍ رفع الإيصال…' : 'Uploading receipt…',
      }]);
      try {
        const upload = await uploadReceipt(picked.assets[0].uri);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        await sendText('', upload.secureUrl);
      } catch (uploadErr) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        throw uploadErr;
      }
    } catch (err) {
      Alert.alert(
        lang === 'ar' ? 'فشل الرفع' : 'Upload failed',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setUploading(false);
    }
  };

  // Follow-up suggestion chips shown after the latest assistant reply (never
  // while streaming). Tailored to the persona: Seshat (doer) suggests actions,
  // Maat (read-only analyst) suggests reads.
  const lastMsg = messages[messages.length - 1];
  const showFollowups = !sending && !!lastMsg && lastMsg.role === 'assistant'
    && !!lastMsg.content && !lastMsg.pending;
  // When the reply asked a question, its answer options replace the generic chips.
  const asked = lastMsg?.role === 'assistant' ? lastMsg.quickReplies : undefined;
  const followups = asked && asked.length ? asked : persona === 'maat'
    ? (lang === 'ar'
        ? ['قارن بالشهر الماضي', 'أكبر فئة', 'اتجاه الإنفاق']
        : ['Compare to last month', 'Biggest category', 'Spending trend'])
    : (lang === 'ar'
        ? ['سجّل معاملة أخرى', 'حدّد ميزانية', 'تراجع عن ذلك']
        : ['Log another', 'Set a budget', 'Undo that']);

  return (
    <ScreenScaffold>
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
      {/* Top bar — borderless, glassy back button */}
      <FrostedHeader style={{
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', gap: 10,
        paddingHorizontal: 14, paddingVertical: 10,
      }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => ({
            width: 34, height: 34, borderRadius: radius.btn,
            backgroundColor: isLiquid() ? 'transparent' : (pressed ? tok.elevated : tok.shellBg),
            borderWidth: isLiquid() ? 0 : 1, borderColor: tok.shellBorder,
            alignItems: 'center', justifyContent: 'center',
          })}
        >
          <LiquidBackdrop radius={radius.btn} fallback="transparent" />
          <ChevronLeft size={18} color={tok.bone} style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fontHead(lang), fontSize: 16, color: tok.bone, letterSpacing: -0.2,
              textAlign: lang === 'ar' ? 'right' : 'left',
            }}
          >
            {title}
          </Text>
        </View>
        {/* Persona switch — reflects/sets which persona answers this thread. */}
        <PersonaSwitch value={persona} onChange={changePersona} size="sm" />
      </FrostedHeader>

      <ScreenFlatList
        ref={scrollRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <ChatBubble
            message={item}
            onSkipTyping={handleSkipTyping}
            onPressImage={handlePressImage}
            onRegenerate={handleRegenerate}
            onDelete={handleDelete}
            onEdit={handleEdit}
            busy={sending}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{
              fontFamily: fontBody(lang), fontSize: 14, color: tok.muted, textAlign: 'center',
            }}>
              {persona === 'maat'
                ? (lang === 'ar'
                    ? 'اسأل ماعت عن تقرير أو تحليل — تقرأ وتزن ولا تغيّر شيئاً.'
                    : 'Ask Maat for a report or a read on your month — she weighs, never changes.')
                : (lang === 'ar'
                    ? 'اكتب لي أو ارفع إيصالاً وسأتولى الباقي.'
                    : 'Type to me, hold the mic to talk, or attach a receipt.')}
            </Text>
          </View>
        }
        ListFooterComponent={
          sending && !messages.some((m) => m.pending)
            ? <TypingDots />
            : showFollowups
              ? (
                <View style={{
                  flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                  flexWrap: 'wrap', gap: 8, marginTop: 4,
                }}>
                  {followups.map((c) => (
                    <RChip key={c} label={c} onPress={() => sendText(c)} />
                  ))}
                </View>
              )
              : null
        }
      />

      {editingId && (
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          alignItems: 'center', justifyContent: 'space-between', gap: 8,
          marginHorizontal: 16, marginBottom: 6,
          paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.btn,
          backgroundColor: tok.glowShellBg,
          borderWidth: 1, borderColor: tok.glowShellBorder,
        }}>
          <Text style={{
            flex: 1, color: tok.gold, fontFamily: fontMono('regular'),
            fontSize: 11, letterSpacing: 0.4,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>
            {lang === 'ar' ? 'تعديل الرسالة — أرسل لتستبدل ما بعدها' : 'Editing message — send to replace what follows'}
          </Text>
          <Pressable
            onPress={() => { setEditingId(null); setInput(''); }}
            hitSlop={8}
            accessibilityLabel={lang === 'ar' ? 'إلغاء التعديل' : 'Cancel edit'}
          >
            <Text style={{ color: tok.gold, fontFamily: fontMono('regular'), fontSize: 11, letterSpacing: 0.4 }}>
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </Text>
          </Pressable>
        </View>
      )}

      <FrostedFooter style={{
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12),
        alignItems: 'flex-end', gap: 8,
      }}>
        <View style={{
          flex: 1, minHeight: 48,
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          alignItems: 'center', gap: 8,
          backgroundColor: tok.coreBg, borderWidth: 1,
          // gold glow on focus — the input becomes the star
          borderColor: inputFocused ? tok.glowShellBorder : tok.shellBorder,
          borderTopColor: inputFocused ? tok.glowShellBorder : tok.coreSheen,
          borderRadius: 24, paddingHorizontal: 16,
          shadowColor: tok.glowShadow,
          shadowOpacity: inputFocused ? 0.14 : 0,
          shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
        }}>
          <TextInput
            ref={inputRef}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => sendText()}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder={recorder.isRecording ? (lang === 'ar' ? 'يتم التسجيل…' : 'Recording…') : t('message')}
            placeholderTextColor={recorder.isRecording ? tok.gold : tok.muted}
            returnKeyType="send"
            multiline
            editable={!sending && !recorder.isRecording && !uploading}
            style={{
              flex: 1, color: tok.bone, fontFamily: fontBody(lang), fontSize: 16,
              paddingVertical: Platform.OS === 'ios' ? 13 : 9,
              maxHeight: 110,
              writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
              textAlign: lang === 'ar' ? 'right' : 'left',
            }}
          />
          <Pressable
            onPress={attachImage}
            disabled={sending || uploading}
            hitSlop={8}
            style={{ padding: 4, opacity: sending && !uploading ? 0.4 : 1 }}
            accessibilityLabel="Attach receipt"
          >
            {uploading
              ? <ActivityIndicator size="small" color={tok.gold} />
              : <ImagePlus size={20} color={tok.muted} strokeWidth={1.5} />}
          </Pressable>
          <Pressable
            onPressIn={() => { if (!sending) recorder.start(); }}
            onPressOut={() => { if (recorder.isRecording) sendVoice(); }}
            disabled={sending}
            hitSlop={8}
            style={{ padding: 4, opacity: sending ? 0.4 : 1 }}
            accessibilityLabel="Hold to record"
          >
            <RecordingMicIcon recording={recorder.isRecording} muted={tok.muted} gold={tok.gold} />
          </Pressable>
        </View>
        {sending ? (
          <Pressable
            onPress={stopStreaming}
            accessibilityLabel={lang === 'ar' ? 'إيقاف' : 'Stop'}
            style={({ pressed }) => ({
              backgroundColor: tok.gold,
              width: 46, height: 46, borderRadius: 23,
              alignItems: 'center', justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
              shadowColor: tok.glowShadow, shadowOpacity: 0.18,
              shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
            })}
          >
            <Square size={16} color={tok.void} fill={tok.void} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => sendText()}
            disabled={!input.trim()}
            style={({ pressed }) => ({
              backgroundColor: input.trim() ? tok.gold : tok.elevated,
              width: 46, height: 46, borderRadius: 23,
              alignItems: 'center', justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
              ...(input.trim() ? {
                shadowColor: tok.glowShadow, shadowOpacity: 0.18,
                shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
              } : {}),
            })}
          >
            <ArrowUp size={18} color={input.trim() ? tok.void : tok.muted} />
          </Pressable>
        )}
      </FrostedFooter>
      </KeyboardAvoidingView>
      <ImageViewer visible={viewerUri !== null} uri={viewerUri} onClose={() => setViewerUri(null)} />
    </ScreenScaffold>
  );
}
