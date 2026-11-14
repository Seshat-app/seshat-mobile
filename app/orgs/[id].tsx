import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet, RefreshControl, Image, Linking, Platform } from 'react-native';
import { ScrollView as ScreenScroll } from '../../components/Scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Building2, ChevronRight, Layers, Mail, Plus, Send, Target, UserPlus, Users, X } from 'lucide-react-native';
import { PlanScreen } from '../../components/PlanShell';
import { ImageViewer } from '../../components/ImageViewer';
import { RCard, REyebrow, RButton, RPill } from '../../components/ui';
import { SkeletonRow } from '../../components/Skeleton';
import { useI18n } from '../../lib/i18n';
import { useAppData } from '../../lib/appData';
import {
  deleteOrg, getOrg, leaveOrg, listInvites, listMembers,
  mintTelegramOrgLinkToken, removeMember, revokeInvite,
  setTelegramDefaultProject, setMemberRole,
  type OrgDetail, type OrgInvite, type OrgMember,
} from '../../lib/orgs';
import { roleLabel, kindLabel, isManager, canAssignRole, canRemoveMember, invitableRoles, type OrgRole } from '../../lib/orgRoles';
import { fontBody, fontHead, fontMono } from '../../lib/fonts';
import { NumberSheet } from '../../components/NumberSheet';
import { setApprovalThreshold, setMemberLimit, listAllowances, setAllowance, removeAllowance, type ChildAllowance } from '../../lib/orgExtras';

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
  const insets = useSafeAreaInsets();
  const { tok, lang } = useI18n();
  const { profile, switchLedger, projects, activeLedgerId } = useAppData();
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [linking, setLinking] = useState(false);
  // Sheets for the team and family settings (approval limit, a member's limit, a child's allowance).
  const [approvalSheet, setApprovalSheet] = useState(false);
  const [limitFor, setLimitFor] = useState<OrgMember | null>(null);
  const [allowFor, setAllowFor] = useState<OrgMember | null>(null);
  const [allowPeriod, setAllowPeriod] = useState<'week' | 'month'>('week');
  const [allowances, setAllowances] = useState<ChildAllowance[]>([]);
  // Full-screen preview for a tapped member avatar.
  const [viewerUri, setViewerUri] = useState<string | null>(null);

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
      if (o.kind === 'family' && isManager(o.role)) listAllowances(id).then(setAllowances).catch(() => setAllowances([]));
    } catch (err) {
      console.warn('load org failed', err);
    } finally {
      if (mode === 'initial') setLoading(false); else setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const isOwner = org?.role === 'owner';
  const manage = isManager(org?.role);
  const kind = org?.kind ?? 'team';
  const ar = lang === 'ar';

  // Change a member's role: offers only the roles this person may give.
  const changeRole = (m: OrgMember) => {
    if (!org || !id) return;
    const options = invitableRoles(org.role, kind).filter((r) => r !== m.role && canAssignRole(org.role, m.role, r as OrgRole));
    if (options.length === 0) return;
    Alert.alert(m.displayName ?? m.email ?? '', ar ? 'اختر الدور' : 'Choose a role', [
      ...options.map((r) => ({
        text: roleLabel(r, kind, ar),
        onPress: async () => { try { await setMemberRole(id, m.userId, r); await load('refresh'); } catch (e) { Alert.alert(ar ? 'فشل' : 'Failed', e instanceof Error ? e.message : String(e)); } },
      })),
      { text: ar ? 'إلغاء' : 'Cancel', style: 'cancel' as const },
    ]);
  };

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
      title={org?.name ?? (ar ? 'مساحة مشتركة' : 'Shared workspace')}
      subtitle={org ? `${kindLabel(kind, ar)}  ·  ${roleLabel(org.role, kind, ar)}  ·  ${org.currency}` : undefined}
      refreshing={refreshing}
    >
      <ScreenScroll
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 32 }}
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
              action={manage ? {
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
                  <Pressable
                    onPress={m.avatarUrl ? () => setViewerUri(m.avatarUrl!) : undefined}
                    disabled={!m.avatarUrl}
                    accessibilityLabel={m.avatarUrl ? (lang === 'ar' ? 'عرض الصورة' : 'View photo') : undefined}
                    style={({ pressed }) => ({
                      width: 36, height: 36, borderRadius: 18,
                      backgroundColor: tok.elevated, overflow: 'hidden',
                      alignItems: 'center', justifyContent: 'center',
                      opacity: pressed && m.avatarUrl ? 0.7 : 1,
                    })}
                  >
                    {m.avatarUrl ? (
                      <Image source={{ uri: m.avatarUrl }} style={{ width: 36, height: 36 }} />
                    ) : (
                      <Text style={{
                        color: tok.gold, fontFamily: fontHead(lang), fontSize: 14,
                      }}>
                        {(m.displayName ?? m.email ?? '?')[0]?.toUpperCase()}
                      </Text>
                    )}
                  </Pressable>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: fontBody(lang, 'medium'), fontSize: 14, color: tok.bone,
                        textAlign: lang === 'ar' ? 'right' : 'left',
                      }}
                    >
                      {m.displayName ?? m.email ?? '-'}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        marginTop: 2,
                        fontFamily: fontMono('regular'), fontSize: 10, color: tok.muted, letterSpacing: 1.2,
                        textAlign: lang === 'ar' ? 'right' : 'left',
                      }}
                    >
                      {roleLabel(m.role, kind, ar).toUpperCase()}
                      {m.monthlyLimit ? `  ·  ${ar ? 'حدّ' : 'LIMIT'} ${Math.round(m.monthlyLimit).toLocaleString('en-US')}` : ''}
                      {(() => { const a = allowances.find((x) => x.childId === m.userId); return a ? `  ·  ${Math.round(a.left).toLocaleString('en-US')} ${ar ? 'متبقٍّ' : 'LEFT'}/${a.period === 'week' ? (ar ? 'أسبوع' : 'WK') : (ar ? 'شهر' : 'MO')}` : ''; })()}
                      {m.email ? `  ·  ${m.email}` : ''}
                    </Text>
                  </View>
                  {manage && org && invitableRoles(org.role, kind).some((r) => r !== m.role && canAssignRole(org.role, m.role, r)) && (
                    <Pressable onPress={() => changeRole(m)} hitSlop={8} style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
                      <Text style={{ fontFamily: fontMono('regular'), fontSize: 10, letterSpacing: 1.2, color: tok.gold }}>{ar ? 'الدور' : 'ROLE'}</Text>
                    </Pressable>
                  )}
                  {manage && kind === 'team' && m.role === 'member' && (
                    <Pressable onPress={() => setLimitFor(m)} hitSlop={8} style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
                      <Text style={{ fontFamily: fontMono('regular'), fontSize: 10, letterSpacing: 1.2, color: tok.gold }}>{ar ? 'الحد' : 'LIMIT'}</Text>
                    </Pressable>
                  )}
                  {manage && kind === 'family' && m.role === 'child' && (
                    <Pressable onPress={() => { setAllowPeriod(allowances.find((a) => a.childId === m.userId)?.period ?? 'week'); setAllowFor(m); }} hitSlop={8} style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
                      <Text style={{ fontFamily: fontMono('regular'), fontSize: 10, letterSpacing: 1.2, color: tok.gold }}>{ar ? 'المصروف' : 'ALLOWANCE'}</Text>
                    </Pressable>
                  )}
                  {manage && org && canRemoveMember(org.role, m.role) && (
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
            {manage && invites.length > 0 && (
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

            {/* Approvals (teams): expenses above a limit wait for an owner or admin. */}
            {manage && kind === 'team' && (
              <>
                <SectionHeader icon={<Target size={14} color={tok.muted} />} label={ar ? 'الموافقات' : 'APPROVALS'} tok={tok} lang={lang} />
                <RCard padding={0} style={{ paddingHorizontal: 16, marginBottom: 18 }}>
                  <Pressable onPress={() => setApprovalSheet(true)} style={{ paddingVertical: 14, flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tok.border }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fontBody(lang, 'medium'), fontSize: 14, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{ar ? 'حدّ الموافقة' : 'Approval limit'}</Text>
                      <Text style={{ marginTop: 2, fontFamily: fontBody(lang), fontSize: 12, color: tok.muted, textAlign: ar ? 'right' : 'left' }}>
                        {org?.approvalThreshold ? (ar ? `مصاريف الأعضاء من ${Math.round(org.approvalThreshold).toLocaleString('en-US')} فأكثر تنتظر موافقتك` : `Member expenses of ${Math.round(org.approvalThreshold).toLocaleString('en-US')} or more wait for your approval`) : (ar ? 'متوقف. حدّد مبلغاً لتفعيله.' : 'Off. Set an amount to turn it on.')}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: fontMono('regular'), fontSize: 10, letterSpacing: 1.2, color: tok.gold }}>{ar ? 'تغيير' : 'CHANGE'}</Text>
                  </Pressable>
                  <Pressable onPress={() => router.push({ pathname: '/orgs/[id]/approvals', params: { id: id! } })} style={{ paddingVertical: 14, flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{ flex: 1, fontFamily: fontBody(lang, 'medium'), fontSize: 14, color: tok.bone, textAlign: ar ? 'right' : 'left' }}>{ar ? 'بانتظار الموافقة' : 'Waiting for approval'}</Text>
                    <Text style={{ fontFamily: fontMono('regular'), fontSize: 12, color: (org?.pendingApprovals ?? 0) > 0 ? tok.gold : tok.muted }}>{org?.pendingApprovals ?? 0}</Text>
                    <ChevronRight size={16} color={tok.muted} style={{ transform: [{ scaleX: ar ? -1 : 1 }] }} />
                  </Pressable>
                </RCard>
              </>
            )}

            {/* Actions */}
            <View style={{ gap: 10, marginTop: 4 }}>
              {manage && (
                <RButton
                  full
                  icon={<UserPlus size={16} color={tok.void} />}
                  onPress={() => router.push({ pathname: '/orgs/invite', params: { id } })}
                >
                  {kind === 'family' ? (ar ? 'دعوة فرد من العائلة' : 'Invite someone') : (lang === 'ar' ? 'دعوة عضو' : 'Invite member')}
                </RButton>
              )}
              {manage && (
                <RButton
                  variant="secondary"
                  full
                  loading={linking}
                  icon={<Send size={16} color={tok.gold} strokeWidth={1.6} />}
                  onPress={handleConnectTelegram}
                >
                  {org.telegramLinked
                    ? (lang === 'ar' ? 'تيليجرام مربوط' : 'Telegram connected')
                    : (lang === 'ar' ? 'ربط مجموعة تيليجرام' : 'Connect Telegram group')}
                </RButton>
              )}

              {kind !== 'family' && (
              <>
              {/* Manage projects - all members can open; only owners can
                  create/archive (server-enforced is permissive in v1 but
                  we keep the entry point shared so members can browse). */}
              <RCard padding={0}>
                <Pressable
                  onPress={async () => {
                    // Make sure the active ledger points at this org before
                    // navigating - the projects screen reads from the active
                    // ledger header.
                    if (activeLedgerId !== `o_${id}`) await switchLedger(`o_${id}`);
                    router.push({ pathname: '/orgs/[id]/projects', params: { id: id! } });
                  }}
                  style={({ pressed }) => ({
                    paddingVertical: 14, paddingHorizontal: 16,
                    flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                    alignItems: 'center', gap: 10,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Layers size={16} color={tok.gold} strokeWidth={1.6} />
                  <Text style={{
                    flex: 1,
                    color: tok.bone, fontFamily: fontBody(lang, 'semibold'), fontSize: 14,
                    textAlign: lang === 'ar' ? 'right' : 'left',
                  }}>
                    {lang === 'ar' ? 'المشاريع' : 'Projects'}
                  </Text>
                  <ChevronRight
                    size={16}
                    color={tok.muted}
                    style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }}
                  />
                </Pressable>
              </RCard>

              </>
              )}

              {/* Default project for the linked Telegram group. Only shown
                  when the group is linked AND the org has at least one
                  active project (loaded into context). */}
              {manage && kind !== 'family' && org.telegramLinked && projects.length > 0 && activeLedgerId === `o_${id}` ? (
                <RCard style={{ gap: 8 }}>
                  <View style={{
                    flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                    alignItems: 'center', gap: 8,
                  }}>
                    <Target size={14} color={tok.muted} strokeWidth={1.6} />
                    <Text style={{
                      color: tok.muted, fontFamily: fontMono('regular'),
                      fontSize: 10, letterSpacing: 1.4,
                    }}>
                      {lang === 'ar' ? 'مشروع المجموعة الافتراضي' : 'GROUP DEFAULT PROJECT'}
                    </Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                    {/* None chip */}
                    <RPill
                      active={!org.telegramDefaultProjectId}
                      onPress={async () => {
                        try {
                          const next = await setTelegramDefaultProject(id!, null);
                          setOrg((prev) => prev ? { ...prev, telegramDefaultProjectId: next.telegramDefaultProjectId } : prev);
                        } catch (err) {
                          Alert.alert(lang === 'ar' ? 'فشل' : 'Failed', err instanceof Error ? err.message : String(err));
                        }
                      }}
                    >
                      {lang === 'ar' ? 'بدون' : 'None'}
                    </RPill>
                    {projects.map((p) => {
                      const a = org.telegramDefaultProjectId === p._id;
                      return (
                        <RPill
                          key={p._id}
                          active={a}
                          icon={p.color ? (
                            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: p.color }} />
                          ) : undefined}
                          onPress={async () => {
                            try {
                              const next = await setTelegramDefaultProject(id!, p._id);
                              setOrg((prev) => prev ? { ...prev, telegramDefaultProjectId: next.telegramDefaultProjectId } : prev);
                            } catch (err) {
                              Alert.alert(lang === 'ar' ? 'فشل' : 'Failed', err instanceof Error ? err.message : String(err));
                            }
                          }}
                        >
                          {p.name}
                        </RPill>
                      );
                    })}
                  </ScrollView>
                </RCard>
              ) : null}
            </View>

            {/* Danger zone */}
            <View style={{ marginTop: 32, gap: 6 }}>
              {!isOwner ? (
                <RButton variant="danger" full onPress={handleLeave}>
                  {kind === 'family' ? (ar ? 'مغادرة العائلة' : 'Leave household') : (ar ? 'مغادرة الفريق' : 'Leave team')}
                </RButton>
              ) : (
                <RButton variant="danger" full onPress={handleDelete}>
                  {kind === 'family' ? (ar ? 'حذف العائلة' : 'Delete household') : (ar ? 'حذف الفريق' : 'Delete team')}
                </RButton>
              )}
            </View>
          </>
        )}
      </ScreenScroll>
      <ImageViewer visible={viewerUri !== null} uri={viewerUri} onClose={() => setViewerUri(null)} />
      <NumberSheet
        visible={approvalSheet}
        title={ar ? 'حدّ الموافقة' : 'Approval limit'}
        hint={ar ? 'أي مصروف يسجّله عضو بهذا المبلغ أو أكثر ينتظر موافقتك أو رفضك. المالك والمديرون لا ينتظرون.' : 'An expense a member logs for this amount or more waits for you to approve or reject it. Owners and admins are never held up.'}
        initial={org?.approvalThreshold} unit={org?.currency}
        clearLabel={ar ? 'إيقاف الموافقات' : 'Turn approvals off'}
        onClose={() => setApprovalSheet(false)}
        onSave={async (v) => { try { await setApprovalThreshold(id!, v); setApprovalSheet(false); await load('refresh'); } catch (e) { Alert.alert(ar ? 'تعذّر' : 'Failed', e instanceof Error ? e.message : String(e)); } }}
      />
      <NumberSheet
        visible={!!limitFor}
        title={ar ? `الحدّ الشهري: ${limitFor?.displayName ?? ''}` : `Monthly limit: ${limitFor?.displayName ?? ''}`}
        hint={ar ? 'عندما يتجاوز إنفاقه هذا الشهر هذا المبلغ، يصلك تنبيه.' : 'You are told when their spending this month passes this amount.'}
        initial={limitFor?.monthlyLimit} unit={org?.currency}
        clearLabel={ar ? 'إزالة الحدّ' : 'Remove the limit'}
        onClose={() => setLimitFor(null)}
        onSave={async (v) => { try { await setMemberLimit(id!, limitFor!.userId, v); setLimitFor(null); await load('refresh'); } catch (e) { Alert.alert(ar ? 'تعذّر' : 'Failed', e instanceof Error ? e.message : String(e)); } }}
      />
      <NumberSheet
        visible={!!allowFor}
        title={ar ? `مصروف ${allowFor?.displayName ?? ''}` : `Allowance: ${allowFor?.displayName ?? ''}`}
        hint={ar ? 'ميزانية يراها الطفل وتنقص مع ما يسجّله. لا تُنقل نقود، وتُبلَّغ عند نفادها.' : 'A budget the child sees, going down as they log spending. No money moves, and you are told when it runs out.'}
        initial={allowances.find((a) => a.childId === allowFor?.userId)?.amount} unit={org?.currency}
        clearLabel={ar ? 'إزالة المصروف' : 'Remove the allowance'}
        extra={(
          <View style={{ flexDirection: ar ? 'row-reverse' : 'row', gap: 8 }}>
            <RPill active={allowPeriod === 'week'} onPress={() => setAllowPeriod('week')}>{ar ? 'أسبوعياً' : 'Per week'}</RPill>
            <RPill active={allowPeriod === 'month'} onPress={() => setAllowPeriod('month')}>{ar ? 'شهرياً' : 'Per month'}</RPill>
          </View>
        )}
        onClose={() => setAllowFor(null)}
        onSave={async (v) => {
          try {
            if (v === null) await removeAllowance(id!, allowFor!.userId); else await setAllowance(id!, allowFor!.userId, v, allowPeriod);
            setAllowFor(null); await load('refresh');
          } catch (e) { Alert.alert(ar ? 'تعذّر' : 'Failed', e instanceof Error ? e.message : String(e)); }
        }}
      />
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
