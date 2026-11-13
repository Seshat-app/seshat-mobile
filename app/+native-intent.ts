/**
 * Links to https://seshat.site open the app when it is installed (Android App Links, iPhone universal links). The
 * website and the app do not use the same paths, so this maps a website path to the matching screen before the router
 * sees it. Anything that is not a seshat.site web link (seshat:// links, widget links, plain paths) passes through.
 */
const SCREENS: Record<string, string> = {
  '': '/',
  chat: '/(tabs)/seshat',
  transactions: '/(tabs)/transactions',
  settings: '/(tabs)/profile',
  goals: '/goals',
  budgets: '/budgets',
  debts: '/debts',
  reminders: '/reminders',
  habits: '/habits',
  cards: '/cards',
  savings: '/savings',
  gam3ya: '/gam3ya',
  community: '/community',
  reports: '/reports/monthly',
  workspaces: '/orgs',
  categories: '/categories',
};
const WITH_ID = new Set(['cards', 'savings', 'gam3ya', 'community']);

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (!/^https?:\/\//i.test(path)) return path;
  try {
    const url = new URL(path);
    if (!/(^|\.)seshat\.site$/i.test(url.hostname)) return path;
    const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
    // An organization invitation from an email: /orgs/accept?token=...
    if (parts[0] === 'orgs' && parts[1] === 'accept') return `/orgs/accept${url.search}`;
    if (parts[0] !== 'app') return '/';
    const section = parts[1] ?? '';
    if (WITH_ID.has(section) && parts[2]) return `/${section}/${parts[2]}`;
    return SCREENS[section] ?? '/';
  } catch {
    return path;
  }
}
