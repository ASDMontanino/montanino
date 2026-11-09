/* A.S.D. Montanino — PWA. Dati Supabase e area admin sempre online. */
importScripts('./push-route.js?v=20261109-tap');

const CACHE_NAME = 'montanino-shell-20261109-pull-refresh';
const SHELL = [
  './index.html',
  './galleria.html',
  './notifiche.html',
  './notifiche.css',
  './notifiche.js',
  './push-route.js?v=20261109-tap',
  './pull-refresh.css?v=20261109',
  './pull-refresh.js?v=20261109',
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
  const scope = self.registration.scope;
  const path = event.notification.data?.path;
  const destination = MontaninoPushRoute.destination(scope, path) || new URL('index.html', scope).href;
  event.waitUntil((async () => {
    await MontaninoPushRoute.remember(scope, path).catch(() => {});
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true }).catch(() => []);
    const publicPages = ['index.html', 'galleria.html', 'notifiche.html', ''].map(page => new URL(page, scope).href);
    const client = windows.find(window => window.url === destination) ||
      windows.find(window => publicPages.includes(window.url.split(/[?#]/)[0]));

    if (client) {
      const focused = await client.focus().catch(() => null);
      const updated = client.url === destination ? focused : await client.navigate(destination).catch(() => null);
      if (updated) {
        updated.postMessage({ type: 'MONTANINO_PUSH_ROUTE' });
        if (updated !== focused) await updated.focus().catch(() => {});
        return;
      }
      focused?.postMessage({ type: 'MONTANINO_PUSH_ROUTE' });
    }

    const opened = await self.clients.openWindow(destination).catch(() => null);
    opened?.postMessage({ type: 'MONTANINO_PUSH_ROUTE' });
  })());
});
