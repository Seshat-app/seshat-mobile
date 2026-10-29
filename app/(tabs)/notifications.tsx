import { useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { ScrollView as ScreenScroll } from '../../components/Scroll';
import { FrostedHeader } from '../../components/FrostedHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  CheckCheck, Bell, BellOff, Sparkles, Receipt, PieChart,
  Info, MessageSquare,
} from 'lucide-react-native';
import { ScreenScaffold } from '../../components/Screen';
import { REyebrow } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { fontBody, fontHead, fontMono } from '../../lib/fonts';
import { radius, T } from '../../lib/theme';
import { setActiveLedger } from '../../lib/api';
import { useNotifications, type AppNotification, type NotificationType } from '../../lib/notifications';

// Relative time — "now", "5m", "3h", "2d", else a short date. Kept compact so
// it sits on the row without wrapping in either language.
function relativeTime(iso: string, lang: 'en' | 'ar'): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return lang === 'ar' ? 'الآن' : 'now';
  if (min < 60) return lang === 'ar' ? `${min} د` : `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return lang === 'ar' ? `${hr} س` : `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return lang === 'ar' ? `${day} ي` : `${day}d`;
  return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    day: 'numeric', month: 'short',
  });
}

const ICON_FOR: Record<NotificationType, any> = {
  ai: Sparkles,
  bill: Receipt,
  budget: PieChart,
  system: Info,
  proactive: MessageSquare,
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { tok, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const {
    items, unreadCount, loading, markRead, markAllRead, remove, refresh,
  } = useNotifications();

  // Tap → mark read, then deep-link on the meta payload. `chat_reply` opens the
  // chat thread (carrying persona when the notification named one); a budget
  // threshold opens Budgets. Falls back to the notification `type` when meta is
  // absent so older records still route somewhere sensible.
  const handleTap = useCallback((n: AppNotification) => {
    void markRead(n._id);
    const meta = (n.meta ?? {}) as Record<string, unknown>;
    const kind = typeof meta.kind === 'string' ? meta.kind : undefined;
    const sessionId = typeof meta.sessionId === 'string' ? meta.sessionId : undefined;
    const persona = typeof meta.persona === 'string' ? meta.persona : undefined;
    const ledgerId = typeof meta.ledgerId === 'string' ? meta.ledgerId : undefined;

    if (ledgerId) setActiveLedger(ledgerId);

    if ((kind === 'chat_reply' || n.type === 'ai' || n.type === 'proactive') && sessionId) {
      router.push({
        pathname: '/seshat/[id]',
        params: persona ? { id: sessionId, persona } : { id: sessionId },
      });
      return;
    }
    if (kind === 'budget_threshold' || n.type === 'budget') {
      router.push('/budgets');
    }
  }, [markRead, router]);

  const confirmDelete = useCallback((n: AppNotification) => {
    Alert.alert(
      lang === 'ar' ? 'حذف الإشعار' : 'Delete notification',
      lang === 'ar' ? 'سيُزال هذا الإشعار.' : 'This notification will be removed.',
      [
        { text: lang === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'ar' ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: () => { void remove(n._id); },
        },
      ],
    );
  }, [lang, remove]);

  return (
    <ScreenScaffold>
      {/* Header — title + a mark-all-read action (only when there's something
          unread). This is a root tab now, so there's no back arrow. */}
      <FrostedHeader style={{
        paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', gap: 12,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{
            fontFamily: fontHead(lang),
            fontSize: T.h5, color: tok.bone, letterSpacing: -0.4,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>{lang === 'ar' ? 'الإشعارات' : 'Notifications'}</Text>
          <REyebrow style={{ marginTop: 3, textAlign: lang === 'ar' ? 'right' : 'left' }}>
            {unreadCount > 0
              ? (lang === 'ar' ? `${unreadCount} غير مقروء` : `${unreadCount} unread`)
              : (lang === 'ar' ? 'كل شيء مقروء' : 'All caught up')}
          </REyebrow>
        </View>
        {unreadCount > 0 && (
          <Pressable
            onPress={() => { void markAllRead(); }}
            hitSlop={10}
            accessibilityLabel={lang === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all read'}
            style={({ pressed }) => ({
              flexDirection: lang === 'ar' ? 'row-reverse' : 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: 12, height: 36, borderRadius: radius.btn,
              backgroundColor: pressed ? tok.elevated : tok.surface,
              borderWidth: 1, borderColor: tok.border,
            })}
          >
            <CheckCheck size={15} color={tok.gold} />
            <Text style={{
              fontFamily: fontMono('regular'), fontSize: 10, color: tok.gold,
              letterSpacing: 1.2, textTransform: 'uppercase',
            }}>{lang === 'ar' ? 'الكل' : 'All'}</Text>
          </Pressable>
        )}
      </FrostedHeader>

      <ScreenScroll
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => { void refresh(); }}
            tintColor={tok.gold}
            colors={[tok.gold]}
            progressBackgroundColor={tok.surface}
          />
        }
      >
        {loading ? (
          <View style={{ paddingTop: 40, alignItems: 'center' }}>
            <ActivityIndicator color={tok.gold} />
          </View>
        ) : items.length === 0 ? (
          <EmptyState tok={tok} lang={lang} />
        ) : (
          <View style={{ gap: 10 }}>
            {items.map((n) => (
              <NotificationRow
                key={n._id}
                n={n}
                tok={tok}
                lang={lang}
                onPress={() => handleTap(n)}
                onLongPress={() => confirmDelete(n)}
              />
            ))}
          </View>
        )}
      </ScreenScroll>
    </ScreenScaffold>
  );
}

function NotificationRow({
  n, tok, lang, onPress, onLongPress,
}: {
  n: AppNotification;
  tok: any;
  lang: 'en' | 'ar';
  onPress: () => void;
  onLongPress: () => void;
}) {
  const Icon = ICON_FOR[n.type] ?? Bell;
  const unread = !n.read;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      accessibilityLabel={n.title}
      accessibilityHint={lang === 'ar' ? 'اضغط مطولاً للحذف' : 'Long-press to delete'}
      style={({ pressed }) => ({
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'flex-start', gap: 12,
        padding: 14, borderRadius: radius.card,
        backgroundColor: unread ? tok.glowShellBg : tok.surface,
        borderWidth: 1,
        borderColor: unread ? tok.glowShellBorder : tok.border,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {/* Icon tile */}
      <View style={{
        width: 38, height: 38, borderRadius: radius.input,
        backgroundColor: tok.elevated,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} color={unread ? tok.gold : tok.muted} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          alignItems: 'center', gap: 8,
        }}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontFamily: fontBody(lang, unread ? 'medium' : 'regular'),
              fontSize: lang === 'ar' ? 15 : 14,
              color: tok.bone,
              writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
              textAlign: lang === 'ar' ? 'right' : 'left',
            }}
          >{n.title}</Text>
          <Text style={{
            fontFamily: fontMono('regular'), fontSize: 10, color: tok.muted,
            writingDirection: 'ltr',
          }}>{relativeTime(n.createdAt, lang)}</Text>
          {unread && (
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tok.gold }} />
          )}
        </View>
        {!!n.body && (
          <Text
            numberOfLines={3}
            style={{
              marginTop: 4,
              fontFamily: fontBody(lang),
              fontSize: 13, lineHeight: 19, color: tok.muted,
              writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
              textAlign: lang === 'ar' ? 'right' : 'left',
            }}
          >{n.body}</Text>
        )}
      </View>
    </Pressable>
  );
}

function EmptyState({ tok, lang }: { tok: any; lang: 'en' | 'ar' }) {
  return (
    <View style={{ paddingTop: 60, alignItems: 'center', gap: 14 }}>
      <View style={{
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: tok.surface,
        borderWidth: 1, borderColor: tok.border,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <BellOff size={24} color={tok.muted} />
      </View>
      <Text style={{
        fontFamily: fontBody(lang), fontSize: 14.5, lineHeight: 21,
        color: tok.muted, textAlign: 'center', maxWidth: 260,
      }}>
        {lang === 'ar'
          ? 'لا إشعارات بعد. عندما يرصد سيشات شيئاً يستحق انتباهك سيظهر هنا.'
          : "No notifications yet. When Seshat spots something worth your attention, it'll show up here."}
      </Text>
    </View>
  );
}
