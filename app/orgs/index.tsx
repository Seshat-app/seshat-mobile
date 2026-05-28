import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Building2, ChevronRight, Plus, Send } from 'lucide-react-native';
import { PlanScreen } from '../../components/PlanShell';
import { RCard, REyebrow } from '../../components/ui';
import { SkeletonRow } from '../../components/Skeleton';
import { useI18n } from '../../lib/i18n';
import { useAppData } from '../../lib/appData';
import { hasToken } from '../../lib/api';
import { listOrgs, type OrgSummary } from '../../lib/orgs';
import { fontBody, fontMono } from '../../lib/fonts';

/**
 * /orgs - list of organizations the user belongs to.
 *
 * Pulls from /api/v1/orgs and shows each org as a row with name, role, and
 * member count. Tapping a row goes to the detail screen. The "+ Create
 * organization" action lives in the header (PlanScreen.onAdd) so it's
 * visible regardless of scroll position.
 *
 * If the user is in no orgs yet, we show an empty state with a Create CTA
 * directly in the content so first-time users land somewhere actionable
 * instead of an empty screen with a tiny + in the corner.
 */
export default function OrgsListScreen() {
  const router = useRouter();
  const { tok, lang } = useI18n();
  const { activeLedgerId, switchLedger, refresh: refreshAppData } = useAppData();
  const [items, setItems] = useState<OrgSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!(await hasToken())) return;
    if (mode === 'initial') setLoading(true); else setRefreshing(true);
    try {
      const data = await listOrgs();
      setItems(data);
    } catch (err) {
      console.warn('listOrgs failed', err);
    } finally {
      if (mode === 'initial') setLoading(false); else setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = async (org: OrgSummary) => {
    // Switching to the org's ledger first means the org-detail screen renders
    // its data in the correct workspace (members + invites are scoped here,
    // but transactions / dashboard / etc. read X-Ledger-Id).
    if (activeLedgerId !== org.ledgerId) {
      await switchLedger(org.ledgerId);
    }
    router.push({ pathname: '/orgs/[id]', params: { id: org.id } });
  };

  return (
    <PlanScreen
      title={lang === 'ar' ? 'المنظمات' : 'Organizations'}
      subtitle={lang === 'ar' ? 'مساحات العمل المشتركة' : 'Shared workspaces'}
      refreshing={refreshing}
      onAdd={() => router.push('/orgs/new')}
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
        {loading ? (
          <RCard padding={18}>
            {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
          </RCard>
        ) : items.length === 0 ? (
          <EmptyState
            onCreate={() => router.push('/orgs/new')}
            tok={tok}
            lang={lang}
          />
        ) : (
          <RCard padding={0} style={{ paddingHorizontal: 18 }}>
            {items.map((org, i) => (
              <Pressable
                key={org.id}
                onPress={() => open(org)}
                style={({ pressed }) => ({
                  paddingVertical: 16,
                  flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                  alignItems: 'center', gap: 14,
                  borderBottomWidth: i < items.length - 1 ? StyleSheet.hairlineWidth : 0,
                  borderBottomColor: tok.border,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View style={{
                  width: 42, height: 42, borderRadius: 12,
                  backgroundColor: tok.elevated,
                  borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Building2 size={20} color={tok.gold} strokeWidth={1.6} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: fontBody(lang, 'semibold'), fontSize: 15, color: tok.bone,
                      textAlign: lang === 'ar' ? 'right' : 'left',
                    }}
                  >
                    {org.name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      marginTop: 3,
                      fontFamily: fontMono('regular'), fontSize: 10, color: tok.muted, letterSpacing: 1.2,
                      textAlign: lang === 'ar' ? 'right' : 'left',
                    }}
                  >
                    {lang === 'ar'
                      ? `${org.role === 'owner' ? 'مالك' : 'عضو'}  ·  ${org.memberCount} عضو  ·  ${org.currency}`
                      : `${org.role === 'owner' ? 'OWNER' : 'MEMBER'}  ·  ${org.memberCount} MEMBER${org.memberCount === 1 ? '' : 'S'}  ·  ${org.currency}`}
                  </Text>
                </View>
                {org.telegramLinked && (
                  <Send size={14} color={tok.gold} strokeWidth={1.6} />
                )}
                <ChevronRight
                  size={18} color={tok.muted}
                  style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }}
                />
              </Pressable>
            ))}
          </RCard>
        )}
      </ScrollView>
    </PlanScreen>
  );
}

function EmptyState({
  onCreate, tok, lang,
}: { onCreate: () => void; tok: ReturnType<typeof useI18n>['tok']; lang: 'en' | 'ar' }) {
  return (
    <View style={{
      marginTop: 40, alignItems: 'center', paddingHorizontal: 24,
    }}>
      <View style={{
        width: 64, height: 64, borderRadius: 18,
        backgroundColor: tok.surface,
        borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 18,
      }}>
        <Building2 size={28} color={tok.gold} strokeWidth={1.6} />
      </View>
      <Text style={{
        fontFamily: fontBody(lang, 'semibold'), fontSize: 16, color: tok.bone,
        textAlign: 'center', marginBottom: 8,
      }}>
        {lang === 'ar' ? 'لا توجد منظمات بعد' : 'No organizations yet'}
      </Text>
      <Text style={{
        fontFamily: fontBody(lang), fontSize: 13, color: tok.muted, lineHeight: 19,
        textAlign: 'center', marginBottom: 24,
      }}>
        {lang === 'ar'
          ? 'أنشئ منظمة لتشاركها مع فريقك. ميزانية واحدة، عدة أشخاص، وSeshat تتولى التسجيل.'
          : 'Create one to share with your team. One ledger, multiple people, Seshat keeps the records.'}
      </Text>
      <Pressable
        onPress={onCreate}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: pressed ? tok.goldLight : tok.gold,
          paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12,
        })}
      >
        <Plus size={16} color="#0D0D0D" strokeWidth={2.4} />
        <Text style={{
          color: '#0D0D0D', fontFamily: fontBody(lang, 'semibold'), fontSize: 14,
        }}>
          {lang === 'ar' ? 'إنشاء منظمة' : 'Create organization'}
        </Text>
      </Pressable>
    </View>
  );
}
