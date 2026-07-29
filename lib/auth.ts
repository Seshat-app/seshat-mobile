import Constants from 'expo-constants';
import { setToken, clearToken } from './api';
import { clearPushToken } from './push';

// Mirrors api.ts so auth requests follow the same host-resolution rules.
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

export interface AuthResult {
  success: boolean;
  error?: string;
  sessionId?: string;
}

export async function signInWithGoogle(idToken: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error?.message ?? 'Google sign-in failed' };
    }
    await setToken(json.data.accessToken);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Google sign-in failed' };
  }
}

export async function signInWithPassword(identifier: string, password: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${API_BASE}/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error?.message ?? 'Sign-in failed' };
    }
    await setToken(json.data.accessToken);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Sign-in failed' };
  }
}

export async function registerSendCode(email: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${API_BASE}/auth/register/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error?.message ?? 'Failed to send code' };
    }
    return { success: true, sessionId: json.data.sessionId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to send code' };
  }
}

export async function registerVerifyCode(sessionId: string, code: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${API_BASE}/auth/register/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, code }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error?.message ?? 'Invalid code' };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Verification failed' };
  }
}

export async function registerComplete(sessionId: string, username: string, password: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${API_BASE}/auth/register/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, username, password }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error?.message ?? 'Registration failed' };
    }
    await setToken(json.data.accessToken);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Registration failed' };
  }
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${API_BASE}/auth/password/request-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error?.message ?? 'Failed to request reset' };
    }
    return { success: true, sessionId: json.data.sessionId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to request reset' };
  }
}

export async function verifyPasswordReset(sessionId: string, code: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${API_BASE}/auth/password/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, code }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error?.message ?? 'Invalid code' };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Verification failed' };
  }
}

export async function completePasswordReset(sessionId: string, password: string): Promise<AuthResult> {
  try {
    const res = await fetch(`${API_BASE}/auth/password/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, password }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error?.message ?? 'Password reset failed' };
    }
    await setToken(json.data.accessToken);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Password reset failed' };
  }
}

export async function signOut(): Promise<void> {
  // Best-effort: tell the server to drop our push token first. If this fails
  // (offline, expired session) we still sign out locally - the token will
  // be overwritten on next sign-in anyway.
  try {
    await clearPushToken();
  } catch {
    // swallow
  }
  await clearToken();
}
