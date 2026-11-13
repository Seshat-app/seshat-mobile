import { useSyncExternalStore } from 'react';

/** Whether the Terms prompt is still waiting for an answer. `null` until it has been checked. */
let pending: boolean | null = null;
const subs = new Set<() => void>();
export function setTermsPending(v: boolean): void { pending = v; subs.forEach((f) => f()); }
export function useTermsPending(): boolean | null {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => pending);
}
