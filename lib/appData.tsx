import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch, hasToken, setActiveLedger, getActiveLedger } from './api';
import type { ApiCategory } from '../components/AddTransactionSheet';

type Profile = {
  displayName?: string;
  avatarUrl?: string;
  email: string;
  language: 'en' | 'ar';
  currency: string;
  monthlySalary?: number | null;
  // The workspace the user last switched to. `u_<userId>` for personal,
  // `o_<orgId>` for an organization. Mobile uses this to restore state on
  // app launch so the user lands back in the workspace they left.
  activeLedgerId?: string;
};

export type WorkspaceSummary = {
  // Always present: a synthetic personal workspace entry sits at the top of
  // the switcher list. For personal it's derived from the user's logtoId.
  ledgerId: string;
  name: string;
  kind: 'personal' | 'org';
  // Only populated for orgs.
  orgId?: string;
  role?: 'owner' | 'member';
  memberCount?: number;
  currency?: string;
};

type Ctx = {
  categories: ApiCategory[];
  profile: Profile | null;
  workspaces: WorkspaceSummary[];
  activeLedgerId: string | null;
  switchLedger: (ledgerId: string) => Promise<void>;
  refresh: () => Promise<void>;
  // Bump this counter to signal screens to refetch (e.g. after a new tx).
  dataVersion: number;
  bumpVersion: () => void;
};

const AppDataContext = createContext<Ctx | null>(null);

type OrgListItem = {
  id: string;
  name: string;
  slug: string;
  currency: string;
  ledgerId: string;
  role: 'owner' | 'member';
  memberCount: number;
};

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orgs, setOrgs] = useState<OrgListItem[]>([]);
  const [activeLedgerId, setActiveLedgerIdState] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  const buildWorkspaces = useCallback((p: Profile | null, orgList: OrgListItem[]): WorkspaceSummary[] => {
    if (!p) return [];
    // Personal entry is synthesized client-side - server doesn't have a row.
    // We derive its ledgerId from the user's email prefix... actually no,
    // the server tells us via activeLedgerId. Easier: use the profile's
    // activeLedgerId pattern. The Personal entry is always at the top.
    const personal: WorkspaceSummary = {
      ledgerId: p.activeLedgerId?.startsWith('u_')
        ? p.activeLedgerId
        // Best-effort fallback: the server uses `u_<logtoId>` and we don't
        // ship logtoId on the profile. Send no header (null) for "default".
        : '',
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
      setActiveLedger(next);
      setActiveLedgerIdState(next);
    } catch (err) {
      console.warn('AppData refresh failed', err);
    }
  }, []);

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

  const bumpVersion = useCallback(() => setDataVersion((v) => v + 1), []);

  const workspaces = buildWorkspaces(profile, orgs);

  return (
    <AppDataContext.Provider value={{
      categories,
      profile,
      workspaces,
      activeLedgerId: activeLedgerId ?? getActiveLedger(),
      switchLedger,
      refresh,
      dataVersion,
      bumpVersion,
    }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData(): Ctx {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
  return ctx;
}
