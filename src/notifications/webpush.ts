// Pushmeldingen in de webversie (iPhone: alleen als de app op het beginscherm staat, iOS 16.4+).
// De Mac mini (analyse/herinneringen.py) stuurt de meldingen en stopt zodra je hebt ingevuld.
import { Platform } from 'react-native';
import { fetchDoc, getCode, patchDoc } from '../storage/sync';

const VAPID_PUBLIC = 'BDhv-8EAUhvGW_UaBI5ZWpSTrFkTkIrQzeM3qH_fQXVG16pBTiQNvmUhYsBO68SQpG28xNxIf0MMgvIkCxuLsmg';

export type PushStatus = 'aan' | 'uit' | 'geweigerd' | 'niet-mogelijk' | 'beginscherm';

function isStandalone(): boolean {
  return (
    (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    (typeof navigator !== 'undefined' && (navigator as any).standalone === true)
  );
}
function isIOS(): boolean {
  return typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function keyBytes(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/rate-my-day/sw.js', { scope: '/rate-my-day/' });
}

export async function pushStatus(): Promise<PushStatus> {
  if (Platform.OS !== 'web') return 'niet-mogelijk';
  if (isIOS() && !isStandalone()) return 'beginscherm';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'niet-mogelijk';
  if (Notification.permission === 'denied') return 'geweigerd';
  const reg = await navigator.serviceWorker.getRegistration('/rate-my-day/');
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return sub && Notification.permission === 'granted' ? 'aan' : 'uit';
}

async function saveSubscription(sub: PushSubscription | null, endpointToRemove?: string): Promise<void> {
  const code = await getCode();
  const doc = (await fetchDoc(code)) || {};
  const push: Record<string, any> = doc.push || {};
  if (endpointToRemove) {
    for (const [k, v] of Object.entries(push)) if ((v as any).endpoint === endpointToRemove) delete push[k];
  }
  if (sub) {
    const json = sub.toJSON();
    const id = btoa(json.endpoint || '').replace(/[^a-zA-Z0-9]/g, '').slice(-24);
    push[id] = { ...json, apparaat: navigator.userAgent.slice(0, 120), sinds: new Date().toISOString() };
  }
  await patchDoc(code, { push });
}

/** Moet vanuit een tik worden aangeroepen (iOS-eis). */
export async function enablePush(): Promise<PushStatus> {
  const status = await pushStatus();
  if (status === 'niet-mogelijk' || status === 'beginscherm' || status === 'geweigerd') return status;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'geweigerd' : 'uit';
  const reg = await registration();
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) as BufferSource });
  }
  await saveSubscription(sub);
  return 'aan';
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration('/rate-my-day/');
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await saveSubscription(null, endpoint);
  }
}

export async function testPush(): Promise<void> {
  const reg = await registration();
  await reg.showNotification('Rate My Day', { body: 'Zo zien je herinneringen eruit. Tik om de app te openen.', icon: '/rate-my-day/apple-touch-icon.png' });
}

/** Houd de registratie actueel (iOS ververst soms het endpoint). */
export async function refreshPush(): Promise<void> {
  try {
    if ((await pushStatus()) !== 'aan') return;
    const reg = await registration();
    const sub = await reg.pushManager.getSubscription();
    if (sub) await saveSubscription(sub);
  } catch {}
}
