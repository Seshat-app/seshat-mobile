import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import { ChevronLeft, Trash2, Plus, Sparkles, Check } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { apiFetch, newIdempotencyKey } from '../lib/api';
import { radius as r } from '../lib/theme';
import { parseNLMany, type ApiCategory } from './AddTransactionSheet';
import { catIdFromName } from '../lib/categoryMap';

/**
 * "Add by Seshat" - the BATCH ENTRY surface.
 *
 * REWRITTEN from the previous chat-style version. The chat hid the work:
 * the user couldn't see what was about to be saved. The agent confirmed
 * "logged 5 entries" but the user had no way to review or correct
 * individual rows before commit.
 *
 * New flow:
 *   1. Panel opens with initialText (the voice transcript or typed input)
 *   2. parseNLMany() splits the text into one DraftEntry per detected
 *      amount, picks a category guess for each from the parser hint, and
 *      seeds the rows in state
 *   3. User sees their input as a quote at top + every parsed row below
 *   4. Each row is fully editable: amount, type (expense/income),
 *      category (horizontal picker), delete X
 *   5. User can add an empty row via "+ Add"
 *   6. "Save all (N)" footer button POSTs each row to /transactions
 *      sequentially with fresh idempotency keys, shows live progress
 *      (Saving 3/5), dismisses on success
 *
 * No AI call. The parser is fast + deterministic; doing this server-side
 * via the agent would be slower and less predictable. This panel is for
 * BATCH commit; the Seshat chat tab is for conversation.
 */

type Props = {
  visible: boolean;
  initialText: string;
  categories: ApiCategory[];
  defaultCurrency: string;
  onClose: () => void;
  // Fires when at least one transaction has been saved. The parent sheet
  // uses this to bump its data version + dismiss to a success toast.
  onLoggedSomething?: () => void;
};

type DraftEntry = {
  // Stable local id so deletes don't reshuffle React keys.
  key: string;
  amount: number;
  description: string;
  categoryId: string | null;
  type: 'expense' | 'income';
};

let entryKeyCounter = 0;
const nextKey = () => `e_${++entryKeyCounter}`;

export function AddBySeshatPanel({
  visible,
  initialText,
  categories,
  defaultCurrency,
  onClose,
  onLoggedSomething,
}: Props) {
  const { tok, lang } = useI18n();

  const [entries, setEntries] = useState<DraftEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill: parse the initial text into entries the moment the panel
  // becomes visible. Reset on close so re-opening with different text
  // starts fresh. The parsing is CLIENT-SIDE — no network round trip.
  useEffect(() => {
    if (!visible) {
      setEntries([]);
      setSavedCount(0);
      setError(null);
      setSaving(false);
      return;
    }
    if (!initialText.trim()) return;
    const parsed = parseNLMany(initialText);
    // Map each parsed { amount, catHint, snippet } into a real DraftEntry
    // with a real categoryId from the user's ledger. catIdFromName turns
    // a parser hint (e.g. 'food') back into a Category lookup.
    const drafts: DraftEntry[] = parsed.map((p) => {
      const targetCat = categories.find((c) => catIdFromName(c.nameEn) === p.catHint);
      return {
        key: nextKey(),
        amount: p.amount,
        description: p.snippet || '',
        categoryId: targetCat?._id ?? categories[0]?._id ?? null,
        type: 'expense',
      };
    });
    setEntries(drafts);
  }, [visible, initialText, categories]);

  // ── Mutations ─────────────────────────────────────────────────────
  const updateEntry = (key: string, patch: Partial<DraftEntry>) => {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  };
  const removeEntry = (key: string) => {
    setEntries((prev) => prev.filter((e) => e.key !== key));
  };
  const addEmpty = () => {
    setEntries((prev) => [
      ...prev,
      {
        key: nextKey(),
        amount: 0,
        description: '',
        categoryId: categories[0]?._id ?? null,
        type: 'expense',
      },
    ]);
  };

  // ── Save all ──────────────────────────────────────────────────────
  const validEntries = useMemo(
    () => entries.filter((e) => e.amount > 0 && !!e.categoryId),
    [entries],
  );
  const canSave = validEntries.length > 0 && !saving;

  const handleSaveAll = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setSavedCount(0);
    let succeeded = 0;
    for (const e of validEntries) {
      try {
        await apiFetch('/transactions', {
          method: 'POST',
          body: JSON.stringify({
            type: e.type,
            amount: e.amount,
            currency: defaultCurrency,
            categoryId: e.categoryId,
            description: e.description.trim() || undefined,
            date: new Date().toISOString().slice(0, 10),
            source: 'seshat',
          }),
          idempotencyKey: newIdempotencyKey(),
        });
        succeeded++;
        setSavedCount(succeeded);
      } catch (err) {
        console.warn('[AddBySeshat] save failed for one row, continuing', err);
        // Continue on per-row failure: we'd rather save what we can than
        // bail on the first error and lose the user's other entries.
      }
    }
    setSaving(false);
    if (succeeded > 0) {
      onLoggedSomething?.();
      setTimeout(() => onClose(), 700);
    } else {
      setError(lang === 'ar' ? 'تعذّر الحفظ. حاول مرة تانية.' : 'Could not save. Try again.');
    }
  };

  if (!visible) return null;

  return (
    <View
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: tok.void,
      }}
    >
      {/* Header */}
      <View style={{
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 18, paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tok.border,
      }}>
        <Pressable onPress={onClose} hitSlop={6} disabled={saving} style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row', alignItems: 'center', gap: 6,
          opacity: saving ? 0.5 : 1,
        }}>
          <ChevronLeft size={16} color={tok.muted} />
          <Text style={{
            color: tok.muted, fontFamily: fontMono('regular'), fontSize: 10,
            letterSpacing: 1.4, textTransform: 'uppercase',
          }}>{lang === 'ar' ? 'لوحة' : 'keypad'}</Text>
        </Pressable>

        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
        }}>
          <Sparkles size={12} color={tok.gold} />
          <Text style={{
            color: tok.gold, fontFamily: fontMono('regular'),
            fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase',
          }}>
            {lang === 'ar' ? 'إضافة بسيشات' : 'Add by Seshat'}
          </Text>
        </View>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 18, gap: 16, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* User's input as a quote at the top */}
        <View style={{
          backgroundColor: tok.surface,
          borderLeftWidth: 2, borderLeftColor: tok.gold,
          paddingVertical: 12, paddingHorizontal: 16,
          borderRadius: r.input,
        }}>
          <Text style={{
            color: tok.muted, fontFamily: fontMono('regular'),
            fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase',
            marginBottom: 6,
          }}>
            {lang === 'ar' ? 'كلامك' : 'You said'}
          </Text>
          <Text style={{
            color: tok.bone, fontFamily: fontBody(lang), fontSize: 14, lineHeight: 20,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>{initialText}</Text>
        </View>

        {/* Section title for the parsed list */}
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          alignItems: 'center', justifyContent: 'space-between',
          marginTop: 4,
        }}>
          <Text style={{
            color: tok.muted, fontFamily: fontMono('regular'),
            fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase',
          }}>
            {lang === 'ar'
              ? `${entries.length} ${entries.length === 1 ? 'عملية' : 'عمليات'}`
              : `${entries.length} ${entries.length === 1 ? 'transaction' : 'transactions'}`}
          </Text>
          <Pressable
            onPress={addEmpty}
            disabled={saving}
            hitSlop={6}
            style={{
              flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
              alignItems: 'center', gap: 4,
              opacity: saving ? 0.4 : 1,
            }}
          >
            <Plus size={12} color={tok.gold} />
            <Text style={{
              color: tok.gold, fontFamily: fontMono('regular'),
              fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase',
            }}>{lang === 'ar' ? 'إضافة' : 'Add'}</Text>
          </Pressable>
        </View>

        {/* Editable transaction rows */}
        {entries.length === 0 ? (
          <View style={{ paddingVertical: 24, alignItems: 'center', gap: 8 }}>
            <Text style={{
              color: tok.muted, fontFamily: fontBody(lang), fontSize: 13,
              textAlign: 'center',
            }}>
              {lang === 'ar' ? 'لم أرصد أرقامًا.' : "Couldn't find any amounts."}
            </Text>
            <Pressable onPress={addEmpty} style={{
              marginTop: 4,
              borderWidth: 1, borderColor: tok.border, borderRadius: r.pill,
              paddingHorizontal: 12, paddingVertical: 8,
            }}>
              <Text style={{
                color: tok.bone, fontFamily: fontMono('regular'),
                fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase',
              }}>{lang === 'ar' ? 'أضف يدويًا' : 'Add manually'}</Text>
            </Pressable>
          </View>
        ) : (
          entries.map((entry) => (
            <EntryRow
              key={entry.key}
              entry={entry}
              categories={categories}
              currency={defaultCurrency}
              disabled={saving}
              onChange={(patch) => updateEntry(entry.key, patch)}
              onRemove={() => removeEntry(entry.key)}
            />
          ))
        )}

        {error && (
          <View style={{
            backgroundColor: tok.alertBg,
            borderWidth: StyleSheet.hairlineWidth, borderColor: tok.alertText,
            borderRadius: r.input, paddingVertical: 10, paddingHorizontal: 14,
          }}>
            <Text style={{
              color: tok.alertText, fontFamily: fontBody(lang), fontSize: 13,
              textAlign: lang === 'ar' ? 'right' : 'left',
            }}>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* Save All footer */}
      <View style={{
        position: 'absolute', bottom: 26, left: 18, right: 18,
        gap: 6,
      }}>
        <Pressable
          onPress={handleSaveAll}
          disabled={!canSave}
          style={({ pressed }) => ({
            backgroundColor: canSave ? tok.gold : tok.surface,
            borderRadius: r.card, paddingVertical: 14,
            alignItems: 'center',
            flexDirection: 'row', justifyContent: 'center', gap: 8,
            borderWidth: 1, borderColor: canSave ? tok.gold : tok.border,
            opacity: !canSave ? 0.6 : pressed ? 0.85 : 1,
          })}
        >
          {saving ? (
            <>
              <ActivityIndicator size="small" color="#0D0D0D" />
              <Text style={{
                color: '#0D0D0D', fontFamily: fontHead(lang),
                fontSize: 14, letterSpacing: 0.4,
              }}>
                {lang === 'ar'
                  ? `يحفظ... ${savedCount}/${validEntries.length}`
                  : `Saving ${savedCount}/${validEntries.length}`}
              </Text>
            </>
          ) : (
            <>
              {canSave && <Check size={16} color="#0D0D0D" strokeWidth={2.4} />}
              <Text style={{
                color: canSave ? '#0D0D0D' : tok.muted,
                fontFamily: fontHead(lang),
                fontSize: 14, letterSpacing: 0.4,
              }}>
                {lang === 'ar'
                  ? `حفظ ${validEntries.length}`
                  : `Save all (${validEntries.length})`}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

/* ── Single editable transaction row ──────────────────────────────── */

function EntryRow({
  entry, categories, currency, disabled, onChange, onRemove,
}: {
  entry: DraftEntry;
  categories: ApiCategory[];
  currency: string;
  disabled: boolean;
  onChange: (patch: Partial<DraftEntry>) => void;
  onRemove: () => void;
}) {
  const { tok, lang } = useI18n();
  // Filter to the right category set for the chosen type
  const eligibleCats = useMemo(
    () => categories.filter((c) => !c.type || c.type === 'both' || c.type === entry.type),
    [categories, entry.type],
  );
  const currentCat = categories.find((c) => c._id === entry.categoryId);

  return (
    <View style={{
      backgroundColor: tok.surface,
      borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
      borderRadius: r.card, padding: 12, gap: 10,
      opacity: disabled ? 0.7 : 1,
    }}>
      {/* Top row: type toggle + amount + currency + delete */}
      <View style={{
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', gap: 10,
      }}>
        <Pressable
          onPress={() => onChange({ type: entry.type === 'expense' ? 'income' : 'expense' })}
          disabled={disabled}
          style={{
            paddingHorizontal: 10, paddingVertical: 6,
            borderRadius: r.pill,
            backgroundColor: entry.type === 'expense' ? tok.alertBg : tok.posBg,
            borderWidth: 1, borderColor: entry.type === 'expense' ? tok.alertText : tok.posText,
          }}
        >
          <Text style={{
            color: entry.type === 'expense' ? tok.alertText : tok.posText,
            fontFamily: fontMono('regular'), fontSize: 10,
            letterSpacing: 1.2, textTransform: 'uppercase',
          }}>
            {entry.type === 'expense'
              ? (lang === 'ar' ? 'صرف' : '−')
              : (lang === 'ar' ? 'دخل' : '+')}
          </Text>
        </Pressable>

        <TextInput
          value={entry.amount > 0 ? String(entry.amount) : ''}
          onChangeText={(t) => {
            const n = parseFloat(t.replace(/[^0-9.]/g, ''));
            onChange({ amount: isNaN(n) ? 0 : n });
          }}
          keyboardType="decimal-pad"
          editable={!disabled}
          placeholder="0"
          placeholderTextColor={tok.muted}
          style={{
            flex: 1,
            color: tok.bone, fontFamily: fontMono('medium'),
            fontSize: 22, letterSpacing: -0.5,
            textAlign: lang === 'ar' ? 'right' : 'left',
            paddingVertical: 4,
          }}
        />
        <Text style={{
          color: tok.muted, fontFamily: fontMono('regular'), fontSize: 13,
        }}>{currency}</Text>
        <Pressable onPress={onRemove} disabled={disabled} hitSlop={6} style={{ padding: 4 }}>
          <Trash2 size={16} color={tok.muted} strokeWidth={1.6} />
        </Pressable>
      </View>

      {/* Category picker - horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
      >
        {eligibleCats.map((c) => {
          const active = c._id === entry.categoryId;
          return (
            <Pressable
              key={c._id}
              onPress={() => onChange({ categoryId: c._id })}
              disabled={disabled}
              style={{
                paddingHorizontal: 10, paddingVertical: 6,
                borderRadius: r.pill,
                backgroundColor: active ? tok.gold : 'transparent',
                borderWidth: 1, borderColor: active ? tok.gold : tok.border,
              }}
            >
              <Text style={{
                color: active ? '#0D0D0D' : tok.bone,
                fontFamily: fontMono('regular'), fontSize: 10,
                letterSpacing: 1.2, textTransform: lang === 'ar' ? 'none' : 'uppercase',
              }}>
                {lang === 'ar' && c.nameAr ? c.nameAr : c.nameEn}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Parsed snippet shown muted (the actual fragment of input that became this row) */}
      {entry.description ? (
        <Text
          numberOfLines={1}
          style={{
            color: tok.muted, fontFamily: fontMono('regular'), fontSize: 10,
            letterSpacing: 0.4,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}
        >
          “{entry.description}”
        </Text>
      ) : null}

      {!currentCat && (
        <Text style={{
          color: tok.alertText, fontFamily: fontMono('regular'), fontSize: 10,
          letterSpacing: 1.2,
        }}>
          {lang === 'ar' ? 'اختر تصنيفًا' : 'pick a category'}
        </Text>
      )}
    </View>
  );
}
