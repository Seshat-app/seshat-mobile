import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput, StyleSheet, Animated,
  Platform, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, X, Sparkles, Mic, Delete } from 'lucide-react-native';
import { useI18n, currencyLabel } from '../lib/i18n';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { RSegmented, RButton, REyebrow } from './ui';
import { CategoryIcon, CatIconAlias } from './icons';
import { catIdFromName, catLabel, type CatId } from '../lib/categoryMap';
import { useKeyboardHeight } from './useKeyboardHeight';
import { useRecorder } from './useRecorder';
import { apiFetch, newIdempotencyKey } from '../lib/api';

export type ApiCategory = { _id: string; nameEn: string; nameAr?: string; emoji?: string; type?: 'income' | 'expense' | 'both' };

export type AddTxPayload = {
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  categoryId: string;
  description?: string;
  date: string; // YYYY-MM-DD
};

// Natural-language parser: extracts amount + category hint from "spent 200 on food"
// or Arabic equivalents like "صرفت ٢٠٠ على أكل". Returns null when no number found.
function parseNL(text: string): { amount: number; catHint: CatId } | null {
  if (!text?.trim()) return null;
  const norm = text
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[٫،]/g, '.');
  const m = norm.match(/\d+(\.\d+)?/);
  if (!m) return null;
  const amount = parseFloat(m[0]);

  const lower = text.toLowerCase();
  const map: Array<{ id: CatId; kw: string[] }> = [
    { id: 'food', kw: ['food', 'lunch', 'dinner', 'meal', 'zooba', 'shawarma', 'pizza', 'koshary', 'cilantro', 'coffee', 'café', 'cafe', 'أكل', 'غدا', 'عشاء', 'طعام', 'قهوة', 'كوفي'] },
    { id: 'transport', kw: ['uber', 'taxi', 'careem', 'transport', 'metro', 'أوبر', 'تاكسي', 'كريم', 'مواصلات'] },
    { id: 'shopping', kw: ['shopping', 'amazon', 'souq', 'noon', 'تسوق', 'سوق', 'نون'] },
    { id: 'entertainment', kw: ['netflix', 'spotify', 'subscription', 'anghami', 'اشتراك', 'نتفليكس'] },
    { id: 'housing', kw: ['rent', 'wifi', 'electric', 'إيجار', 'كهرباء'] },
    { id: 'health', kw: ['pharmacy', 'doctor', 'صيدلية', 'دكتور'] },
  ];
  const hit = map.find((c) => c.kw.some((k) => lower.includes(k.toLowerCase())));
  return { amount, catHint: hit?.id ?? 'other' };
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (payload: AddTxPayload) => Promise<void> | void;
  categories: ApiCategory[];
  defaultCurrency: string;
};

export function AddTransactionSheet({ visible, onClose, onSave, categories, defaultCurrency }: Props) {
  const { tok, lang, t, dir } = useI18n();

  const [amount, setAmount] = useState('0');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [catId, setCatId] = useState<string | null>(null);
  const [seshatMode, setSeshatMode] = useState(false);
  const [seshatText, setSeshatText] = useState('');
  const [saving, setSaving] = useState(false);

  // Filter categories to those usable for the current type.
  const filteredCats = useMemo(() => {
    return categories.filter((c) => !c.type || c.type === 'both' || c.type === type);
  }, [categories, type]);

  // Auto-pick first applicable category when sheet opens or type flips.
  useEffect(() => {
    if (!catId && filteredCats.length) setCatId(filteredCats[0]._id);
    if (catId && !filteredCats.find((c) => c._id === catId) && filteredCats.length) {
      setCatId(filteredCats[0]._id);
    }
  }, [filteredCats]);

  // Reset on close
  useEffect(() => {
    if (!visible) {
      setAmount('0'); setType('expense'); setSeshatMode(false); setSeshatText('');
      setCatId(null); setSaving(false);
    }
  }, [visible]);

  // Live-parse Seshat text and apply detected amount + matching category.
  useEffect(() => {
    if (!seshatMode) return;
    const parsed = parseNL(seshatText);
    if (parsed) {
      setAmount(String(parsed.amount));
      // map hint to a real backend category
      const target = filteredCats.find((c) => catIdFromName(c.nameEn) === parsed.catHint);
      if (target) setCatId(target._id);
    }
  }, [seshatText, seshatMode]);

  const numericAmount = parseFloat(amount) || 0;
  const canSave = numericAmount > 0 && !!catId && !saving;

  const press = (k: string) => {
    setAmount((prev) => {
      if (k === '⌫') return prev.length <= 1 ? '0' : prev.slice(0, -1);
      if (k === '.') return prev.includes('.') ? prev : prev + '.';
      if (prev === '0') return k;
      return prev + k;
    });
  };

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        type,
        amount: numericAmount,
        currency: defaultCurrency,
        categoryId: catId!,
        description: seshatMode && seshatText.trim() ? seshatText.trim() : undefined,
        date: new Date().toISOString().slice(0, 10),
      });
    } finally {
      setSaving(false);
    }
  };

  // Animation for slide-up
  const translate = useRef(new Animated.Value(800)).current;
  const overlay = useRef(new Animated.Value(0)).current;
  const kbHeight = useKeyboardHeight();
  const insets = useSafeAreaInsets();
  const recorder = useRecorder();
  const [transcribing, setTranscribing] = useState(false);

  // Voice → text: stop the recording, upload the audio to /voice/transcribe,
  // then drop the transcript into the seshatText field so the existing live
  // parser detects the amount + category.
  const sendSheetVoice = async () => {
    const r = await recorder.stop();
    if (!r) return;
    setTranscribing(true);
    try {
      const res = await apiFetch<{ data: { transcript: string } }>('/voice/transcribe', {
        method: 'POST',
        body: JSON.stringify({ audio_base64: r.base64, format: r.format, language: lang }),
      });
      if (res.data.transcript) setSeshatText(res.data.transcript);
    } catch (err) {
      console.warn('[sheet voice] transcribe failed', err);
    } finally {
      setTranscribing(false);
    }
  };
  useEffect(() => {
    Animated.parallel([
      Animated.timing(translate, { toValue: visible ? 0 : 800, duration: 320, useNativeDriver: true }),
      Animated.timing(overlay, { toValue: visible ? 1 : 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  const selectedCat = filteredCats.find((c) => c._id === catId);
  const selectedCatId: CatId = catIdFromName(selectedCat?.nameEn);
  const detected = seshatMode && !!parseNL(seshatText);
  const amountColor = detected ? tok.gold : (type === 'expense' ? tok.bone : tok.posText);

  const saveLabel = canSave
    ? lang === 'ar'
      ? `${t('save')} — ${Math.abs(numericAmount).toLocaleString()} ${currencyLabel(defaultCurrency, lang)} · ${catLabel(selectedCat, lang)}`
      : `${t('save')} — ${Math.abs(numericAmount).toLocaleString()} ${currencyLabel(defaultCurrency, lang)} · ${catLabel(selectedCat, lang)}`
    : t('save');

  const chips = lang === 'ar'
    ? ['صرفت ٢٠٠ على أكل', 'أوبر ١٤٢', 'قهوة ٨٥']
    : ['spent 200 on food', 'uber 142', 'coffee 85'];

  // 4 rows × 3 cells. We render row-by-row instead of flex-wrap because RN's
  // flex-basis + grow combo on a wrap container makes the third cell drop to a
  // new line on narrower screens.
  const keyRows: string[][] = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', '⌫'],
  ];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <Animated.View
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', opacity: overlay }}
          pointerEvents={visible ? 'auto' : 'none'}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={{
            backgroundColor: tok.void,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            borderTopWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
            paddingBottom: 26,
            // Cap height to whatever's between the status bar and the keyboard.
            // Without this, when the keyboard pushes the sheet up the top edge
            // (with the × + back chevron) slides into the unsafe area and
            // becomes untappable.
            paddingTop: kbHeight > 0 ? insets.top : 0,
            marginBottom: kbHeight,
            transform: [{ translateY: translate }],
            maxHeight: '90%',
          }}
        >
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: tok.borderHi, opacity: 0.6 }} />
          </View>

          {/* Top bar */}
          <View style={{
            flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
            justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: 18, minHeight: 32, paddingVertical: 6,
          }}>
            {seshatMode ? (
              <Pressable onPress={() => setSeshatMode(false)} hitSlop={6} style={{
                flexDirection: lang === 'ar' ? 'row-reverse' : 'row', alignItems: 'center', gap: 6,
              }}>
                <ChevronLeft size={14} color={tok.muted} />
                <Text style={{
                  color: tok.muted, fontFamily: fontMono('regular'), fontSize: 10,
                  letterSpacing: 1.4, textTransform: 'uppercase',
                }}>{lang === 'ar' ? 'لوحة' : 'keypad'}</Text>
              </Pressable>
            ) : (
              <REyebrow>{t('addTransaction')}</REyebrow>
            )}
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={tok.muted} />
            </Pressable>
          </View>

          {/* Type toggle */}
          <View style={{ alignItems: 'center', paddingVertical: 6 }}>
            <RSegmented
              value={type}
              onChange={setType as any}
              options={[
                { value: 'expense', label: t('expense') },
                { value: 'income', label: t('earned') },
              ]}
            />
          </View>

          {/* Amount display */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6,
            position: 'relative',
          }}>
            {!seshatMode && (
              <Pressable
                onPress={() => setSeshatMode(true)}
                style={({ pressed }) => ({
                  position: 'absolute', left: 20, top: '50%', marginTop: -19,
                  borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border, borderRadius: 10,
                  width: 38, height: 38, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: pressed ? tok.surface : 'transparent',
                  zIndex: 10,
                })}
                accessibilityLabel="Talk to Seshat"
              >
                <Sparkles size={18} color={tok.gold} />
              </Pressable>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={{ color: tok.muted, fontFamily: fontMono('regular'), fontSize: 22, marginRight: 8 }}>
                {type === 'expense' ? '−' : '+'}
              </Text>
              <Text style={{ color: amountColor, fontFamily: fontMono('medium'), fontSize: 58, letterSpacing: -1.5, writingDirection: 'ltr' }}>
                {amount}
              </Text>
              <Text style={{ color: tok.muted, fontFamily: fontMono('regular'), fontSize: 18, marginLeft: 8 }}>
                {currencyLabel(defaultCurrency, lang)}
              </Text>
            </View>
          </View>

          {/* Detected eyebrow */}
          <View style={{ height: 16, alignItems: 'center', justifyContent: 'center' }}>
            {detected && (
              <REyebrow color={tok.gold}>{t('detected')} · {catLabel(selectedCat, lang)}</REyebrow>
            )}
          </View>

          {/* Category icon row — fixed height + flexShrink:0 so a horizontal
              ScrollView inside a flex column doesn't stretch vertically */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, flexShrink: 0, height: 74 }}
            contentContainerStyle={{ gap: 10, paddingHorizontal: 20, paddingVertical: 6, alignItems: 'center' }}
          >
            {filteredCats.map((c) => {
              const a = c._id === catId;
              const id = catIdFromName(c.nameEn);
              const label = catLabel(c, lang);
              return (
                <Pressable
                  key={c._id}
                  onPress={() => setCatId(c._id)}
                  style={{ alignItems: 'center', gap: 5, paddingHorizontal: 2 }}
                >
                  <View style={{
                    width: 44, height: 44, borderRadius: 12,
                    backgroundColor: a ? tok.gold : tok.surface,
                    borderWidth: 1, borderColor: a ? tok.gold : tok.border,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CategoryIcon cat={id} size={22} color={a ? '#0D0D0D' : tok.bone} />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{
                      maxWidth: 60,
                      color: a ? tok.gold : tok.muted,
                      fontFamily: fontMono('regular'), fontSize: 9,
                      letterSpacing: lang === 'ar' ? 0 : 1,
                      textTransform: lang === 'ar' ? 'none' : 'uppercase',
                    }}
                  >{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Body — keypad mode reserves 300px for the 4-row grid; Seshat
              mode uses natural height so the input sits above the system
              keyboard without being clipped. */}
          {!seshatMode ? (
            <View style={{ height: 300, paddingHorizontal: 16, paddingTop: 8 }}>
              <View style={{ flex: 1, gap: 8 }}>
                {keyRows.map((row, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 8, flex: 1 }}>
                    {row.map((k) => (
                      <Pressable
                        key={k}
                        onPress={() => press(k)}
                        style={({ pressed }) => ({
                          flex: 1,
                          borderRadius: 14,
                          backgroundColor: pressed ? tok.elevated : tok.surface,
                          borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
                          alignItems: 'center', justifyContent: 'center',
                        })}
                      >
                        {k === '⌫' ? (
                          <Delete size={20} color={tok.bone} />
                        ) : (
                          <Text style={{ color: tok.bone, fontFamily: fontMono('regular'), fontSize: 24 }}>{k}</Text>
                        )}
                      </Pressable>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
              <Text style={{
                fontFamily: fontHead(lang),
                fontSize: lang === 'ar' ? 18 : 17, color: tok.bone,
                letterSpacing: lang === 'ar' ? 0 : -0.3,
                textAlign: lang === 'ar' ? 'right' : 'left',
                marginTop: 4,
              }}>{t('seshatPrompt')}</Text>
              <REyebrow style={{ marginTop: 6, textAlign: lang === 'ar' ? 'right' : 'left' }}>
                {t('seshatExample')}
              </REyebrow>

              <ScrollView
                horizontal showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0, flexShrink: 0, height: 50, marginTop: 14 }}
                contentContainerStyle={{ gap: 8, alignItems: 'center' }}
              >
                {chips.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setSeshatText(c)}
                    style={({ pressed }) => ({
                      backgroundColor: pressed ? tok.elevated : tok.surface,
                      borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
                      borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7,
                    })}
                  >
                    <Text style={{ color: tok.bone, fontFamily: fontBody(lang), fontSize: 12 }}>{c}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={{
                marginTop: 12,
                backgroundColor: tok.surface,
                borderRadius: 14, padding: 8, paddingLeft: 14,
                borderWidth: 1, borderColor: detected ? tok.gold : tok.border,
                flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                alignItems: 'center', gap: 10,
              }}>
                <TextInput
                  value={seshatText}
                  onChangeText={setSeshatText}
                  placeholder={t('seshatPlaceholder')}
                  placeholderTextColor={tok.muted}
                  autoFocus
                  style={{
                    flex: 1, color: tok.bone, fontFamily: fontBody(lang), fontSize: 14,
                    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
                    writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
                    textAlign: lang === 'ar' ? 'right' : 'left',
                  }}
                />
                <Pressable
                  onPressIn={() => recorder.start()}
                  onPressOut={() => { if (recorder.isRecording) sendSheetVoice(); }}
                  disabled={transcribing}
                  style={{
                    backgroundColor: recorder.isRecording ? '#3A1A1A' : tok.elevated,
                    borderRadius: 10,
                    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
                    opacity: transcribing ? 0.5 : 1,
                  }}
                  accessibilityLabel="Hold to record"
                >
                  <Mic size={16} color={recorder.isRecording ? '#E05555' : tok.muted} strokeWidth={recorder.isRecording ? 2 : 1.5} />
                </Pressable>
              </View>
            </View>
          )}

          {/* Save */}
          <View style={{ paddingHorizontal: 18, paddingTop: 10, backgroundColor: tok.void }}>
            <RButton full onPress={submit} disabled={!canSave}>{saveLabel}</RButton>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
