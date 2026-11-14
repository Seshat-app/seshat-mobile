import { useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator, Modal, Alert } from 'react-native';
import { ScrollView as ScreenScroll } from '../components/Scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BellOff, BellRing } from 'lucide-react-native';
import { CategoryIconByKey } from '../components/icons';
import { PlanScreen } from '../components/PlanShell';
import { RCard, REyebrow, RStatus, RButton, RField } from '../components/ui';
import { useWorkspace } from '../lib/appData';
import { useI18n, formatAmount } from '../lib/i18n';
import { listReminders, updateReminder, addSharedBill, type Reminder } from '../lib/reminders';
import { useFetchList } from '../lib/hooks/useFetchList';
import { fontBody, fontMono } from '../lib/fonts';
import { radius } from '../lib/theme';

/** English ordinal suffix: 1→1st, 2→2nd, 3→3rd, else n+th */
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export default function BillRemindersScreen() {
  const { tok, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const { items, setItems, loading, refreshing, load } = useFetchList<Reminder>(
    () => listReminders(),
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const ws = useWorkspace();
  const ar = lang === 'ar';
  const [adding, setAdding] = useState(false);
  const [bName, setBName] = useState('');
  const [bAmount, setBAmount] = useState('');
  const [bDay, setBDay] = useState('');
  const [bBusy, setBBusy] = useState(false);
  const saveBill = async () => {
    setBBusy(true);
    try {
      await addSharedBill({ name: bName.trim(), amount: Number(bAmount.replace(/[^\d.]/g, '')) || 0, dayOfMonth: Number(bDay) });
      setAdding(false); setBName(''); setBAmount(''); setBDay(''); await load('refresh');
    } catch (e) { Alert.alert(ar ? 'تعذّر' : 'Could not add', e instanceof Error ? e.message : String(e)); }
    finally { setBBusy(false); }
  };

  const handleAction = async (id: string, status: string) => {
    setBusyId(id);
    try {
      await updateReminder(id, { status });
      await load('refresh');
    } catch (err) {
      console.warn('updateReminder failed', err);
    } finally {
      setBusyId(null);
    }
  };

  const suggested = items.filter((r) => r.status === 'suggested');
  const active = items.filter((r) => r.status === 'active' || r.status === 'off');

  return (
    <PlanScreen
      title={ws.inOrg ? (ar ? 'فواتير مشتركة' : 'Shared bills') : (lang === 'ar' ? 'التذكيرات' : 'Reminders')}
      subtitle={ws.inOrg ? (ar ? 'يُذكَّر بها كل البالغين' : 'Every adult is reminded') : (lang === 'ar' ? 'الفواتير التي تذكّرك بها سيشات' : 'Bills Seshat reminds you about')}
      onAdd={ws.inOrg && ws.canWrite && !ws.isChild ? () => setAdding(true) : undefined}
      refreshing={refreshing}
    >
      <ScreenScroll
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 96, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load('refresh')}
            tintColor={tok.gold}
            colors={[tok.gold]}
            progressBackgroundColor={tok.surface}
          />
        }
      >
        {loading ? (
          <RCard padding={18}>
            <ActivityIndicator color={tok.gold} />
          </RCard>
        ) : suggested.length === 0 && active.length === 0 ? (
          <EmptyState tok={tok} lang={lang} />
        ) : (
          <>
            {suggested.length > 0 && (
              <>
                <REyebrow
                  style={{
                    marginBottom: 10,
                    marginTop: 4,
                    textAlign: lang === 'ar' ? 'right' : 'left',
                  }}
                >
                  {lang === 'ar' ? 'مقترحة' : 'Suggested'}
                </REyebrow>
                <RCard padding={0} style={{ paddingHorizontal: 16, paddingVertical: 4, marginBottom: 16 }}>
                  {suggested.map((r, i) => (
                    <View
                      key={r.id}
                      style={{
                        paddingVertical: 16,
                        borderBottomWidth: i === suggested.length - 1 ? 0 : 1,
                        borderBottomColor: tok.border,
                      }}
                    >
                      {/* Name + amount row */}
                      <View
                        style={{
                          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 4,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: fontBody(lang),
                            fontSize: 15,
                            color: tok.bone,
                            textAlign: lang === 'ar' ? 'right' : 'left',
                            writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
                            flexShrink: 1,
                          }}
                        >
                          {r.name}
                        </Text>
                        <Text
                          style={{
                            fontFamily: fontMono('medium'),
                            fontSize: 14,
                            color: tok.gold,
                            writingDirection: 'ltr',
                            marginLeft: lang === 'ar' ? 0 : 8,
                            marginRight: lang === 'ar' ? 8 : 0,
                          }}
                        >
                          {formatAmount(r.amount, { decimals: 0 })} {r.currency}
                        </Text>
                      </View>
                      {/* Day hint */}
                      <Text
                        style={{
                          fontFamily: fontBody(lang),
                          fontSize: 12,
                          color: tok.muted,
                          textAlign: lang === 'ar' ? 'right' : 'left',
                          writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
                          marginBottom: 12,
                        }}
                      >
                        {lang === 'ar'
                          ? `≈ اليوم ${r.dayOfMonth} من الشهر`
                          : `≈ day ${r.dayOfMonth} of the month`}
                      </Text>
                      {/* Actions */}
                      <View
                        style={{
                          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                          gap: 8,
                        }}
                      >
                        <RButton
                          variant="primary"
                          onPress={() => handleAction(r.id, 'active')}
                          loading={busyId === r.id}
                          disabled={busyId !== null}
                        >
                          {lang === 'ar' ? 'ذكّرني' : 'Remind me'}
                        </RButton>
                        <RButton
                          variant="secondary"
                          onPress={() => handleAction(r.id, 'dismissed')}
                          loading={false}
                          disabled={busyId !== null}
                        >
                          {lang === 'ar' ? 'تجاهل' : 'Dismiss'}
                        </RButton>
                      </View>
                    </View>
                  ))}
                </RCard>
              </>
            )}

            {active.length > 0 && (
              <>
                <REyebrow
                  style={{
                    marginBottom: 10,
                    marginTop: suggested.length > 0 ? 4 : 4,
                    textAlign: lang === 'ar' ? 'right' : 'left',
                  }}
                >
                  {lang === 'ar' ? 'نشطة' : 'Active'}
                </REyebrow>
                <RCard padding={0} style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
                  {active.map((r, i) => {
                    const isOff = r.status === 'off';
                    return (
                      <View
                        key={r.id}
                        style={{
                          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                          alignItems: 'center',
                          paddingVertical: 14,
                          borderBottomWidth: i === active.length - 1 ? 0 : 1,
                          borderBottomColor: tok.border,
                          gap: 12,
                        }}
                      >
                        {/* Icon */}
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: radius.input,
                            backgroundColor: tok.elevated,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <CategoryIconByKey iconKey="bill" size={18} color={tok.bone} />
                        </View>
                        {/* Text */}
                        <View style={{ flex: 1 }}>
                          <View
                            style={{
                              flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            <Text
                              style={{
                                fontFamily: fontBody(lang),
                                fontSize: 15,
                                color: isOff ? tok.muted : tok.bone,
                                textAlign: lang === 'ar' ? 'right' : 'left',
                                writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
                                textDecorationLine: isOff ? 'line-through' : 'none',
                                flexShrink: 1,
                              }}
                            >
                              {r.name}
                            </Text>
                            {isOff && (
                              <RStatus kind="draft">
                                {lang === 'ar' ? 'متوقف' : 'Off'}
                              </RStatus>
                            )}
                          </View>
                          <Text
                            style={{
                              fontFamily: fontBody(lang),
                              fontSize: 11,
                              color: tok.muted,
                              marginTop: 2,
                              textAlign: lang === 'ar' ? 'right' : 'left',
                              writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
                            }}
                          >
                            {lang === 'ar'
                              ? `يذكّرك قبل ${r.leadDays} أيام من اليوم ${r.dayOfMonth}`
                              : `Reminds you ${r.leadDays} days before the ${ordinal(r.dayOfMonth)}`}
                          </Text>
                        </View>
                        {/* Bell toggle */}
                        <Pressable
                          onPress={() => handleAction(r.id, isOff ? 'active' : 'off')}
                          disabled={busyId === r.id}
                          hitSlop={10}
                          style={({ pressed }) => ({
                            width: 38,
                            height: 38,
                            borderRadius: radius.input,
                            backgroundColor: pressed ? tok.surface : tok.elevated,
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: busyId === r.id ? 0.4 : 1,
                          })}
                        >
                          {isOff
                            ? <BellOff size={18} color={tok.muted} />
                            : <BellRing size={18} color={tok.gold} />}
                        </Pressable>
                      </View>
                    );
                  })}
                </RCard>
              </>
            )}
          </>
        )}
      </ScreenScroll>
      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={() => setAdding(false)} />
        <View style={{ backgroundColor: tok.void, borderTopLeftRadius: radius.modal, borderTopRightRadius: radius.modal, padding: 20, paddingBottom: insets.bottom + 16, borderTopWidth: 1, borderColor: tok.border, gap: 12 }}>
          <Text style={{ fontFamily: fontBody(lang, 'semibold'), fontSize: 18, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{ar ? 'فاتورة جديدة' : 'New bill'}</Text>
          <RField label={ar ? 'الاسم' : 'NAME'} value={bName} onChange={setBName} placeholder={ar ? 'مثلاً: الكهرباء' : 'e.g. Electricity'} maxLength={60} />
          <RField label={ar ? 'المبلغ (اختياري)' : 'AMOUNT (OPTIONAL)'} value={bAmount} onChange={setBAmount} keyboardType="numeric" mono ltr placeholder="0" />
          <RField label={ar ? 'يوم الشهر' : 'DAY OF THE MONTH'} value={bDay} onChange={setBDay} keyboardType="numeric" mono ltr placeholder="15" maxLength={2} />
          <RButton full onPress={saveBill} loading={bBusy} disabled={bBusy || !bName.trim() || !(Number(bDay) >= 1 && Number(bDay) <= 31)}>{ar ? 'حفظ' : 'Save'}</RButton>
        </View>
      </Modal>
    </PlanScreen>
  );
}

function EmptyState({ tok, lang }: { tok: any; lang: 'en' | 'ar' }) {
  return (
    <RCard padding={20}>
      <Text
        style={{
          fontFamily: fontBody(lang),
          fontSize: 14.5,
          lineHeight: 21,
          color: tok.muted,
          textAlign: 'center',
        }}
      >
        {lang === 'ar'
          ? 'لا توجد فواتير بعد. عندما ترصد سيشات فاتورة متكررة ستسألك هنا.'
          : "When Seshat spots a recurring bill, it'll ask you in chat and list it here."}
      </Text>
    </RCard>
  );
}
