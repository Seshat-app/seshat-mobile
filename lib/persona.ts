// The two AI personas of Seshat, ported from the web app (src/lib/persona.ts)
// and adapted for the bilingual mobile app + native persistence.
//
// - Seshat — keeper of the record: the "doer". Full tool access (read + write):
//   logs spends, sets budgets/goals, keeps the books.
// - Maat — weigher of truth: the read-only analyst. Reads the ledger and renders
//   the verdict (reports, breakdowns, trends, charts) but never mutates anything.
//
// The client only ever *sends* the active persona; the backend enforces the
// actual capability per turn. `Persona` defaults to 'seshat' everywhere.

import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

export type Persona = 'seshat' | 'maat';

export const DEFAULT_PERSONA: Persona = 'seshat';

type Lang = 'en' | 'ar';
type Bi = { en: string; ar: string };

export interface PersonaMeta {
  key: Persona;
  name: Bi;
  tagline: Bi;
  // One-line subtitle shown under the switcher — sets the expectation that
  // Seshat acts while Maat only reads.
  hint: Bi;
}

export const PERSONAS: Record<Persona, PersonaMeta> = {
  seshat: {
    key: 'seshat',
    name: { en: 'Seshat', ar: 'سيشات' },
    tagline: { en: 'Keeper of the record', ar: 'حافظة السجل' },
    hint: {
      en: 'Logs, budgets and keeps your books — she acts on the record.',
      ar: 'تسجّل وتضبط الميزانية وتحفظ دفاترك — تتصرّف في السجل.',
    },
  },
  maat: {
    key: 'maat',
    name: { en: 'Maat', ar: 'ماعت' },
    tagline: { en: 'Weigher of truth', ar: 'موازِنة الحقيقة' },
    hint: {
      en: 'Reads and reports only — she weighs the month, never changes it.',
      ar: 'تقرأ وتحلّل فقط — تزن الشهر ولا تغيّره.',
    },
  },
};

export function personaName(p: Persona, lang: Lang): string {
  return PERSONAS[p].name[lang];
}
export function personaHint(p: Persona, lang: Lang): string {
  return PERSONAS[p].hint[lang];
}

// ─────────────────────────────────────────────────────────────
// Persistence — the active persona is remembered across launches.
// Backed by expo-secure-store (same store the auth token lives in), with a
// synchronous in-memory cache + a tiny pub/sub so the session-list header and
// the chat header stay in lock-step when either one toggles.
// ─────────────────────────────────────────────────────────────
const STORE_KEY = 'active_persona';
let cache: Persona = DEFAULT_PERSONA;
let loaded = false;
const listeners = new Set<(p: Persona) => void>();

/** Read the persisted persona once (memoised). Safe to call repeatedly. */
export async function loadPersona(): Promise<Persona> {
  if (loaded) return cache;
  try {
    const v = await SecureStore.getItemAsync(STORE_KEY);
    if (v === 'seshat' || v === 'maat') cache = v;
  } catch {
    // ignore — fall back to the default.
  }
  loaded = true;
  return cache;
}

/** Latest known persona without awaiting storage (defaults until loaded). */
export function getPersona(): Persona {
  return cache;
}

/** Set + persist the active persona and notify every subscriber. */
export async function setActivePersona(p: Persona): Promise<void> {
  cache = p;
  loaded = true;
  listeners.forEach((l) => l(p));
  try {
    await SecureStore.setItemAsync(STORE_KEY, p);
  } catch {
    // best-effort persistence — the in-memory value still updates the UI.
  }
}

/**
 * React binding for the active persona. Returns [persona, setPersona, ready].
 * `ready` flips true once the persisted value has been read, so callers can
 * avoid firing a fetch with the (possibly wrong) default first.
 */
export function usePersona(): [Persona, (p: Persona) => void, boolean] {
  const [persona, setPersona] = useState<Persona>(cache);
  const [ready, setReady] = useState(loaded);

  useEffect(() => {
    let alive = true;
    loadPersona().then((p) => {
      if (!alive) return;
      setPersona(p);
      setReady(true);
    });
    const l = (p: Persona) => setPersona(p);
    listeners.add(l);
    return () => {
      alive = false;
      listeners.delete(l);
    };
  }, []);

  return [persona, (p: Persona) => void setActivePersona(p), ready];
}
