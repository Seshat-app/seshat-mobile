import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch, hasToken } from './api';
import type { ApiCategory } from '../components/AddTransactionSheet';

type Profile = {
  displayName?: string;
  avatarUrl?: string;
  email: string;
  language: 'en' | 'ar';
  currency: string;
  monthlySalary?: number | null;
};

type Ctx = {
  categories: ApiCategory[];
  profile: Profile | null;
  refresh: () => Promise<void>;
  // Bump this counter to signal screens to refetch (e.g. after a new tx).
  dataVersion: number;
  bumpVersion: () => void;
};

const AppDataContext = createContext<Ctx | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  const refresh = useCallback(async () => {
    // The provider mounts before login, so skip silently when there's no
    // token yet — the tabs layout calls refresh() again on entry, and the
    // auth screens call it after a successful login/register.
    if (!(await hasToken())) return;
    try {
      const [catRes, meRes] = await Promise.all([
        apiFetch<{ data: ApiCategory[] }>('/categories'),
        apiFetch<{ data: Profile }>('/me'),
      ]);
      setCategories(catRes.data);
      setProfile(meRes.data);
    } catch (err) {
      console.warn('AppData refresh failed', err);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const bumpVersion = useCallback(() => setDataVersion((v) => v + 1), []);

  return (
    <AppDataContext.Provider value={{ categories, profile, refresh, dataVersion, bumpVersion }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData(): Ctx {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
  return ctx;
}
