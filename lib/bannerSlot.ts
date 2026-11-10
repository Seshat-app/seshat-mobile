import { useEffect, useSyncExternalStore } from 'react';

/**
 * Home shows ONE gentle banner at a time, the most important one that wants to be seen. Each banner registers
 * (key, priority) while it has something to say and only renders when it is the top one; dismissing it lets the
 * next one appear. This keeps Home calm instead of stacking four banners above the balance.
 */
const wants = new Map<string, number>();
const listeners = new Set<() => void>();
let version = 0;
const emit = () => { version += 1; listeners.forEach((l) => l()); };

function topKey(): string | null {
  let best: string | null = null;
  let bestP = -Infinity;
  for (const [k, p] of wants) if (p > bestP) { best = k; bestP = p; }
  return best;
}

export function useBannerSlot(key: string, priority: number, wantsSlot: boolean): boolean {
  useEffect(() => {
    if (wantsSlot) wants.set(key, priority); else wants.delete(key);
    emit();
    return () => { wants.delete(key); emit(); };
  }, [key, priority, wantsSlot]);
  useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => version);
  return wantsSlot && topKey() === key;
}
