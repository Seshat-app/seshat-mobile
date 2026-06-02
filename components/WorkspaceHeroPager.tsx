import { ReactNode, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, useWindowDimensions,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { BarChart3, Crosshair, LayoutGrid } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { fontHead } from '../lib/fonts';
import { RCard, REyebrow } from './ui';

// ─────────────────────────────────────────────────────────────
// HeroPager — turns the hero card into a horizontal carousel of dashboard
// views (Numbers / Instrument / Bento). The active view's page shows the real
// hero (passed as children); the others show a light "release to switch"
// placeholder. Settling on another page selects that view (persisted), and
// the whole dashboard re-renders to it.
// ─────────────────────────────────────────────────────────────
export type HeroPage = { label: string; icon: 'numbers' | 'hud' | 'bento' };

const ICONS = { numbers: BarChart3, hud: Crosshair, bento: LayoutGrid } as const;

export function HeroPager({
  pages, activeIndex, onSelect, children,
}: {
  pages: HeroPage[];
  activeIndex: number;
  onSelect: (index: number) => void;
  children: ReactNode;
}) {
  const { tok } = useI18n();
  const { width } = useWindowDimensions();
  const pageW = width - 32; // dashboard uses paddingHorizontal: 16
  const scrollRef = useRef<ScrollView>(null);
  const safeIndex = Math.max(0, Math.min(activeIndex, pages.length - 1));

  // Keep the carousel aligned to the active view (mount + external changes).
  useEffect(() => {
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: safeIndex * pageW, y: 0, animated: false });
    }, 0);
    return () => clearTimeout(id);
  }, [safeIndex, pageW]);

  if (pages.length <= 1) return <>{children}</>;

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / pageW);
    if (idx !== safeIndex && pages[idx]) onSelect(idx);
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
        {pages.map((p, i) => (
          <View key={p.label} style={{ width: pageW }}>
            {i === safeIndex ? children : <PlaceholderHero page={p} />}
          </View>
        ))}
      </ScrollView>

      {/* Page dots — one per view */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 12 }}>
        {pages.map((p, i) => (
          <View
            key={`${p.label}-dot`}
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

function PlaceholderHero({ page }: { page: HeroPage }) {
  const { tok, lang } = useI18n();
  const Icon = ICONS[page.icon];
  return (
    <RCard large>
      <View style={{ minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <View style={{
          width: 48, height: 48, borderRadius: 16,
          backgroundColor: tok.elevated,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={22} color={tok.gold} strokeWidth={1.6} />
        </View>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text style={{
            fontFamily: fontHead(lang), fontSize: 20, color: tok.bone, letterSpacing: -0.4,
          }}>{page.label}</Text>
          <REyebrow>{lang === 'ar' ? 'اترك للعرض' : 'Release to view'}</REyebrow>
        </View>
      </View>
    </RCard>
  );
}
