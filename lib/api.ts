import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';

// Resolve the API host automatically so it survives the dev machine's LAN IP
// changing (hotspot, WiFi switch, etc). Order of precedence:
//   1. EXPO_PUBLIC_API_BASE env var (full URL, no trailing slash)
//   2. Expo's debugger host (the IP Metro is serving from) + port 4000
//   3. Hard-coded fallback for production / non-dev builds
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
  return 'http://localhost:4000/api/v1';
}

const API_BASE = resolveApiBase();

async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('auth_token');
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync('auth_token', token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync('auth_token');
}

export async function hasToken(): Promise<boolean> {
  const token = await getToken();
  return !!token;
}

// Generates a fresh idempotency key. Use this once per "save intent" — e.g.
// when the user taps a Save button — and pass into apiFetch via the
// `idempotencyKey` option. If the request fails and you retry, REUSE the
// same key so the server can dedupe (Stripe-style).
export function newIdempotencyKey(): string {
  return Crypto.randomUUID();
}

export interface ApiFetchOptions extends RequestInit {
  /** When set, sent as Idempotency-Key header so the backend can dedupe retries. */
  idempotencyKey?: string;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const token = await getToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  const { idempotencyKey, ...rest } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(rest.headers as Record<string, string> | undefined),
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers,
  });

  // Handle non-JSON responses (e.g. Express HTML error pages)
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(`API error: ${res.status} (non-JSON response)`);
  }

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? `API error: ${res.status}`);
  }

  return json as T;
}
