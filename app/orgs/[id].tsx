import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet, RefreshControl, Image, Linking, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Building2, ChevronRight, Mail, Plus, Send, UserPlus, Users, X } from 'lucide-react-native';
import { PlanScreen } from '../../components/PlanShell';
import { RCard, REyebrow, RButton } from '../../components/ui';
import { SkeletonRow } from '../../components/Skeleton';
import { useI18n } from '../../lib/i18n';
import { useAppData } from '../../lib/appData';
import {
  deleteOrg, getOrg, leaveOrg, listInvites, listMembers,
  mintTelegramOrgLinkToken, removeMember, revokeInvite,
  type OrgDetail, type OrgInvite, type OrgMember,
} from '../../lib/orgs';
import { fontBody, fontHead, fontMono } from '../../lib/fonts';

/**
 * /orgs/[id] - organization detail.
 *
 * Sections:
 *   - Header card with name + currency + telegram link status
 *   - Members list with roles + remove (owner only)
 *   - Pending invites with revoke (owner only)
 *   - Actions: Invite, Connect Telegram group (owner), Leave, Delete (owner)
 *
 * Switching to this screen does not change the active workspace
 * automatically - the list screen handles that before pushing. So all the
 * data here is read via the regular X-Ledger-Id header set on the API.
 */
export default function OrgDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tok, lang } = useI18n();
  const { profile, switchLedger } = useAppData();
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [linking, setLinking] = useState(false);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!id) return;
    if (mode === 'initial') setLoading(true); else setRefreshing(true);
    try {
      const [o, m, inv] = await Promise.all([
        getOrg(id),
        listMembers(id),
        listOwnerOnlyInvites(id),
      ]);
      setOrg(o);
      setMembers(m);
      setInvites(inv);
    } catch (err) {
      console.warn('load org failed', err);
    } finally {
      if (mode === 'initial') setLoading(false); else setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const isOwner = org?.role === 'owner';

  const handleLeave = () => {
    Alert.alert(
      lang === 'ar' ? `مغادرة ${org?.name}؟` : `Leave ${org?.name}?`,
      lang === 'ar'
        ? 'لن تعودي ترين المعاملات أو الميزانيات الخاصة بهذه المنظمة. ما سجّلتيه يبقى منسوبًا إليكِ في تاريخ المنظمة.'
        : 'You will no longer see this organization\'s transactions or budgets. Your past entries stay attributed to you in the org\'s history.',
      [
        { text: lang === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'ar' ? 'مغادرة' : 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveOrg(id!);
              // Switch the user back to their personal ledger before going
              // back to the list, otherwise the next screen would render
              // 403s while the active ledger still points at the org.
              const { setActiveLedger } = await import('../../lib/api');
              setActiveLedger(null);
              router.replace('/orgs');
            } catch (err) {
              Alert.alert(
                lang === 'ar' ? 'فشل' : 'Failed',
                err instanceof Error ? err.message : String(err),
              );
            }
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    Alert.alert(
      lang === 'ar' ? `حذف ${org?.name}؟` : `Delete ${org?.name}?`,
      lang === 'ar'
        ? 'سيتم حذف المنظمة وجميع بياناتها (المعاملات، الميزانيات، الأهداف، الفئات). لا يمكن التراجع.'
        : 'The organization and all its data (transactions, budgets, goals, categories) will be permanently deleted. This cannot be undone.',
      [
        { text: lang === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'ar' ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOrg(id!);
              const { setActiveLedger } = await import('../../lib/api');
              setActiveLedger(null);
              router.replace('/orgs');
            } catch (err) {
              Alert.alert(
                lang === 'ar' ? 'فشل' : 'Failed',
                err instanceof Error ? err.message : String(err),
              );
            }
          },
        },
      ],
    );
  };

  const handleConnectTelegram = async () => {
    if (!id) return;
    setLinking(true);
    try {
      const { command, deepLink } = await mintTelegramOrgLinkToken(id);
      // Show the command so the owner can also paste it manually if the
      // deep link doesn't open. We don't auto-share since copy is more
      // reliable across phones.
      Alert.alert(
        lang === 'ar' ? 'ربط مجموعة تيليجرام' : 'Connect Telegram group',
        lang === 'ar'
          ? `1. أضيفي البوت إلى المجموعة\n2. الصقي هذا الأمر في المحادثة:\n\n${command}\n\nالرابط صالح لـ 10 دقائق.`
          : `1. Add the bot to the group\n2. Paste this command in the chat:\n\n${command}\n\nLink expires in 10 minutes.`,
        [
          { text: lang === 'ar' ? 'إغلاق' : 'Close', style: 'cancel' },
          {
            text: lang === 'ar' ? 'فتح تيليجرام' : 'Open Telegram',
            onPress: () => Linking.openURL(deepLink).catch(() => {}),
          },
        ],
      );
    } catch (err) {
      Alert.alert(
        lang === 'ar' ? 'فشل' : 'Failed',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setLinking(false);
    }
  };

  return (
    <PlanScreen
      title={org?.name ?? (lang === 'ar' ? 'منظمة' : 'Organization')}
      subtitle={org ? `${lang === 'ar' ? (org.role === 'owner' ? 'مالك' : 'عضو') : (org.role === 'owner' ? 'Owner' : 'Member')}  ·  ${org.currency}` : undefined}
      refreshing={refreshing}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 140 }}
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
            {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
          </RCard>
        ) : !org ? (
          <Text style={{ color: tok.muted, fontFamily: fontBody(lang), padding: 24, textAlign: 'center' }}>
            {lang === 'ar' ? 'تعذّر تحميل المنظمة.' : 'Could not load organization.'}
          </Text>
        ) : (
          <>
            {/* Members */}
            <SectionHeader
              icon={<Users size={14} color={tok.muted} />}
              label={lang === 'ar' ? `الأعضاء (${members.length})` : `MEMBERS (${members.length})`}
              tok={tok} lang={lang}
              action={isOwner ? {
                label: lang === 'ar' ? 'دعوة' : 'Invite',
                onPress: () => router.push({ pathname: '/orgs/invite', params: { id } }),
              } : undefined}
            />
            <RCard padding={0} style={{ paddingHorizontal: 16, marginBottom: 18 }}>
              {members.map((m, i) => (
                <View
                  key={m.userId}
                  style={{
                    paddingVertical: 12,
                    flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                    alignItems: 'center', gap: 12,
                    borderBottomWidth: i < members.length - 1 ? StyleSheet.hairlineWidth : 0,
                    borderBottomColor: tok.border,
                  }}
                >
                  <View style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: tok.elevated, overflow: 'hidden',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {m.avatarUrl ? (
                      <Image source={{ uri: m.avatarUrl }} style={{ width: 36, height: 36 }} />
                    ) : (
                      <Text style={{
                        color: tok.gold, fontFamily: fontHead(lang), fontSize: 14,
                      }}>
                        {(m.displayName ?? m.email ?? '?')[0]?.toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: fontBody(lang, 'medium'), fontSize: 14, color: tok.bone,
                        textAlign: lang === 'ar' ? 'right' : 'left',
                      }}
                    >
                      {m.displayName ?? m.email ?? '—'}
                      {m.userId === profile?.email ? '' : ''}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        marginTop: 2,
                        fontFamily: fontMono('regular'), fontSize: 10, color: tok.muted, letterSpacing: 1.2,
                        textAlign: lang === 'ar' ? 'right' : 'left',
                      }}
                    >
                      {(lang === 'ar' ? (m.role === 'owner' ? 'مالك' : 'عضو') : m.role.toUpperCase())}
                      {m.email ? `  ·  ${m.email}` : ''}
                    </Text>
                  </View>
                  {isOwner && m.role !== 'owner' && (
                    <Pressable
                      onPress={() => promptRemove(m, id!, tok, lang, () => load('refresh'))}
                      hitSlop={8}
                      style={{ padding: 6 }}
                    >
                      <X size={16} color={tok.muted} />
                    </Pressable>
                  )}
                </View>
              ))}
            </RCard>

            {/* Pending invites (owner only) */}
            {isOwner && invites.length > 0 && (
              <>
                <SectionHeader
                  icon={<Mail size={14} color={tok.muted} />}
                  label={lang === 'ar' ? `دعوات معلّقة (${invites.length})` : `PENDING INVITES (${invites.length})`}
                  tok={tok} lang={lang}
                />
                <RCard padding={0} style={{ paddingHorizontal: 16, marginBottom: 18 }}>
                  {invites.map((inv, i) => (
                    <View
                      key={inv.id}
                      style={{
                        paddingVertical: 12,
                        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                        alignItems: 'center', gap: 12,
                        borderBottomWidth: i < invites.length - 1 ? StyleSheet.hairlineWidth : 0,
                        borderBottomColor: tok.border,
                      }}
                    >
                      <View style={{
                        width: 36, height: 36, borderRadius: 12,
                        backgroundColor: tok.elevated,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Mail size={16} color={tok.muted} strokeWidth={1.6} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          numberOfLines={1}
                          style={{
                            fontFamily: fontBody(lang, 'medium'), fontSize: 13, color: tok.bone,
                            textAlign: lang === 'ar' ? 'right' : 'left',
                          }}
                        >
                          {inv.email}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{
                            marginTop: 2,
                            fontFamily: fontMono('regular'), fontSize: 10, color: tok.muted, letterSpacing: 1.2,
                            textAlign: lang === 'ar' ? 'right' : 'left',
                          }}
                        >
                          {lang === 'ar' ? 'تنتهي' : 'EXPIRES'}{' '}
                          {new Date(inv.expiresAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                      <Pressable
                        onPress={async () => {
                          try {
                            await revokeInvite(id!, inv.id);
                            load('refresh');
                          } catch (err) {
                            Alert.alert(
                              lang === 'ar' ? 'فشل' : 'Failed',
                              err instanceof Error ? err.message : String(err),
                            );
                          }
                        }}
                        hitSlop={8}
                        style={{ padding: 6 }}
                      >
                        <X size={16} color={tok.muted} />
                      </Pressable>
                    </View>
                  ))}
                </RCard>
              </>
            )}

            {/* Actions */}
            <View style={{ gap: 10, marginTop: 4 }}>
              {isOwner && (
                <RButton full onPress={() => router.push({ pathname: '/orgs/invite', params: { id } })}>
                  <View style={{
                    flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                    alignItems: 'center', gap: 8,
                  }}>
                    <UserPlus size={16} color="#0D0D0D" />
                    <Text style={{
                      color: '#0D0D0D', fontFamily: fontBody(lang, 'semibold'), fontSize: 14,
                    }}>
                      {lang === 'ar' ? 'دعوة عضو' : 'Invite member'}
                    </Text>
                  </View>
                </RButton>
              )}
              {isOwner && (
                <Pressable
                  onPress={handleConnectTelegram}
                  disabled={linking}
                  style={({ pressed }) => ({
                    borderRadius: 12, paddingVertical: 12,
                    borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
                    backgroundColor: tok.surface,
                    flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                    alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Send size={16} color={tok.gold} strokeWidth={1.6} />
                  <Text style={{
                    color: tok.bone, fontFamily: fontBody(lang, 'semibold'), fontSize: 14,
                  }}>
                    {org.telegramLinked
                      ? (lang === 'ar' ? 'تيليجرام مربوط' : 'Telegram connected')
                      : (lang === 'ar' ? 'ربط مجموعة تيليجرام' : 'Connect Telegram group')}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Danger zone */}
            <View style={{ marginTop: 32, gap: 6 }}>
              {!isOwner ? (
                <Pressable onPress={handleLeave} hitSlop={8} style={({ pressed }) => ({
                  paddingVertical: 12, alignItems: 'center', opacity: pressed ? 0.6 : 1,
                })}>
                  <Text style={{
                    color: tok.alertText,
                    fontFamily: fontMono('regular'),
                    fontSize: 11, letterSpacing: 1.4,
                  }}>
                    {lang === 'ar' ? 'مغادرة المنظمة' : 'LEAVE ORGANIZATION'}
                  </Text>
                </Pressable>
              ) : (
                <Pressable onPress={handleDelete} hitSlop={8} style={({ pressed }) => ({
                  paddingVertical: 12, alignItems: 'center', opacity: pressed ? 0.6 : 1,
                })}>
                  <Text style={{
                    color: tok.alertText,
                    fontFamily: fontMono('regular'),
                    fontSize: 11, letterSpacing: 1.4,
                  }}>
                    {lang === 'ar' ? 'حذف المنظمة' : 'DELETE ORGANIZATION'}
                  </Text>
                </Pressable>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </PlanScreen>
  );
}

// Invites are owner-only on the server; non-owners get 403. We don't want
// to surface that in the UI, so we just swallow the error and treat as
// "no invites visible to you".
async function listOwnerOnlyInvites(id: string): Promise<OrgInvite[]> {
  try {
    return await listInvites(id);
  } catch {
    return [];
  }
}

function promptRemove(
  m: OrgMember,
  orgId: string,
  tok: ReturnType<typeof useI18n>['tok'],
  lang: 'en' | 'ar',
  reload: () => void,
) {
  Alert.alert(
    lang === 'ar' ? `إزالة ${m.displayName ?? m.email}؟` : `Remove ${m.displayName ?? m.email}?`,
    lang === 'ar'
      ? 'لن يعودوا أعضاء في هذه المنظمة. ما سجّلوه يبقى في التاريخ.'
      : 'They will no longer be a member of this organization. Their past entries stay in the history.',
    [
      { text: lang === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
      {
        text: lang === 'ar' ? 'إزالة' : 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMember(orgId, m.userId);
            reload();
          } catch (err) {
            Alert.alert(
              lang === 'ar' ? 'فشل' : 'Failed',
              err instanceof Error ? err.message : String(err),
            );
          }
        },
      },
    ],
  );
}

function SectionHeader({
  icon, label, tok, lang, action,
}: {
  icon: React.ReactNode;
  label: string;
  tok: ReturnType<typeof useI18n>['tok'];
  lang: 'en' | 'ar';
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={{
      flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
      alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 4, marginBottom: 8, marginTop: 6,
    }}>
      <View style={{
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', gap: 6,
      }}>
        {icon}
        <Text style={{
          fontFamily: fontMono('regular'), fontSize: 10, color: tok.muted, letterSpacing: 1.4,
        }}>
          {label}
        </Text>
      </View>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={6}>
          <Text style={{
            fontFamily: fontMono('regular'), fontSize: 10, color: tok.gold, letterSpacing: 1.4,
          }}>
            {action.label.toUpperCase()}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
