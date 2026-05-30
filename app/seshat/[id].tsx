import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, StyleSheet, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowUp, ChevronLeft, ImagePlus } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { apiFetch, hasToken } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { fontBody, fontHead, fontMono } from '../../lib/fonts';
import { REyebrow } from '../../components/ui';
import { useRecorder } from '../../components/useRecorder';
import { uploadReceipt } from '../../lib/cloudinary';
import { ChatBubble, TypingDots, RecordingMicIcon, type Message } from '../../components/ChatBubble';

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
  const params = useLocalSearchParams<{ id: string; text?: string }>();
  const initialId = typeof params.id === 'string' && params.id !== 'new' ? params.id : null;
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
  const scrollRef = useRef<ScrollView>(null);
  const recorder = useRecorder();

  // Load existing session messages on mount.
  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        if (!(await hasToken())) return;
        const r = await apiFetch<{ data: {
          id: string; title: string; lastMessageAt: string;
          messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; createdAt: string; createdTransactionIds?: string[] }>;
        } }>(`/chat/sessions/${sessionId}`);
        setTitle(r.data.title);
        setMessages(r.data.messages.map((m) => ({
          id: m.id, role: m.role, content: m.content,
          createdTransactionIds: m.createdTransactionIds,
        })));
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 80);
      } catch (err) {
        console.warn('load session failed', err);
      }
    })();
  }, [sessionId]);

  const sendText = async (textOverride?: string, imageUrl?: string) => {
    const text = (textOverride ?? input).trim();
    if ((!text && !imageUrl) || sending) return;

    if (!(await hasToken())) {
      setMessages((prev) => [...prev, { id: String(Date.now()), role: 'assistant', content: t('signInFirst') }]);
      return;
    }

    const userMsg: Message = {
      id: String(Date.now()),
      role: 'user',
      content: text || (lang === 'ar' ? '(إيصال مرفق)' : '(receipt attached)'),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      const res = await apiFetch<{ data: { reply: string; sessionId: string; createdTransactionIds?: string[] } }>('/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: text || undefined,
          imageUrl,
          sessionId: sessionId || undefined,
        }),
      });
      // Backend auto-created the session if we didn't have one yet.
      if (!sessionId) setSessionId(res.data.sessionId);
      setMessages((prev) => [...prev, {
        id: String(Date.now() + 1), role: 'assistant', content: res.data.reply, typing: true,
        createdTransactionIds: res.data.createdTransactionIds,
      }]);
    } catch (err) {
      setMessages((prev) => [...prev, { id: String(Date.now() + 1), role: 'assistant', content: t('somethingWrong'), typing: true }]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  };

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

  // Voice: same flow as text + uses /voice/chat which now takes sessionId.
  const sendVoice = async () => {
    const res = await recorder.stop();
    if (!res || sending) return;
    if (!(await hasToken())) {
      setMessages((prev) => [...prev, { id: String(Date.now()), role: 'assistant', content: t('signInFirst'), typing: true }]);
      return;
    }
    setSending(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    try {
      const r = await apiFetch<{ data: { transcript: string; reply: string; sessionId: string; createdTransactionIds?: string[] } }>('/voice/chat', {
        method: 'POST',
        body: JSON.stringify({
          audio_base64: res.base64, format: res.format, language: lang,
          sessionId: sessionId || undefined,
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
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('somethingWrong');
      setMessages((prev) => [...prev, { id: String(Date.now()), role: 'assistant', content: msg, typing: true }]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
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
      const upload = await uploadReceipt(picked.assets[0].uri);
      await sendText('', upload.secureUrl);
    } catch (err) {
      Alert.alert(
        lang === 'ar' ? 'فشل الرفع' : 'Upload failed',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={{ flex: 1, backgroundColor: tok.void, paddingTop: insets.top }}
      keyboardVerticalOffset={0}
    >
      {/* Top bar */}
      <View style={{
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', gap: 10,
        paddingHorizontal: 14, paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tok.border,
      }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => ({
            width: 34, height: 34, borderRadius: 12,
            backgroundColor: pressed ? tok.elevated : tok.surface,
            alignItems: 'center', justifyContent: 'center',
          })}
        >
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
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{
              fontFamily: fontBody(lang), fontSize: 14, color: tok.muted, textAlign: 'center',
            }}>
              {lang === 'ar'
                ? 'اكتب لي أو ارفع إيصالاً وسأتولى الباقي.'
                : 'Type to me, hold the mic to talk, or attach a receipt.'}
            </Text>
          </View>
        )}
        {messages.map((m) => (
          <ChatBubble
            key={m.id}
            message={m}
            onSkipTyping={() => setMessages((prev) => prev.map((p) => p.id === m.id ? { ...p, typing: false } : p))}
          />
        ))}
        {sending && <TypingDots />}
      </ScrollView>

      <View style={{
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        paddingHorizontal: 16, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 28 : 12,
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tok.border,
        backgroundColor: tok.navBg,
        alignItems: 'center', gap: 8,
      }}>
        <View style={{
          flex: 1, minHeight: 44,
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          alignItems: 'center', gap: 8,
          backgroundColor: tok.surface, borderWidth: 1, borderColor: tok.border,
          borderRadius: 14, paddingHorizontal: 12,
        }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => sendText()}
            placeholder={recorder.isRecording ? (lang === 'ar' ? 'يتم التسجيل…' : 'Recording…') : t('message')}
            placeholderTextColor={recorder.isRecording ? tok.gold : tok.muted}
            returnKeyType="send"
            multiline
            editable={!sending && !recorder.isRecording && !uploading}
            style={{
              flex: 1, color: tok.bone, fontFamily: fontBody(lang), fontSize: 14,
              paddingVertical: Platform.OS === 'ios' ? 12 : 8,
              maxHeight: 100,
              writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
              textAlign: lang === 'ar' ? 'right' : 'left',
            }}
          />
          <Pressable
            onPress={attachImage}
            disabled={sending || uploading}
            hitSlop={8}
            style={{ padding: 4, opacity: (sending || uploading) ? 0.4 : 1 }}
            accessibilityLabel="Attach receipt"
          >
            <ImagePlus size={20} color={uploading ? tok.gold : tok.muted} strokeWidth={1.5} />
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
        <Pressable
          onPress={() => sendText()}
          disabled={!input.trim() || sending}
          style={({ pressed }) => ({
            backgroundColor: input.trim() && !sending ? tok.gold : tok.elevated,
            width: 44, height: 44, borderRadius: 14,
            alignItems: 'center', justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <ArrowUp size={18} color={input.trim() && !sending ? '#0D0D0D' : tok.muted} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
