import { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Briefcase, ChevronDown, ChevronRight, Plus, User as UserIcon, X, Check, Building2 } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { useAppData, type WorkspaceSummary } from '../lib/appData';
import { fontBody, fontHead, fontMono } from '../lib/fonts';

/**
 * Tiny persistent pill showing the user's current workspace. Tap to summon
 * the WorkspaceSheet from anywhere. Designed to live in screen headers
 * (PlanScreen, the home dashboard top bar, etc.) so the user always knows
 * which ledger their data is filtered by, and can switch in one tap.
 */
export function WorkspaceChip() {
  const { tok, lang } = useI18n();
  const { workspaces, activeLedgerId, openWorkspaceSheet, profile } = useAppData();
  if (!profile) return null;

  const active = workspaces.find(
    (w) => (activeLedgerId ? w.ledgerId === activeLedgerId : w.kind === 'personal'),
  ) ?? workspaces[0];
  if (!active) return null;

  const isOrg = active.kind === 'org';
  return (
    <Pressable
      onPress={openWorkspaceSheet}
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', gap: 6,
        paddingHorizontal: 10, paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: pressed ? tok.elevated : tok.surface,
        borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
        maxWidth: 180,
      })}
    >
      {isOrg
        ? <Building2 size={12} color={tok.gold} strokeWidth={2} />
        : <UserIcon size={12} color={tok.gold} strokeWidth={2} />}
      <Text
        numberOfLines={1}
        style={{
          fontFamily: fontBody(lang, 'medium'), fontSize: 12, color: tok.bone,
          maxWidth: 120,
        }}
      >
        {active.name}
      </Text>
      <ChevronDown size={12} color={tok.muted} />
    </Pressable>
  );
}

/**
 * Compact "current workspace" badge shown at the top of the Profile screen.
 * Tapping opens the WorkspaceSheet for switching or creating an org.
 *
 * For users with no orgs (the common case at launch), this still renders
 * "Personal" with a friendly hint - the sheet has the Create button so the
 * first conversion happens here.
 */
export function WorkspaceCard({ onPress }: { onPress: () => void }) {
  const { tok, lang } = useI18n();
  const { profile, workspaces, activeLedgerId } = useAppData();

  const active = workspaces.find(
    (w) => (activeLedgerId ? w.ledgerId === activeLedgerId : w.kind === 'personal'),
  ) ?? workspaces[0];
  if (!active || !profile) return null;

  const isOrg = active.kind === 'org';
  const label = isOrg
    ? (lang === 'ar' ? `${active.name} · ${active.memberCount ?? 1} أعضاء` : `${active.name} · ${active.memberCount ?? 1} members`)
    : (lang === 'ar' ? 'حسابك الشخصي' : 'Your personal ledger');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        marginTop: 18,
        borderRadius: 14,
        backgroundColor: tok.surface,
        borderWidth: StyleSheet.hairlineWidth, borderColor: tok.border,
        paddingVertical: 14, paddingHorizontal: 14,
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', gap: 12,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{
        width: 38, height: 38, borderRadius: 10,
        backgroundColor: tok.elevated,
        alignItems: 'center', justifyContent: 'center',
      }}>
        {isOrg
          ? <Building2 size={18} color={tok.gold} strokeWidth={1.6} />
          : <UserIcon size={18} color={tok.gold} strokeWidth={1.6} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{
          fontFamily: fontMono('regular'), fontSize: 9, color: tok.muted, letterSpacing: 1.4,
          textAlign: lang === 'ar' ? 'right' : 'left',
        }}>
          {lang === 'ar' ? 'مساحة العمل' : 'WORKSPACE'}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            marginTop: 2,
            fontFamily: fontBody(lang, 'semibold'), fontSize: 15, color: tok.bone,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}
        >
          {active.name}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            marginTop: 2,
            fontFamily: fontBody(lang), fontSize: 12, color: tok.muted,
            textAlign: lang === 'ar' ? 'right' : 'left',
          }}
        >
          {label}
        </Text>
      </View>
      <ChevronRight
        size={18} color={tok.muted}
        style={{ transform: [{ scaleX: lang === 'ar' ? -1 : 1 }] }}
      />
    </Pressable>
  );
}

/**
 * Bottom sheet listing all workspaces the user can switch to + a CTA to
 * create a new organization. Selecting a row calls AppData.switchLedger
 * (which updates the X-Ledger-Id header and persists the choice server-
 * side via /me/active-ledger).
 */
export function WorkspaceSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { tok, lang } = useI18n();
  const router = useRouter();
  const { workspaces, activeLedgerId, switchLedger } = useAppData();
  const [switching, setSwitching] = useState<string | null>(null);

  const pick = async (w: WorkspaceSummary) => {
    // workspaces[].ledgerId is now always populated for both personal and
    // org entries (the server sends `personalLedgerId` on every /me). If
    // somehow it's missing, fall back to clearing the in-memory header so
    // the next request defaults to the personal ledger - but DON'T close
    // the sheet without doing the round-trip, or the UI stays on the org.
    if (!w.ledgerId) {
      const { setActiveLedger } = await import('../lib/api');
      setActiveLedger(null);
      onClose();
      return;
    }
    setSwitching(w.ledgerId);
    try {
      await switchLedger(w.ledgerId);
      onClose();
    } finally {
      setSwitching(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#000A' }} onPress={onClose}>
        <View style={{ flex: 1 }} />
      </Pressable>
      <View style={{
        backgroundColor: tok.surface,
        borderTopLeftRadius: 22, borderTopRightRadius: 22,
        paddingHorizontal: 18, paddingTop: 18, paddingBottom: 32,
        gap: 6,
      }}>
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <Text style={{
            fontFamily: fontHead(lang), fontSize: 18, color: tok.bone, letterSpacing: -0.3,
          }}>
            {lang === 'ar' ? 'تبديل مساحة العمل' : 'Switch workspace'}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color={tok.muted} />
          </Pressable>
        </View>

        <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
          {workspaces.map((w) => {
            // Active when its ledger id matches AppData.activeLedgerId, OR
            // when it's the Personal entry and there's no active set (which
            // means we're defaulting to personal).
            const isActive =
              (activeLedgerId && w.ledgerId === activeLedgerId) ||
              (!activeLedgerId && w.kind === 'personal');
            return (
              <Pressable
                key={`${w.kind}-${w.ledgerId || w.name}`}
                onPress={() => !isActive && pick(w)}
                disabled={switching !== null}
                style={({ pressed }) => ({
                  borderRadius: 12, marginBottom: 6,
                  paddingVertical: 12, paddingHorizontal: 14,
                  flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                  alignItems: 'center', gap: 12,
                  backgroundColor: isActive ? tok.elevated : 'transparent',
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: isActive ? tok.border : 'transparent',
                  opacity: pressed && !isActive ? 0.7 : 1,
                })}
              >
                <View style={{
                  width: 32, height: 32, borderRadius: 8,
                  backgroundColor: tok.elevated,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {w.kind === 'org'
                    ? <Building2 size={16} color={isActive ? tok.gold : tok.bone} strokeWidth={1.6} />
                    : <UserIcon size={16} color={isActive ? tok.gold : tok.bone} strokeWidth={1.6} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: fontBody(lang, isActive ? 'semibold' : 'medium'),
                      fontSize: 14, color: tok.bone,
                      textAlign: lang === 'ar' ? 'right' : 'left',
                    }}
                  >
                    {w.name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      marginTop: 2,
                      fontFamily: fontBody(lang), fontSize: 11, color: tok.muted,
                      textAlign: lang === 'ar' ? 'right' : 'left',
                    }}
                  >
                    {w.kind === 'org'
                      ? (lang === 'ar'
                        ? `${w.role === 'owner' ? 'مالك' : 'عضو'} · ${w.memberCount ?? 1} عضو`
                        : `${w.role === 'owner' ? 'Owner' : 'Member'} · ${w.memberCount ?? 1} members`)
                      : (lang === 'ar' ? 'حسابك الشخصي' : 'Your personal ledger')}
                  </Text>
                </View>
                {isActive && <Check size={16} color={tok.gold} />}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Org management entry points */}
        <View style={{
          marginTop: 12, paddingTop: 12,
          borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tok.border,
          gap: 8,
        }}>
          <SheetAction
            icon={<Briefcase size={16} color={tok.bone} />}
            label={lang === 'ar' ? 'إدارة المنظمات' : 'Manage organizations'}
            onPress={() => { onClose(); router.push('/orgs'); }}
            tok={tok}
            lang={lang}
          />
          <SheetAction
            icon={<Plus size={16} color={tok.gold} />}
            label={lang === 'ar' ? 'إنشاء منظمة جديدة' : 'Create new organization'}
            onPress={() => { onClose(); router.push('/orgs/new'); }}
            tok={tok}
            lang={lang}
            highlight
          />
        </View>
      </View>
    </Modal>
  );
}

function SheetAction({
  icon, label, onPress, tok, lang, highlight,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  tok: ReturnType<typeof useI18n>['tok'];
  lang: 'en' | 'ar';
  highlight?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: 10,
        paddingVertical: 12, paddingHorizontal: 12,
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', gap: 10,
        backgroundColor: pressed ? tok.elevated : 'transparent',
      })}
    >
      {icon}
      <Text style={{
        flex: 1,
        fontFamily: fontBody(lang, highlight ? 'semibold' : 'medium'),
        fontSize: 14, color: highlight ? tok.gold : tok.bone,
        textAlign: lang === 'ar' ? 'right' : 'left',
      }}>
        {label}
      </Text>
    </Pressable>
  );
}
