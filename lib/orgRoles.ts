// Roles and kinds of shared workspaces, with the words each kind uses. The server (services/orgRoles.ts) enforces
// who may do what; this only decides what to show.
export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer' | 'child';
export type OrgKind = 'team' | 'family';

type L = { en: string; ar: string };
const TEAM: Record<OrgRole, L> = {
  owner: { en: 'Owner', ar: 'المالك' }, admin: { en: 'Admin', ar: 'مدير' }, member: { en: 'Member', ar: 'عضو' },
  viewer: { en: 'Viewer', ar: 'مشاهد' }, child: { en: 'Member', ar: 'عضو' },
};
const FAMILY: Record<OrgRole, L> = {
  owner: { en: 'Parent (owner)', ar: 'ولي الأمر (المالك)' }, admin: { en: 'Parent', ar: 'ولي أمر' }, member: { en: 'Adult', ar: 'بالغ' },
  viewer: { en: 'Viewer', ar: 'مشاهد' }, child: { en: 'Child', ar: 'طفل' },
};
export const roleLabel = (role: OrgRole, kind: OrgKind, ar: boolean): string => (kind === 'family' ? FAMILY : TEAM)[role][ar ? 'ar' : 'en'];

const HINT_TEAM: Record<OrgRole, L> = {
  owner: { en: 'Everything, including deleting the team', ar: 'كل شيء، بما فيه حذف الفريق' },
  admin: { en: 'Manages members and settings', ar: 'يدير الأعضاء والإعدادات' },
  member: { en: 'Logs and sees everything', ar: 'يسجّل ويرى كل شيء' },
  viewer: { en: 'Can look, cannot change anything', ar: 'يطّلع فقط ولا يغيّر شيئاً' },
  child: { en: '', ar: '' },
};
const HINT_FAMILY: Record<OrgRole, L> = {
  owner: { en: 'Everything, including deleting the household', ar: 'كل شيء، بما فيه حذف العائلة' },
  admin: { en: 'Manages members and settings', ar: 'يدير الأعضاء والإعدادات' },
  member: { en: 'Logs and sees everything shared', ar: 'يسجّل ويرى كل ما هو مشترك' },
  viewer: { en: 'Can look, cannot change anything', ar: 'يطّلع فقط ولا يغيّر شيئاً' },
  child: { en: 'Logs own spending, sees own entries and goals', ar: 'يسجّل مصروفه ويرى مدخلاته وأهداف العائلة' },
};
export const roleHint = (role: OrgRole, kind: OrgKind, ar: boolean): string => (kind === 'family' ? HINT_FAMILY : HINT_TEAM)[role][ar ? 'ar' : 'en'];

export const kindLabel = (kind: OrgKind, ar: boolean): string => (kind === 'family' ? (ar ? 'عائلة' : 'Family') : (ar ? 'فريق' : 'Team'));

export const isManager = (role?: OrgRole): boolean => role === 'owner' || role === 'admin';

/** Roles the person may give in an invite (never owner; only an owner may make admins; children only in a family). */
export function invitableRoles(actor: OrgRole | undefined, kind: OrgKind): OrgRole[] {
  if (!isManager(actor)) return [];
  const all: OrgRole[] = kind === 'family' ? ['admin', 'member', 'viewer', 'child'] : ['admin', 'member', 'viewer'];
  return actor === 'owner' ? all : all.filter((r) => r !== 'admin');
}

/** Whether `actor` may change a member from `current` to `next`. */
export function canAssignRole(actor: OrgRole | undefined, current: OrgRole, next: OrgRole): boolean {
  if (next === 'owner' || current === 'owner') return false;
  if (actor === 'owner') return true;
  if (actor === 'admin') return current !== 'admin' && next !== 'admin';
  return false;
}
export function canRemoveMember(actor: OrgRole | undefined, target: OrgRole): boolean {
  if (target === 'owner') return false;
  if (actor === 'owner') return true;
  if (actor === 'admin') return target !== 'admin';
  return false;
}
