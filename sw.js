/* A.S.D. Montanino — PWA. Dati Supabase e area admin sempre online. */
const CACHE_NAME = 'montanino-shell-20261109-v4.1';
const SHELL = [
  './index.html',
  './galleria.html',
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
