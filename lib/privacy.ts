/**
 * "Hide numbers" privacy mode: every amount in the app shows as •••• until you turn it off, so you can open
 * Seshat in public without anyone reading your balance. A tiny module store (no provider) so it works from
 * anywhere and re-renders subscribers; persisted so it survives a restart.
 */
import { useSyncExternalStore } from 'react';

import { secureGet, secureSet } from './secure';
const KEY = 'hide_numbers';
export const MASK = '••••';

let hidden = false;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

export const isHidden = (): boolean => hidden;

export function setHideNumbers(next: boolean): void {
  if (hidden === next) return;
  hidden = next;
  notify();
  secureSet(KEY, next ? '1' : '0').catch(() => {});
}

export const toggleHideNumbers = (): void => setHideNumbers(!hidden);

/** Read the saved choice once at startup. */
export async function loadHideNumbers(): Promise<void> {
  try {
    const v = await secureGet(KEY);
    if (v === '1' && !hidden) { hidden = true; notify(); }
  } catch { /* keep the default (shown) */ }
}

export function useHideNumbers(): boolean {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    () => hidden,
  );
}

/** The text to show for an already-formatted number. */
export const money = (formatted: string): string => (hidden ? MASK : formatted);

/** Locale-formatted whole/decimal number, masked when numbers are hidden. */
export const fmtNum = (n: number): string => (hidden ? MASK : n.toLocaleString());
