import { ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { radius, T } from '../lib/theme';
import { fontHead } from '../lib/fonts';
import { REyebrow } from './ui';
import { RefreshSpinner } from './shell';
import { ScreenScaffold } from './Screen';
import { WorkspaceChip } from './WorkspaceSwitcher';

// Shared top chrome for Budgets / Goals / Debts: back arrow, title, subtitle,
// optional + action, and (when refreshing) a small refresh spinner. Sits on
// the gold ScreenAtmosphere wash via ScreenScaffold.
export function PlanScreen({
  title, subtitle, onAdd, refreshing, children,
}: { title: string; subtitle?: string; onAdd?: () => void; refreshing?: boolean; children: ReactNode }) {
  const router = useRouter();
  const { tok, lang } = useI18n();
  return (
    <ScreenScaffold>
      <View style={{
        paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', gap: 12,
      }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => ({
            width: 36, height: 36, borderRadius: radius.btn,
            backgroundColor: pressed ? tok.elevated : tok.surface,
            alignItems: 'center', justifyContent: 'center',
          })}
        >
          <ChevronLeft size={20} color={tok.bone} style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{
            fontFamily: fontHead(lang),
            fontSize: T.h5, color: tok.bone, letterSpacing: -0.4,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>{title}</Text>
          {subtitle && (
            <REyebrow style={{ marginTop: 3, textAlign: lang === 'ar' ? 'right' : 'left' }}>
              {subtitle}
            </REyebrow>
          )}
        </View>
        <WorkspaceChip />
        <RefreshSpinner refreshing={!!refreshing} />
        {onAdd && (
          <Pressable
            onPress={onAdd}
            hitSlop={10}
            style={({ pressed }) => ({
              width: 36, height: 36, borderRadius: radius.btn,
              backgroundColor: pressed ? tok.goldLight : tok.gold,
              alignItems: 'center', justifyContent: 'center',
            })}
          >
            <Plus size={20} color={tok.void} strokeWidth={2.2} />
          </Pressable>
        )}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </ScreenScaffold>
  );
}
