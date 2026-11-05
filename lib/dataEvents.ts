/**
 * "Data changed" channel that needs no React provider, so it also works from the Android bubble's
 * separate React root (same JS runtime, no AppDataProvider). Anything that writes data outside a screen
 * (the chat, voice, a background capture) calls emitDataChanged(); AppDataProvider listens and bumps
 * dataVersion, which the home, transactions, cards and every list screen reload on.
 */
type Listener = () => void;
const listeners = new Set<Listener>();

export function emitDataChanged(): void {
  listeners.forEach((l) => { try { l(); } catch { /* one bad listener must not stop the rest */ } });
}

export function onDataChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
