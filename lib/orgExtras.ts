// Client for the team and family extras: approvals, member limits, allowances. The server decides who may do what.
import { apiFetch } from './api';

export type Approval = {
  id: string; amount: number; currency: string; description: string; notes: string; date: string;
  category?: { nameEn?: string; nameAr?: string; emoji?: string } | null; by: string; byUserId: string; createdAt: string;
};
export type AllowanceStatus = { amount: number; period: 'week' | 'month'; spent: number; left: number; over: boolean; usedPct: number; periodStart: string; periodEnd: string };
export type ChildAllowance = AllowanceStatus & { childId: string };

export const listApprovals = (orgId: string) => apiFetch<{ data: Approval[] }>(`/orgs/${orgId}/approvals`).then((r) => r.data);
export const decideApproval = (orgId: string, txId: string, decision: 'approve' | 'reject', note?: string) =>
  apiFetch(`/orgs/${orgId}/approvals/${txId}`, { method: 'POST', body: JSON.stringify({ decision, note }) });
export const setApprovalThreshold = (orgId: string, amount: number | null) =>
  apiFetch(`/orgs/${orgId}`, { method: 'PATCH', body: JSON.stringify({ approvalThreshold: amount }) });
export const setMemberLimit = (orgId: string, userId: string, limit: number | null) =>
  apiFetch(`/orgs/${orgId}/members/${userId}`, { method: 'PATCH', body: JSON.stringify({ monthlyLimit: limit }) });
export const listAllowances = (orgId: string) => apiFetch<{ data: ChildAllowance[] }>(`/orgs/${orgId}/allowances`).then((r) => r.data);
export const setAllowance = (orgId: string, childId: string, amount: number, period: 'week' | 'month') =>
  apiFetch(`/orgs/${orgId}/allowances/${childId}`, { method: 'PUT', body: JSON.stringify({ amount, period }) });
export const removeAllowance = (orgId: string, childId: string) => apiFetch(`/orgs/${orgId}/allowances/${childId}`, { method: 'DELETE' });
export const myAllowance = (orgId: string) => apiFetch<{ data: AllowanceStatus | null }>(`/orgs/${orgId}/allowance/me`).then((r) => r.data);
