import { fetch as expoFetch } from 'expo/fetch';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

/**
 * Live streaming client for POST /chat with { stream: true } (React Native).
 *
 * The backend replies with NDJSON (application/x-ndjson): one complete JSON
 * object per line, terminated by "\n". Frames arrive as zero-or-more `step`
 * frames (each a live activity step), then exactly one terminal `done` frame,
 * or a mid-stream `error` frame if the turn throws after headers were sent.
 *
 * `streamChat` POSTs with Expo's streaming fetch (RN's global fetch has no
 * usable ReadableStream), reads the body reader, splits on newlines and hands
 * each parsed frame to `onFrame` the instant it lands. It THROWS if the
 * connection fails before completing — callers track whether any frame arrived
 * (via `onFrame`) to decide between falling back to the non-stream JSON path
 * (no frame arrived → safe to retry) vs. surfacing a mid-stream error (a frame
 * arrived → the turn already ran; retrying would double its side effects).
 *
 * Base-URL + token resolution mirrors lib/api.ts exactly (that module keeps its
 * resolver/token private, so we re-derive them here rather than editing it).
 */

function resolveApiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE;
  if (fromEnv) return fromEnv.replace(/\/$/, '') + '/api/v1';
  const c = Constants as any;
  const hostUri: string | undefined =
    c.expoConfig?.hostUri ??
    c.manifest?.debuggerHost ??
    c.manifest2?.extra?.expoGo?.debuggerHost;
  if (hostUri) {
    const host = String(hostUri).split(':')[0];
    if (host) return `http://${host}:4000/api/v1`;
  }
  return 'https://api.seshat.site/api/v1';
}

const API_BASE = resolveApiBase();

export type ActivityKind = 'think' | 'tool' | 'handoff' | 'result';
export interface ActivityStep {
  kind: ActivityKind;
  label: string;
  detail?: string;
  ok?: boolean;
}

export type Persona = 'seshat' | 'maat';

// Mirror of the backend NDJSON frame contract. `visualBlocks` is left untyped
// here (unknown[]) so this module doesn't depend on the ChatVisuals component;
// the caller casts it to VisualBlock[].
export type ChatStreamFrame =
  | { t: 'step'; step: ActivityStep }
  | {
      t: 'done';
      reply: string;
      sessionId: string;
      createdTransactionIds?: string[];
      visualBlocks?: unknown[];
      quickReplies?: string[];
      activity?: ActivityStep[];
    }
  | { t: 'error'; message: string };

export interface StreamChatBody {
  message?: string;
  imageUrl?: string;
  sessionId?: string;
  persona: Persona;
  // Opt-in flag: re-run the last user turn (message/imageUrl are ignored).
  regenerate?: boolean;
}

/**
 * Map a raw stream/backend error into a short, on-brand user message. The raw
 * reason (a provider timeout, 429, 5xx, etc.) is logged by the caller for
 * diagnosis; this is only what the user reads.
 */
export function friendlyChatError(raw?: string): string {
  const m = (raw ?? '').toLowerCase();
  if (m.includes('timed out') || m.includes('timeout'))
    return 'That took too long to weigh. Give it another try.';
  if (m.includes('429') || m.includes('rate limit') || m.includes('rate-limit'))
    return 'The AI is busy for a moment. Try again in a few seconds.';
  if (m.includes('no llm provider') || m.includes('not configured'))
    return 'The AI is not configured on the server yet.';
  if (m.includes(' 401') || m.includes(' 403') || m.includes('not authenticated'))
    return 'Your session expired. Sign in again to continue.';
  return 'Something went wrong. Please try again.';
}

export async function streamChat(
  body: StreamChatBody,
  onFrame: (frame: ChatStreamFrame) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = await SecureStore.getItemAsync('auth_token');
  if (!token) throw new Error('Not authenticated');

  const res = await expoFetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  });

  // No streamable body (unsupported / non-2xx) → throw so the caller falls back.
  if (!res.ok || !res.body) throw new Error(`API error: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const flushLine = (line: string) => {
    const trimmed = line.trim();
    if (trimmed) onFrame(JSON.parse(trimmed) as ChatStreamFrame);
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      flushLine(buffer.slice(0, nl));
      buffer = buffer.slice(nl + 1);
    }
  }
  // Any trailing frame not terminated by a newline.
  flushLine(buffer);
}
