import { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Briefcase, ChevronDown, ChevronRight, Plus, User as UserIcon, X, Check, Building2 } from 'lucide-react-native';
import { useI18n } from '../lib/i18n';
import { useAppData, type WorkspaceSummary } from '../lib/appData';
import { fontBody, fontHead, fontMono } from '../lib/fonts';
import { RCard, RButton } from './ui';

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
      hitSlop={8}
      style={({ pressed }) => ({
        flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
        alignItems: 'center', gap: 7,
        paddingHorizontal: 12, paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: tok.glowShellBg,
        borderWidth: 1,
        borderColor: tok.glowShellBorder,
        opacity: pressed ? 0.85 : 1,
        alignSelf: 'flex-start',
      })}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tok.gold }} />
      <Text
        numberOfLines={1}
        style={{
          fontFamily: fontMono('regular'), fontSize: 11,
          letterSpacing: 1.2, textTransform: 'uppercase',
          color: tok.gold, maxWidth: 130,
        }}
      >
        {active.name}
      </Text>
      <ChevronDown size={10} color={tok.gold} strokeWidth={2} />
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
    <RCard padding={0} style={{ marginTop: 18 }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
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
              writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
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
              writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
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
    </RCard>
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
  const insets = useSafeAreaInsets();
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
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)' }} onPress={onClose}>
        <View style={{ flex: 1 }} />
      </Pressable>
      <View style={{
        backgroundColor: tok.surface,
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        paddingHorizontal: 18, paddingTop: 12, paddingBottom: 24 + insets.bottom,
        gap: 6,
      }}>
        <View style={{
          alignSelf: 'center', width: 36, height: 4, borderRadius: 999,
          backgroundColor: tok.border, marginBottom: 12,
        }} />
        <View style={{
          flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
          alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <Text style={{
            fontFamily: fontHead(lang), fontSize: 18, color: tok.bone, letterSpacing: -0.3,
            writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
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
            const isSwitching = switching !== null && switching === w.ledgerId;
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
                  backgroundColor: isActive ? tok.glowShellBg : 'transparent',
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: isActive ? tok.glowShellBorder : 'transparent',
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
                      writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
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
                      writingDirection: lang === 'ar' ? 'rtl' : 'ltr',
                    }}
                  >
                    {w.kind === 'org'
                      ? (lang === 'ar'
                        ? `${w.role === 'owner' ? 'مالك' : 'عضو'} · ${w.memberCount ?? 1} عضو`
                        : `${w.role === 'owner' ? 'Owner' : 'Member'} · ${w.memberCount ?? 1} members`)
                      : (lang === 'ar' ? 'حسابك الشخصي' : 'Your personal ledger')}
                  </Text>
                </View>
                {isSwitching
                  ? <ActivityIndicator size="small" color={tok.gold} />
                  : isActive && <Check size={16} color={tok.gold} />}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Org management entry points */}
        <View style={{
          marginTop: 12, paddingTop: 12,
          borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tok.border,
          gap: 10,
        }}>
          <RButton
            variant="primary"
            full
            icon={<Plus size={16} color={tok.void} />}
            onPress={() => { onClose(); router.push('/orgs/new'); }}
          >
            {lang === 'ar' ? 'إنشاء منظمة جديدة' : 'Create new organization'}
          </RButton>
          <RButton
            variant="secondary"
            full
            icon={<Briefcase size={16} color={tok.bone} />}
            onPress={() => { onClose(); router.push('/orgs'); }}
          >
            {lang === 'ar' ? 'إدارة المنظمات' : 'Manage organizations'}
          </RButton>
        </View>
      </View>
    </Modal>
  );
}
