import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput, StyleSheet, Animated,
  Platform, Modal, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, X, Sparkles, Mic, Delete, Receipt, NotebookPen, Repeat, Zap, Camera, Image as ImageIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useI18n, currencyLabel } from '../lib/i18n';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { RSegmented, RButton, REyebrow } from './ui';
import { CategoryIcon, CatIconAlias } from './icons';
import { catIdFromName, catLabel, type CatId } from '../lib/categoryMap';
import { useKeyboardHeight } from './useKeyboardHeight';
import { useRecorder } from './useRecorder';
import { apiFetch, newIdempotencyKey } from '../lib/api';
import { uploadReceipt } from '../lib/cloudinary';

export type ApiCategory = { _id: string; nameEn: string; nameAr?: string; emoji?: string; type?: 'income' | 'expense' | 'both' };

// Subset of the ApiProject shape we need at the picker level. Kept loose
// so callers can pass either the full appData type or a lite version.
export type SheetProject = { _id: string; name: string; color?: string };

export type AddTxPayload = {
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  categoryId: string;
  // Optional project tag. Org-only; never set on a personal ledger.
  projectId?: string;
  description?: string;
  notes?: string;
  date: string; // YYYY-MM-DD
  // Only meaningful on type=income. Marks this entry as part of the user's
  // recurring monthly baseline (salary, regular freelance retainer, etc.).
  isMonthlyBaseline?: boolean;
  // Where this entry came from. The mobile app passes 'manual' for
  // user-typed entries, 'voice' for transcription, 'notification' when the
  // sheet was opened from a bank-SMS capture, 'receipt-ocr' from the
  // scan-receipt flow.
  source?: 'manual' | 'voice' | 'notification' | 'receipt-ocr';
};

// Pre-seed values when the sheet is opened from an external trigger
// (notification capture, receipt OCR, deep link). Any field left undefined
// falls back to the sheet's normal default behavior.
export type AddTxPrefill = {
  type?: 'income' | 'expense';
  amount?: number;
  categoryId?: string;
  projectId?: string;
  description?: string;
  notes?: string;
  isMonthlyBaseline?: boolean;
  source?: 'manual' | 'voice' | 'notification' | 'receipt-ocr';
  // Free-text label shown in a small banner at the top of the sheet so the
  // user can tell why fields are pre-filled (e.g. "Detected from CIB SMS").
  detectionBanner?: string;
  // When true, the sheet auto-fires the scan-receipt flow on open. Used by
  // the FAB's "Scan a receipt" path so the user lands directly in the
  // camera-or-library prompt without an extra tap inside the sheet.
  autoTriggerScan?: boolean;
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
  // Optional list of active projects in the current workspace. When
  // non-empty, a horizontal chip row appears below the category strip
  // so the user can tag the entry to a project. Empty/undefined hides
  // the entire row (the personal-ledger case).
  projects?: SheetProject[];
  // Optional pre-fill for capture / receipt / deep-link flows.
  prefill?: AddTxPrefill;
};

export function AddTransactionSheet({ visible, onClose, onSave, categories, defaultCurrency, projects, prefill }: Props) {
  const { tok, lang, t, dir } = useI18n();

  const [amount, setAmount] = useState('0');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [catId, setCatId] = useState<string | null>(null);
  // null = "No project" (the "general overhead" bucket). undefined = the
  // initial unset state before the user opens the picker. We send null
  // through to the API as no projectId, and a real id when tagged.
  const [projectId, setProjectId] = useState<string | null>(null);
  const [seshatMode, setSeshatMode] = useState(false);
  const [seshatText, setSeshatText] = useState('');
  const [notes, setNotes] = useState('');
  const [isMonthlyBaseline, setIsMonthlyBaseline] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
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
      setCatId(null); setProjectId(null); setSaving(false);
      setNotes(''); setIsMonthlyBaseline(false); setShowNotes(false);
    }
  }, [visible]);

  // Apply external prefill (notification capture / receipt OCR / deep link)
  // when the sheet opens. Runs once per visible-transition so the user can
  // still edit and the changes stick.
  useEffect(() => {
    if (!visible || !prefill) return;
    if (prefill.type) setType(prefill.type);
    if (typeof prefill.amount === 'number' && prefill.amount > 0) setAmount(String(prefill.amount));
    if (prefill.categoryId) setCatId(prefill.categoryId);
    if (prefill.projectId) setProjectId(prefill.projectId);
    if (prefill.description) { setSeshatMode(true); setSeshatText(prefill.description); }
    if (prefill.notes) { setNotes(prefill.notes); setShowNotes(true); }
    if (prefill.isMonthlyBaseline) setIsMonthlyBaseline(true);
    // FAB -> "Scan a receipt" path: auto-fire the Camera/Library prompt
    // a beat after the sheet finishes animating in so the picker doesn't
    // collide with the entrance animation on iOS.
    if (prefill.autoTriggerScan) {
      const t = setTimeout(() => { scanReceipt(); }, 360);
      return () => clearTimeout(t);
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
        projectId: projectId ?? undefined,
        description: seshatMode && seshatText.trim() ? seshatText.trim() : undefined,
        notes: notes.trim() ? notes.trim() : undefined,
        date: new Date().toISOString().slice(0, 10),
        isMonthlyBaseline: type === 'income' ? isMonthlyBaseline : undefined,
        source: prefill?.source ?? 'manual',
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
  const [scanning, setScanning] = useState(false);

  // Receipt OCR. We split the source-picking from the actual scan so the
  // user can choose Camera or Library via a small prompt, then we always
  // run the same upload + OCR + apply-result pipeline.
  const scanReceiptFromUri = async (uri: string) => {
    setScanning(true);
    // Surface results in seshat mode so the parsed amount + description are
    // editable in one view.
    if (!seshatMode) setSeshatMode(true);
    try {
      const upload = await uploadReceipt(uri);
      const res = await apiFetch<{ data: { ok: boolean; reason?: string; amount?: number; vendor?: string; description?: string; suggestedCategoryId?: string } }>(
        '/transactions/scan-receipt',
        { method: 'POST', body: JSON.stringify({ imageUrl: upload.secureUrl }) },
      );
      const d = res.data;
      if (!d?.ok) {
        // Surface the reason rather than silently dropping the photo - the
        // user just spent a tap on it. Common reasons:
        // - NVIDIA_API_KEY not set on the server -> "OCR service not configured"
        // - Image isn't a receipt -> "Not a receipt"
        // - Model couldn't read the total -> "No amount detected"
        Alert.alert(
          lang === 'ar' ? 'لم يتم رصد الإيصال' : 'Could not read the receipt',
          d?.reason || (lang === 'ar'
            ? 'لم تتعرف سيشات على هذه الصورة كإيصال. حاول بصورة أوضح أو أدخل المعاملة يدوياً.'
            : 'Seshat couldn\'t recognize this image as a receipt. Try a clearer photo or add it manually.'),
        );
        return;
      }
      if (typeof d.amount === 'number') setAmount(String(d.amount));
      if (d.suggestedCategoryId && filteredCats.find((c) => c._id === d.suggestedCategoryId)) {
        setCatId(d.suggestedCategoryId);
      }
      const desc = [d.vendor, d.description].filter(Boolean).join(' · ').slice(0, 120);
      if (desc) setSeshatText(desc);
    } catch (err) {
      console.warn('[scan receipt] failed', err);
      Alert.alert(
        lang === 'ar' ? 'حدث خطأ' : 'Something went wrong',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setScanning(false);
    }
  };

  const pickReceiptFromLibrary = async () => {
    if (scanning) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        lang === 'ar' ? 'الصلاحية مرفوضة' : 'Permission needed',
        lang === 'ar' ? 'فعّل صلاحية الصور من إعدادات الجهاز.' : 'Enable photo permission in your device settings.',
      );
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });
    if (picked.canceled || !picked.assets?.[0]?.uri) return;
    await scanReceiptFromUri(picked.assets[0].uri);
  };

  const takeReceiptWithCamera = async () => {
    if (scanning) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        lang === 'ar' ? 'الصلاحية مرفوضة' : 'Permission needed',
        lang === 'ar' ? 'فعّل صلاحية الكاميرا من إعدادات الجهاز.' : 'Enable camera permission in your device settings.',
      );
      return;
    }
    const picked = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });
    if (picked.canceled || !picked.assets?.[0]?.uri) return;
    await scanReceiptFromUri(picked.assets[0].uri);
  };

  // Tapping the receipt icon offers the user a quick choice between camera
  // (snap the paper receipt right now) and library (something already in
  // Photos). Skips the prompt and goes straight to the action when only
  // one source makes sense.
  const scanReceipt = async () => {
    if (scanning) return;
    Alert.alert(
      lang === 'ar' ? 'إضافة إيصال' : 'Add a receipt',
      lang === 'ar' ? 'كيف تريد تصوير الإيصال؟' : 'Where is the receipt photo from?',
      [
        {
          text: lang === 'ar' ? 'الكاميرا' : 'Camera',
          onPress: takeReceiptWithCamera,
        },
        {
          text: lang === 'ar' ? 'الصور' : 'Photos',
          onPress: pickReceiptFromLibrary,
        },
        { text: lang === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
      ],
    );
  };

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

          {/* Detection banner - shown when sheet opened from notification capture / OCR. */}
          {prefill?.detectionBanner ? (
            <View style={{
              marginHorizontal: 18, marginTop: 6,
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
              backgroundColor: tok.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: tok.gold,
              flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
              alignItems: 'center', gap: 8,
            }}>
              <Zap size={14} color={tok.gold} />
              <Text style={{
                flex: 1, fontFamily: fontBody(lang), fontSize: 12, color: tok.bone,
                textAlign: lang === 'ar' ? 'right' : 'left',
              }} numberOfLines={2}>
                {prefill.detectionBanner}
              </Text>
            </View>
          ) : null}

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

          {/* Project chip row. Only rendered when the active workspace has
              at least one project — i.e., an organization ledger. Personal
              ledgers get this row hidden so the sheet stays compact. */}
          {projects && projects.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, flexShrink: 0, height: 38, marginBottom: 4 }}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 20, alignItems: 'center' }}
            >
              {/* "No project" sentinel — selected by default */}
              <Pressable
                onPress={() => setProjectId(null)}
                style={{
                  height: 28, paddingHorizontal: 12, borderRadius: 14,
                  borderWidth: 1,
                  borderColor: projectId === null ? tok.muted : tok.border,
                  backgroundColor: projectId === null ? tok.surface : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{
                  color: projectId === null ? tok.bone : tok.muted,
                  fontFamily: fontMono('regular'), fontSize: 10,
                  letterSpacing: lang === 'ar' ? 0 : 1.2,
                  textTransform: lang === 'ar' ? 'none' : 'uppercase',
                }}>
                  {lang === 'ar' ? 'بدون مشروع' : 'no project'}
                </Text>
              </Pressable>
              {projects.map((p) => {
                const a = projectId === p._id;
                return (
                  <Pressable
                    key={p._id}
                    onPress={() => setProjectId(p._id)}
                    style={{
                      height: 28, paddingHorizontal: 12, borderRadius: 14,
                      borderWidth: 1,
                      borderColor: a ? (p.color ?? tok.gold) : tok.border,
                      backgroundColor: a ? tok.surface : 'transparent',
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                    }}
                  >
                    {p.color ? (
                      <View style={{
                        width: 7, height: 7, borderRadius: 3.5,
                        backgroundColor: p.color,
                      }} />
                    ) : null}
                    <Text style={{
                      color: a ? tok.bone : tok.muted,
                      fontFamily: fontMono('regular'), fontSize: 10,
                      letterSpacing: lang === 'ar' ? 0 : 1.2,
                      textTransform: lang === 'ar' ? 'none' : 'uppercase',
                    }}>{p.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

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
                  onPress={scanReceipt}
                  disabled={scanning}
                  style={{
                    backgroundColor: tok.elevated,
                    borderRadius: 10,
                    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
                    opacity: scanning ? 0.5 : 1,
                  }}
                  accessibilityLabel="Scan receipt"
                >
                  <Receipt size={16} color={scanning ? tok.gold : tok.muted} strokeWidth={1.5} />
                </Pressable>
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

          {/* Details row: notes button + monthly baseline toggle (income only). */}
          <View style={{
            paddingHorizontal: 18, paddingTop: 10, paddingBottom: 4,
            flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
            alignItems: 'center', gap: 8,
          }}>
            <Pressable
              onPress={() => setShowNotes((v) => !v)}
              style={({ pressed }) => ({
                flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                alignItems: 'center', gap: 6,
                paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
                backgroundColor: pressed ? tok.elevated : tok.surface,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: notes.trim() || showNotes ? tok.gold : tok.border,
              })}
            >
              <NotebookPen size={14} color={notes.trim() ? tok.gold : tok.muted} />
              <Text style={{
                fontFamily: fontBody(lang), fontSize: 12,
                color: notes.trim() ? tok.bone : tok.muted,
              }}>
                {notes.trim()
                  ? (lang === 'ar' ? 'ملاحظة مضافة' : 'Note added')
                  : (lang === 'ar' ? 'إضافة ملاحظة' : 'Add note')}
              </Text>
            </Pressable>

            {type === 'income' && (
              <Pressable
                onPress={() => setIsMonthlyBaseline((v) => !v)}
                style={({ pressed }) => ({
                  flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                  alignItems: 'center', gap: 6,
                  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
                  backgroundColor: isMonthlyBaseline ? tok.gold : (pressed ? tok.elevated : tok.surface),
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: isMonthlyBaseline ? tok.gold : tok.border,
                })}
              >
                <Repeat size={14} color={isMonthlyBaseline ? tok.void : tok.muted} />
                <Text style={{
                  fontFamily: fontBody(lang), fontSize: 12,
                  color: isMonthlyBaseline ? tok.void : tok.muted,
                }}>
                  {lang === 'ar' ? 'دخل شهري ثابت' : 'Monthly baseline'}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Notes input field, slides out when toggled. */}
          {showNotes && (
            <View style={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 6 }}>
              <View style={{
                backgroundColor: tok.surface,
                borderRadius: 12, padding: 10,
                borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
              }}>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={lang === 'ar'
                    ? 'تفاصيل أو سياق لهذه المعاملة...'
                    : 'Details or context for this entry...'}
                  placeholderTextColor={tok.muted}
                  multiline
                  numberOfLines={3}
                  style={{
                    color: tok.bone, fontFamily: fontBody(lang), fontSize: 13,
                    minHeight: 56, textAlignVertical: 'top',
                    writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
                    textAlign: lang === 'ar' ? 'right' : 'left',
                  }}
                />
              </View>
            </View>
          )}

          {/* Save */}
          <View style={{ paddingHorizontal: 18, paddingTop: 6, backgroundColor: tok.void }}>
            <RButton full onPress={submit} disabled={!canSave}>{saveLabel}</RButton>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
