// Synchronisatie met Firestore (project stijn-ratemyday) via de REST-API.
// Eén document per koppelcode: rmd/{code} met velden entries, challenge, inzichten (alle als JSON-tekst).
// De koppelcode staat alleen op het apparaat; zonder code kan niemand iets lezen (zie firebase/firestore.rules).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DayEntry } from '../types/entry';

const API_KEY = 'AIzaSyCwJyC0CZNUuF3c4REmouNlsXivmKWbviQ';
const BASE = 'https://firestore.googleapis.com/v1/projects/stijn-ratemyday/databases/(default)/documents';
export const CODE_KEY = 'rate-my-day:sync-code';
export const ENTRIES_KEY = 'rate-my-day:entries';
export const CHALLENGE_KEY = 'rate-my-day:challenge';
export const INSIGHTS_KEY = 'rate-my-day:inzichten';
export const HEALTH_KEY = 'rate-my-day:gezondheid';
const LAST_SYNC_KEY = 'rate-my-day:laatste-sync';

type Listener = () => void;
const listeners = new Set<Listener>();
export function onSynced(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** "8.432", "8 432", "7,5" en "12000" → getal; anders null. */
export function parseNum(raw: string): number | null {
  let t = String(raw).trim().replace(/\s+/g, '');
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) t = t.replace(/[.,]/g, '');
  t = t.replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

function randomCode(): string {
  const bytes = new Uint8Array(24);
  (globalThis.crypto as Crypto).getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getCode(): Promise<string> {
  let code = await AsyncStorage.getItem(CODE_KEY);
  if (!code) {
    code = randomCode();
    await AsyncStorage.setItem(CODE_KEY, code);
  }
  return code;
}

export function validCode(code: string): boolean {
  return /^[0-9a-f]{40,80}$/.test(code.trim());
}

/** Koppel dit apparaat aan een bestaande code; lokale data wordt erin samengevoegd. */
export async function setCode(code: string): Promise<void> {
  await AsyncStorage.setItem(CODE_KEY, code.trim());
  await syncNow();
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function fetchDoc(code: string): Promise<Record<string, any> | null> {
  const res = await fetch(`${BASE}/rmd/${code}?key=${API_KEY}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Ophalen mislukt (${res.status})`);
  const doc = await res.json();
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries<any>(doc.fields || {})) {
    if (v.stringValue === undefined) continue;
    try {
      out[k] = JSON.parse(v.stringValue);
    } catch {
      out[k] = v.stringValue;
    }
  }
  return out;
}

async function patchDoc(code: string, fields: Record<string, unknown>): Promise<void> {
  const mask = Object.keys(fields).map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { stringValue: JSON.stringify(v) }])) };
  const res = await fetch(`${BASE}/rmd/${code}?key=${API_KEY}&${mask}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Opslaan online mislukt (${res.status})`);
}

async function fetchHealth(code: string): Promise<Record<string, any>> {
  const res = await fetch(`${BASE}/rmd/${code}/gezondheid?key=${API_KEY}&pageSize=400`);
  if (!res.ok) return {};
  const data = await res.json();
  const out: Record<string, any> = {};
  for (const doc of data.documents || []) {
    const day = String(doc.name).split('/').pop() as string;
    const rec: Record<string, number | string> = {};
    for (const [k, v] of Object.entries<any>(doc.fields || {})) {
      const val = v.integerValue ?? v.doubleValue ?? v.stringValue;
      rec[k] = typeof val === 'string' ? parseNum(val) ?? val : val;
    }
    out[day] = rec;
  }
  return out;
}

export function mergeEntries(a: Record<string, DayEntry>, b: Record<string, DayEntry>): Record<string, DayEntry> {
  const out: Record<string, DayEntry> = { ...a };
  for (const [day, e] of Object.entries(b || {})) {
    const cur = out[day];
    if (!cur || (e.updatedAt || '') > (cur.updatedAt || '')) out[day] = e;
  }
  return out;
}

function mergeChallenge(local: any, remote: any): any {
  if (!remote) return local;
  if (!local || !local.startDate) return remote;
  const localNewer = (local._bijgewerkt || '') > (remote._bijgewerkt || '');
  const [oud, nieuw] = localNewer ? [remote, local] : [local, remote];
  return {
    ...oud,
    ...nieuw,
    days: { ...(oud.days || {}), ...(nieuw.days || {}) },
    weeks: { ...(oud.weeks || {}), ...(nieuw.weeks || {}) },
    milestones: { ...(oud.milestones || {}), ...(nieuw.milestones || {}) },
  };
}

let running: Promise<void> | null = null;
let again = false;

/** Haalt de online versie op, voegt samen met wat lokaal staat en zet het resultaat op beide plekken. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      const code = await getCode();
      const remote = (await fetchDoc(code)) || {};
      const localEntries = await readJson<Record<string, DayEntry>>(ENTRIES_KEY, {});
      const entries = mergeEntries(localEntries, remote.entries || {});
      const localChallenge = await readJson<any>(CHALLENGE_KEY, null);
      const challenge = mergeChallenge(localChallenge, remote.challenge || null);

      await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
      if (challenge) await AsyncStorage.setItem(CHALLENGE_KEY, JSON.stringify(challenge));
      if (remote.inzichten) await AsyncStorage.setItem(INSIGHTS_KEY, JSON.stringify(remote.inzichten));

      const fields: Record<string, unknown> = { entries, bijgewerkt: new Date().toISOString() };
      if (challenge) fields.challenge = challenge;
      await patchDoc(code, fields);

      const health = await fetchHealth(code);
      await AsyncStorage.setItem(HEALTH_KEY, JSON.stringify(health));
      await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      listeners.forEach((fn) => fn());
    } catch (err) {
      console.warn('[sync]', err);
    } finally {
      running = null;
      if (again) {
        again = false;
        syncNow();
      }
    }
  })();
  return running;
}

let timer: ReturnType<typeof setTimeout> | null = null;
/** Na een wijziging: kort wachten en dan synchroniseren (meerdere wijzigingen in één keer). */
export function syncSoon(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    syncNow();
  }, 800);
}

export async function lastSync(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_SYNC_KEY);
}

export function startAutoSync(): void {
  syncNow();
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') syncNow();
    });
  }
  (globalThis as any).__rmdSyncSoon = syncSoon;
}
