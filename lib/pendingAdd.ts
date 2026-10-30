// "Add" requests that arrive from outside the tab screens (the home-screen widget's
// seshat://add?mode=... links). app/add.tsx records the request and sends the user to the
// tabs; the tabs layout, which owns the add sheet, picks it up here.
export type AddMode = 'manual' | 'receipt';

let pending: AddMode | null = null;
const listeners = new Set<() => void>();

export function requestAdd(mode: AddMode): void {
  pending = mode;
  listeners.forEach((l) => l());
}

export function takePendingAdd(): AddMode | null {
  const mode = pending;
  pending = null;
  return mode;
}

export function onPendingAdd(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
