import { ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { fontHead } from '../lib/fonts';
import { REyebrow } from './ui';
import { RefreshSpinner } from './shell';

// Shared top chrome for Budgets / Goals / Debts: back arrow, title, subtitle,
// optional + action, and (when refreshing) a small spinning radar mark.
export function PlanScreen({
  title, subtitle, onAdd, refreshing, children,
}: { title: string; subtitle?: string; onAdd?: () => void; refreshing?: boolean; children: ReactNode }) {
  const router = useRouter();
  const { tok, lang } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: tok.void, paddingTop: insets.top }}>
      <View style={{
        paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', gap: 12,
      }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => ({
            width: 36, height: 36, borderRadius: 12,
            backgroundColor: pressed ? tok.elevated : tok.surface,
            alignItems: 'center', justifyContent: 'center',
          })}
        >
          <ChevronLeft size={20} color={tok.bone} style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{
            fontFamily: fontHead(lang),
            fontSize: 22, color: tok.bone, letterSpacing: -0.4,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}>{title}</Text>
          {subtitle && (
            <REyebrow style={{ marginTop: 3, textAlign: lang === 'ar' ? 'right' : 'left' }}>
              {subtitle}
            </REyebrow>
          )}
        </View>
        <RefreshSpinner refreshing={!!refreshing} />
        {onAdd && (
          <Pressable
            onPress={onAdd}
            hitSlop={10}
            style={({ pressed }) => ({
              width: 36, height: 36, borderRadius: 12,
              backgroundColor: pressed ? tok.goldLight : tok.gold,
              alignItems: 'center', justifyContent: 'center',
            })}
          >
            <Plus size={20} color="#0D0D0D" strokeWidth={2.2} />
          </Pressable>
        )}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
