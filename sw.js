// Service worker Rate My Day: alleen pushmeldingen tonen en bij tikken de app openen.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { body: event.data && event.data.text() }; }
  const title = data.title || 'Rate My Day';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    tag: data.tag || 'rmd',
    renotify: true,
    icon: '/rate-my-day/apple-touch-icon.png',
    badge: '/rate-my-day/apple-touch-icon.png',
    data: { url: data.url || '/rate-my-day/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/rate-my-day/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.includes('/rate-my-day/')) { await c.focus(); if ('navigate' in c) c.navigate(url); return; }
    }
    await self.clients.openWindow(url);
  })());
});
