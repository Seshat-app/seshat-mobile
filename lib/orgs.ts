// Thin API client for /api/v1/orgs/*. The server enforces membership and
// role checks; this file just types the request/response shapes.

import { apiFetch, newIdempotencyKey } from './api';

export type OrgRole = 'owner' | 'member';

export type OrgSummary = {
  id: string;
  name: string;
  slug: string;
  currency: string;
  ledgerId: string;
  role: OrgRole;
  memberCount: number;
  telegramLinked: boolean;
};

export type OrgDetail = OrgSummary & {
  createdAt: string;
};

export type OrgMember = {
  userId: string;
  email?: string;
  displayName?: string | null;
  avatarUrl?: string;
  role: OrgRole;
  joinedAt: string;
};

export type OrgInvite = {
  id: string;
  email: string;
  expiresAt: string;
  createdAt: string;
};

export async function listOrgs(): Promise<OrgSummary[]> {
  const r = await apiFetch<{ data: OrgSummary[] }>('/orgs');
  return r.data ?? [];
}

export async function createOrg(
  name: string,
  currency?: string,
): Promise<{ id: string; ledgerId: string; name: string; slug: string; currency: string }> {
  const r = await apiFetch<{ data: { id: string; ledgerId: string; name: string; slug: string; currency: string } }>(
    '/orgs',
    {
      method: 'POST',
      body: JSON.stringify({ name, currency }),
      idempotencyKey: newIdempotencyKey(),
    },
  );
  return r.data;
}

export async function getOrg(id: string): Promise<OrgDetail> {
  const r = await apiFetch<{ data: OrgDetail }>(`/orgs/${id}`);
  return r.data;
}

export async function renameOrg(id: string, name: string): Promise<OrgDetail> {
  const r = await apiFetch<{ data: OrgDetail }>(`/orgs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
  return r.data;
}

export async function deleteOrg(id: string): Promise<void> {
  await apiFetch(`/orgs/${id}`, { method: 'DELETE' });
}

export async function listMembers(orgId: string): Promise<OrgMember[]> {
  const r = await apiFetch<{ data: OrgMember[] }>(`/orgs/${orgId}/members`);
  return r.data ?? [];
}

export async function removeMember(orgId: string, userId: string): Promise<void> {
  await apiFetch(`/orgs/${orgId}/members/${userId}`, { method: 'DELETE' });
}

export async function leaveOrg(orgId: string): Promise<void> {
  await apiFetch(`/orgs/${orgId}/leave`, { method: 'POST' });
}

export async function sendInvite(orgId: string, email: string): Promise<OrgInvite> {
  const r = await apiFetch<{ data: OrgInvite }>(`/orgs/${orgId}/invites`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  return r.data;
}

export async function listInvites(orgId: string): Promise<OrgInvite[]> {
  const r = await apiFetch<{ data: OrgInvite[] }>(`/orgs/${orgId}/invites`);
  return r.data ?? [];
}

export async function revokeInvite(orgId: string, inviteId: string): Promise<void> {
  await apiFetch(`/orgs/${orgId}/invites/${inviteId}`, { method: 'DELETE' });
}

export async function acceptInvite(token: string): Promise<OrgSummary & { role: OrgRole }> {
  const r = await apiFetch<{ data: OrgSummary & { role: OrgRole } }>(
    '/orgs/invites/accept',
    {
      method: 'POST',
      body: JSON.stringify({ token }),
    },
  );
  return r.data;
}

export async function mintTelegramOrgLinkToken(orgId: string): Promise<{
  token: string;
  command: string;
  deepLink: string;
  expiresAt: number;
}> {
  const r = await apiFetch<{ data: { token: string; command: string; deepLink: string; expiresAt: number } }>(
    `/me/orgs/${orgId}/telegram-link-token`,
    { method: 'POST' },
  );
  return r.data;
}
