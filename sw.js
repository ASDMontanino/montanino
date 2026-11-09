/* A.S.D. Montanino — PWA. Dati Supabase e area admin sempre online. */
const CACHE_NAME = 'montanino-shell-20261109-push-pilot';
const SHELL = [
  './index.html',
  './galleria.html',
  './notifiche.html',
  './notifiche.css',
  './notifiche.js',
  './admin-app.html',
  './admin-app.css',
  './admin-app.js',
  './manifest-admin.json',
  './assets/icons/montanino-admin.svg',
  './style.css',
  './galleria.css',
  './pwa.css',
  './pwa.js',
  './app-ui.css',
  './app-ui.js',
  './data.js',
  './tabellini.js',
  './config.js',
  './site-common.js',
  './site-loader.js',
  './main.js',
  './fx.js',
  './galleria.js',
  './assets/icons/montanino-192.png',
  './assets/icons/montanino-512.webp',
  './assets/img/stemma.webp'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('montanino-shell-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (/\/admin(?:\.|\/|$)/i.test(url.pathname)) return;
  if (url.pathname.includes('/assets/img/partite/')) return;

  const isPage = request.mode === 'navigate';
  const isStatic = /\.(?:css|js|png|webp|svg)$/i.test(url.pathname);
  if (!isPage && !isStatic) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        // Clona prima che il browser inizi a consumare la risposta.
        try {
          const copy = response.clone();
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, copy);
        } catch (_) { /* cache opzionale: non blocca la rete */ }
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) return cached;
      if (isPage) return (await caches.match('./index.html')) || Response.error();
      return Response.error();
    }
  })());
});

function pushDestination(path) {
  const allowed = /^(?:index\.html#partita-[AR]\d{2}|galleria\.html\?partita=[AR]\d{2}|notifiche\.html\?prova=1)$/;
  return new URL(allowed.test(path) ? path : 'index.html', self.registration.scope).href;
}

self.addEventListener('push', event => {
  let message = {};
  try { message = event.data?.json() || {}; } catch (_) { /* payload non leggibile */ }
  event.waitUntil(self.registration.showNotification(message.title || 'A.S.D. Montanino', {
    body: message.body || 'Ci sono novità dal club.',
    icon: new URL('assets/icons/montanino-192.png', self.registration.scope).href,
    tag: message.tag,
    data: { path: message.url }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const destination = pushDestination(event.notification.data?.path);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => client.url === destination);
    if (existing) return existing.focus();
    const publicPages = ['index.html', 'galleria.html', 'notifiche.html', '']
      .map(page => new URL(page, self.registration.scope).href);
    const publicWindow = windows.find(client => publicPages.includes(client.url.split(/[?#]/)[0]));
    if (publicWindow) {
      const updated = await publicWindow.navigate(destination).catch(() => null);
      if (updated) return updated.focus();
    }
    return self.clients.openWindow(destination);
  })());
});
