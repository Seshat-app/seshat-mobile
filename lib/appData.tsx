import type { OrgRole, OrgKind } from './orgRoles';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { apiFetch, hasToken, setActiveLedger, getActiveLedger } from './api';
import { registerForPushNotifications, subscribeToNotificationTaps } from './push';
import { usePendingCapture } from './pendingCapture';
import { syncAndroidWidgets } from './androidWidgets';
import { onDataChanged } from './dataEvents';
import type { ApiCategory } from '../components/AddTransactionSheet';

type Profile = {
  displayName?: string;
  displayNameAr?: string;
  avatarUrl?: string;
  email: string;
  language: 'en' | 'ar';
  currency: string;
  monthlySalary?: number | null;
  // The day the user's financial month begins (1-31). null = never set, which
  // is what the "finish setup" prompt keys off; the period maths treat it as 1.
  monthStartDay?: number | null;
  // The workspace the user last switched to. `u_<userId>` for personal,
  // `o_<orgId>` for an organization. Mobile uses this to restore state on
  // app launch so the user lands back in the workspace they left.
  activeLedgerId?: string;
  // The user's personal ledger id (always `u_<logtoId>`). The server sends
  // it on every /me, even while activeLedgerId points to an org, so we can
  // build the "Switch back to personal" entry with a real id.
  personalLedgerId?: string;
};

export type WorkspaceSummary = {
  // Always present: a synthetic personal workspace entry sits at the top of
  // the switcher list. For personal it's derived from the user's logtoId.
  ledgerId: string;
  name: string;
  kind: 'personal' | 'org';
  // Only populated for orgs.
  orgId?: string;
  role?: OrgRole;
  // team or family, for an organization workspace.
  orgKind?: OrgKind;
  memberCount?: number;
  currency?: string;
};

export type ApiProject = {
  _id: string;
  ledgerId: string;
  name: string;
  currency: string;
  status: 'active' | 'archived';
  budget?: number;
  color?: string;
  description?: string;
  /** 'restricted': only the listed members, owners and admins see this project and its entries. */
  visibility?: 'all' | 'restricted';
  memberIds?: string[];
};

type Ctx = {
  categories: ApiCategory[];
  // Projects scoped to the currently active ledger. Empty array on personal
  // ledgers (no projects there in v1) and on initial load. Reloaded on
  // ledger switch and after project mutations via refreshProjects().
  projects: ApiProject[];
  profile: Profile | null;
  workspaces: WorkspaceSummary[];
  activeLedgerId: string | null;
  switchLedger: (ledgerId: string) => Promise<void>;
  refresh: () => Promise<void>;
  refreshProjects: () => Promise<void>;
  // Bump this counter to signal screens to refetch (e.g. after a new tx).
  dataVersion: number;
  bumpVersion: () => void;
  // Workspace sheet visibility lives in context so any screen can summon
  // the switcher (header chip, FAB long-press, deep-link landing, etc.)
  // without lifting state through 4 layers of components.
  workspaceSheetOpen: boolean;
  openWorkspaceSheet: () => void;
  closeWorkspaceSheet: () => void;
  // Total unread Seshat messages across all sessions. Set by the seshat
  // session-list screen after each fetch so the tab bar can show a badge.
  unreadMaatTotal: number;
  setUnreadMaatTotal: (n: number) => void;
};

const AppDataContext = createContext<Ctx | null>(null);

type OrgListItem = {
  id: string;
  name: string;
  slug: string;
  kind?: OrgKind;
  currency: string;
  ledgerId: string;
  role: OrgRole;
  memberCount: number;
};

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orgs, setOrgs] = useState<OrgListItem[]>([]);
  const [activeLedgerId, setActiveLedgerIdState] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [workspaceSheetOpen, setWorkspaceSheetOpen] = useState(false);
  const [unreadMaatTotal, setUnreadMaatTotal] = useState(0);

  // Projects only exist on org ledgers in v1. We fetch once at the right
  // moment (refresh + ledger switch + after a mutation calls
  // refreshProjects()) rather than on every render that touches them.
  const refreshProjects = useCallback(async () => {
    const ledger = getActiveLedger();
    if (!ledger || !ledger.startsWith('o_')) {
      setProjects([]);
      return;
    }
    try {
      const res = await apiFetch<{ data: ApiProject[] }>('/projects?status=active');
      setProjects(res.data ?? []);
    } catch (err) {
      console.warn('refreshProjects failed', err);
      setProjects([]);
    }
  }, []);

  const buildWorkspaces = useCallback((p: Profile | null, orgList: OrgListItem[]): WorkspaceSummary[] => {
    if (!p) return [];
    // Personal entry is synthesized client-side - server doesn't have a row.
    // We prefer the explicit `personalLedgerId` from /me (always present),
    // falling back to `activeLedgerId` when it happens to be a `u_` value.
    // The Personal entry is always at the top.
    const personal: WorkspaceSummary = {
      ledgerId: p.personalLedgerId
        ?? (p.activeLedgerId?.startsWith('u_') ? p.activeLedgerId : ''),
      name: p.displayName ?? p.email.split('@')[0],
      kind: 'personal',
      currency: p.currency,
    };
    const orgEntries: WorkspaceSummary[] = orgList.map((o) => ({
      ledgerId: o.ledgerId,
      name: o.name,
      kind: 'org',
      orgId: o.id,
      role: o.role,
      orgKind: o.kind ?? 'team',
      memberCount: o.memberCount,
      currency: o.currency,
    }));
    return [personal, ...orgEntries];
  }, []);

  const refresh = useCallback(async () => {
    // The provider mounts before login, so skip silently when there's no
    // token yet. Tabs layout calls refresh() again on entry; the auth screens
    // call it after a successful sign-in.
    if (!(await hasToken())) return;
    try {
      const [catRes, meRes, orgsRes] = await Promise.all([
        apiFetch<{ data: ApiCategory[] }>('/categories'),
        apiFetch<{ data: Profile }>('/me'),
        apiFetch<{ data: OrgListItem[] }>('/orgs'),
      ]);
      setCategories(catRes.data);
      setProfile(meRes.data);
      setOrgs(orgsRes.data ?? []);
      // Restore the user's last-active workspace on first load. If they had
      // an org workspace active and they're still a member of it, point the
      // active ledger header there; otherwise fall back to personal.
      const serverActive = meRes.data.activeLedgerId;
      const orgMatch = orgsRes.data?.find((o) => o.ledgerId === serverActive);
      const next = serverActive && (serverActive.startsWith('u_') || orgMatch)
        ? serverActive
        : null;
      const orgOf = (x: string | null | undefined) => (x && x.startsWith('o_') ? x : null);
      const before = orgOf(getActiveLedger());
      setActiveLedger(next);
      setActiveLedgerIdState(next);
      // Launching straight into a shared workspace: the screens (and the categories above) asked for data before this
      // workspace was known, so they showed the personal ledger under the household's name. Load them again for it.
      if (before !== orgOf(next)) {
        apiFetch<{ data: ApiCategory[] }>('/categories').then((r) => setCategories(r.data)).catch(() => {});
        setDataVersion((v) => v + 1);
      }

      // Pull projects whenever we've resolved the active ledger. The helper
      // is a no-op on personal ledgers, so this is cheap to call here.
      void refreshProjects();

      // Fire-and-forget push registration. We only call this once we know
      // the user is signed in (refresh() short-circuits on no token above).
      // The helper is idempotent + cached, so calling on every refresh is
      // fine - real work only happens on first call per session.
      void registerForPushNotifications();
    } catch (err) {
      console.warn('AppData refresh failed', err);
    }
  }, [refreshProjects]);

  // Persist + apply a workspace switch. Server updates User.activeLedgerId
  // so future app launches restore the same workspace. The PATCH is
  // optimistic - we change the in-memory header first so the next render
  // talks to the right ledger, then send the persist call.
  const switchLedger = useCallback(async (ledgerId: string) => {
    setActiveLedger(ledgerId);
    setActiveLedgerIdState(ledgerId);
    try {
      await apiFetch('/me/active-ledger', {
        method: 'POST',
        body: JSON.stringify({ ledgerId }),
      });
    } catch (err) {
      console.warn('persist active ledger failed', err);
    }
    // Trigger downstream refetches in screens listening to dataVersion.
    setDataVersion((v) => v + 1);
    // Also reload categories + profile for the new workspace context.
    await refresh();
  }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  // Wire the notification tap -> deep-link bridge once at provider mount.
  // The push payload tells us which (ledgerId, categoryId) the reminder was
  // for; we route to the transactions tab where the user can add the entry.
  // Future: pop the AddTransactionSheet pre-filled with the category.
  useEffect(() => {
    return subscribeToNotificationTaps(
      ({ ledgerId }) => {
        if (ledgerId) {
          setActiveLedger(ledgerId);
          setActiveLedgerIdState(ledgerId);
        }
        router.replace('/(tabs)/transactions');
      },
      ({ sessionId }) => {
        router.push(`/seshat/${sessionId}`);
      },
    );
  }, []);

  // Keeps the capture-only device token fresh. iOS (Shortcuts action) and Android
  // (notification-listener task, see index.js) both log bank messages with it.
  usePendingCapture();

  const bumpVersion = useCallback(() => setDataVersion((v) => v + 1), []);

  // Android widgets: hand them the token + language and have them redraw (opening the app, a language
  // change or any data change). No-op on iPhone.
  useEffect(() => {
    if (profile?.language) void syncAndroidWidgets(profile.language);
  }, [profile?.language, dataVersion]);

  // Writes made outside a screen (chat, voice, background capture) announce themselves here.
  useEffect(() => onDataChanged(bumpVersion), [bumpVersion]);

  const openWorkspaceSheet = useCallback(() => setWorkspaceSheetOpen(true), []);
  const closeWorkspaceSheet = useCallback(() => setWorkspaceSheetOpen(false), []);

  const workspaces = useMemo(() => buildWorkspaces(profile, orgs), [buildWorkspaces, profile, orgs]);

  const ctxValue = useMemo(() => ({
    categories,
    projects,
    profile,
    workspaces,
    activeLedgerId: activeLedgerId ?? getActiveLedger(),
    switchLedger,
    refresh,
    refreshProjects,
    dataVersion,
    bumpVersion,
    workspaceSheetOpen,
    openWorkspaceSheet,
    closeWorkspaceSheet,
    unreadMaatTotal,
    setUnreadMaatTotal,
  }), [
    categories,
    projects,
    profile,
    workspaces,
    activeLedgerId,
    switchLedger,
    refresh,
    refreshProjects,
    dataVersion,
    bumpVersion,
    workspaceSheetOpen,
    openWorkspaceSheet,
    closeWorkspaceSheet,
    unreadMaatTotal,
    setUnreadMaatTotal,
  ]);

  return (
    <AppDataContext.Provider value={ctxValue}>
      {children}
    </AppDataContext.Provider>
  );
}

/**
 * What the person is allowed to do in the workspace that is open: their role and what kind of workspace it is. In a
 * personal ledger everything is allowed. (The server enforces it; this decides what to show.)
 */
export function useWorkspace(): { inOrg: boolean; role?: OrgRole; kind?: OrgKind; canWrite: boolean; isChild: boolean; isViewer: boolean; canManage: boolean } {
  const { activeLedgerId, workspaces } = useAppData();
  const inOrg = !!activeLedgerId && activeLedgerId.startsWith('o_');
  const w = inOrg ? workspaces.find((x) => x.ledgerId === activeLedgerId) : undefined;
  const role = w?.role;
  return {
    inOrg, role, kind: w?.orgKind,
    canWrite: !inOrg || role !== 'viewer',
    isChild: inOrg && role === 'child',
    isViewer: inOrg && role === 'viewer',
    canManage: !inOrg || role === 'owner' || role === 'admin',
  };
}

/** True while an organization workspace is active. Gam3yas, savings, the daily budget and bills belong to the personal profile only. */
export function useInOrg(): boolean {
  const { activeLedgerId } = useAppData();
  return !!activeLedgerId && activeLedgerId.startsWith('o_');
}

export function useAppData(): Ctx {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
  return ctx;
}
