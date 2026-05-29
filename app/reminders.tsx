import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { BellOff, BellRing, Clock } from 'lucide-react-native';
import { PlanScreen } from '../components/PlanShell';
import { RCard, REyebrow } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { hasToken } from '../lib/api';
import { listHabits, muteHabit, unmuteHabit, type Habit } from '../lib/habits';
import { fontBody, fontMono } from '../lib/fonts';

/**
 * /reminders - the user-facing view of what Seshat has learned about their
 * patterns. Each row is a (category, hour) pair the dispatcher will nudge
 * for, with a mute toggle that snoozes the nudge for a week.
 *
 * The list is intentionally read-only otherwise: habits aren't created by
 * the user, they're detected from transaction history. If the user wants
 * to "add" a habit, they just keep logging consistently and the detector
 * picks it up overnight.
 */
export default function RemindersScreen() {
  const { tok, lang } = useI18n();
  const [items, setItems] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!(await hasToken())) return;
    if (mode === 'initial') setLoading(true); else setRefreshing(true);
    try {
      const data = await listHabits();
      setItems(data);
    } catch (err) {
      console.warn('listHabits failed', err);
    } finally {
      if (mode === 'initial') setLoading(false); else setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onToggleMute = async (h: Habit) => {
    setBusyId(h.id);
    try {
      if (h.mutedUntil && new Date(h.mutedUntil) > new Date()) {
        await unmuteHabit(h.id);
      } else {
        await muteHabit(h.id, 7);
      }
      await load('refresh');
    } catch (err) {
      console.warn('toggle mute failed', err);
    } finally {
      setBusyId(null);
    }
  };

  const formatHour = (h: number): string => {
    // 12h format with am/pm. Keep the math simple: 0=12am, 12=12pm.
    const am = h < 12;
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr}:00 ${am ? 'AM' : 'PM'}`;
  };

  return (
    <PlanScreen
      title={lang === 'ar' ? 'التذكيرات' : 'Reminders'}
      subtitle={lang === 'ar' ? 'العادات التي رصدتها سيشات' : 'Habits Seshat has noticed'}
      refreshing={refreshing}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 8 }}
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
        <RCard padding={16} style={{ marginBottom: 12 }}>
          <REyebrow style={{ marginBottom: 6, textAlign: lang === 'ar' ? 'right' : 'left' }}>
            {lang === 'ar' ? 'كيف يعمل' : 'How this works'}
          </REyebrow>
          <Text style={{
            fontFamily: fontBody(lang),
            fontSize: 13.5, lineHeight: 20, color: tok.muted,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>
            {lang === 'ar'
              ? 'عند تسجيل المعاملات بانتظام في وقت محدد، تتعلم سيشات هذا النمط وترسل لك تذكيراً لتسجيل المعاملة. يمكنك إيقاف أي تذكير في أي وقت.'
              : 'When you log transactions at the same time consistently, Seshat learns the pattern and reminds you so nothing slips through. You can mute any reminder for 7 days at any time.'}
          </Text>
        </RCard>

        {loading ? (
          <RCard padding={18}>
            <ActivityIndicator color={tok.gold} />
          </RCard>
        ) : items.length === 0 ? (
          <EmptyState tok={tok} lang={lang} />
        ) : (
          <RCard padding={0} style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
            {items.map((h, i) => {
              const muted = !!h.mutedUntil && new Date(h.mutedUntil) > new Date();
              const name = (lang === 'ar' ? h.categoryNameAr : h.categoryNameEn) ?? '—';
              return (
                <View
                  key={h.id}
                  style={{
                    flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    borderBottomWidth: i === items.length - 1 ? 0 : 1,
                    borderBottomColor: tok.border,
                    gap: 12,
                  }}
                >
                  <View style={{
                    width: 36, height: 36, borderRadius: 12,
                    backgroundColor: tok.surface,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 18 }}>{h.emoji ?? '🔔'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontFamily: fontBody(lang),
                      fontSize: 15, color: muted ? tok.muted : tok.bone,
                      textAlign: lang === 'ar' ? 'right' : 'left',
                      textDecorationLine: muted ? 'line-through' : 'none',
                    }}>
                      {name}
                    </Text>
                    <View style={{
                      flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                      alignItems: 'center', gap: 6, marginTop: 2,
                    }}>
                      <Clock size={12} color={tok.muted} />
                      <Text style={{
                        fontFamily: fontMono(),
                        fontSize: 11, color: tok.muted,
                      }}>
                        {formatHour(h.hour)}  ·  {h.occurrences}× {lang === 'ar' ? 'في آخر 14 يوم' : 'in last 14 days'}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => onToggleMute(h)}
                    disabled={busyId === h.id}
                    hitSlop={10}
                    style={({ pressed }) => ({
                      width: 38, height: 38, borderRadius: 12,
                      backgroundColor: pressed ? tok.elevated : tok.surface,
                      alignItems: 'center', justifyContent: 'center',
                      opacity: busyId === h.id ? 0.4 : 1,
                    })}
                  >
                    {muted
                      ? <BellOff size={18} color={tok.muted} />
                      : <BellRing size={18} color={tok.gold} />}
                  </Pressable>
                </View>
              );
            })}
          </RCard>
        )}
      </ScrollView>
    </PlanScreen>
  );
}

function EmptyState({ tok, lang }: { tok: any; lang: 'en' | 'ar' }) {
  return (
    <RCard padding={20}>
      <Text style={{
        fontFamily: fontBody(lang),
        fontSize: 14.5, lineHeight: 21, color: tok.muted,
        textAlign: 'center',
      }}>
        {lang === 'ar'
          ? 'لم ترصد سيشات أي عادات بعد. سجّل معاملاتك بشكل منتظم وستظهر هنا.'
          : 'No habits yet. Keep logging your transactions consistently and patterns will show up here.'}
      </Text>
    </RCard>
  );
}
