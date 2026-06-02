import { ReactNode, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, useWindowDimensions,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { Building2, User as UserIcon } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { fontHead } from '../lib/fonts';
import { RCard, REyebrow } from './ui';
import type { WorkspaceSummary } from '../lib/appData';

// ─────────────────────────────────────────────────────────────
// WorkspaceHeroPager — turns the hero card into a horizontal carousel of the
// user's workspaces. The active workspace's page shows the real hero (passed
// as children); the others show a light "release to switch" placeholder.
// Settling on a different page switches the active ledger (persisted server-
// side) and the rest of the dashboard refetches to match.
//
// With a single workspace there's nothing to switch, so it just renders the
// hero as-is.
// ─────────────────────────────────────────────────────────────
export function WorkspaceHeroPager({
  workspaces, activeIndex, onSwitch, children,
}: {
  workspaces: WorkspaceSummary[];
  activeIndex: number;
  onSwitch: (w: WorkspaceSummary) => void;
  children: ReactNode;
}) {
  const { tok } = useI18n();
  const { width } = useWindowDimensions();
  const pageW = width - 32; // dashboard uses paddingHorizontal: 16
  const scrollRef = useRef<ScrollView>(null);
  const safeIndex = Math.max(0, Math.min(activeIndex, workspaces.length - 1));

  // Keep the carousel aligned to the active workspace (initial mount + when
  // the active ledger changes from elsewhere, e.g. the Profile switcher).
  useEffect(() => {
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: safeIndex * pageW, y: 0, animated: false });
    }, 0);
    return () => clearTimeout(id);
  }, [safeIndex, pageW]);

  if (workspaces.length <= 1) return <>{children}</>;

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / pageW);
    if (idx !== safeIndex && workspaces[idx]) onSwitch(workspaces[idx]);
  };

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: safeIndex * pageW, y: 0 }}
        onMomentumScrollEnd={onEnd}
        decelerationRate="fast"
      >
        {workspaces.map((w, i) => (
          <View key={w.ledgerId || `${w.kind}-${w.name}`} style={{ width: pageW }}>
            {i === safeIndex ? children : <PlaceholderHero w={w} />}
          </View>
        ))}
      </ScrollView>

      {/* Page dots */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 12 }}>
        {workspaces.map((w, i) => (
          <View
            key={w.ledgerId || `${w.kind}-${w.name}-dot`}
            style={{
              width: i === safeIndex ? 18 : 6, height: 6, borderRadius: 3,
              backgroundColor: i === safeIndex ? tok.gold : tok.borderHi,
            }}
          />
        ))}
      </View>
    </View>
  );
}

function PlaceholderHero({ w }: { w: WorkspaceSummary }) {
  const { tok, lang } = useI18n();
  const isOrg = w.kind === 'org';
  return (
    <RCard large>
      <View style={{ minHeight: 150, justifyContent: 'center' }}>
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          alignItems: 'center', gap: 12,
        }}>
          <View style={{
            width: 44, height: 44, borderRadius: 14,
            backgroundColor: tok.elevated,
            alignItems: 'center', justifyContent: 'center',
          }}>
            {isOrg
              ? <Building2 size={20} color={tok.gold} strokeWidth={1.6} />
              : <UserIcon size={20} color={tok.gold} strokeWidth={1.6} />}
          </View>
          <View style={{ flex: 1 }}>
            <REyebrow>{lang === 'ar' ? 'مساحة العمل' : 'Workspace'}</REyebrow>
            <Text
              numberOfLines={1}
              style={{
                marginTop: 4, fontFamily: fontHead(lang), fontSize: 24, color: tok.bone,
                letterSpacing: lang === 'ar' ? 0 : -0.5,
                textAlign: lang === 'ar' ? 'right' : 'left',
              }}
            >{w.name}</Text>
          </View>
        </View>
        <Text style={{
          marginTop: 16, color: tok.muted, fontFamily: fontHead(lang), fontSize: 13,
          textAlign: 'center',
        }}>
          {lang === 'ar' ? 'اترك للتبديل إلى هذه المساحة' : 'Release to switch to this workspace'}
        </Text>
      </View>
    </RCard>
  );
}
