/* Shared by the notification worker and the public app pages. */
(() => {
  'use strict';
  const cacheName = 'montanino-push-route-v1';
  const key = scope => new URL('./.push-route', scope).href;
  const isRoute = /^(?:index\.html#partita-[AR]\d{2}|galleria\.html\?partita=[AR]\d{2}|notifiche\.html\?prova=1)$/;
  const maxAge = 90_000;

  function destination(scope, path) {
    return typeof path === 'string' && isRoute.test(path) ? new URL(path, scope).href : null;
  }

  globalThis.MontaninoPushRoute = {
    destination,
    async remember(scope, path) {
      if (!destination(scope, path)) return;
      const cache = await caches.open(cacheName);
      await cache.put(key(scope), new Response(JSON.stringify({ path, expires: Date.now() + maxAge })));
    }
  };

  if (typeof window === 'undefined' || !('caches' in window) || !('serviceWorker' in navigator)) return;
  const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (!installed) return;

  const scope = new URL('./', location.href).href;
  let checking = false;
  async function resumeRoute() {
    if (checking || document.visibilityState !== 'visible') return;
    checking = true;
    try {
      const cache = await caches.open(cacheName);
      const pending = await cache.match(key(scope));
      if (!pending) return;
      const route = await pending.json();
      if (!await cache.delete(key(scope))) return;
      const target = destination(scope, route.path);
      if (target && route.expires > Date.now() && target !== location.href) location.replace(target);
    } catch (_) {
      // Native notification navigation remains available if storage is unavailable.
    } finally {
      checking = false;
    }
  }

  let timer;
  function onVisible() {
    if (document.visibilityState !== 'visible') return;
    clearTimeout(timer);
    resumeRoute();
    // A cold start may load the app before the worker has saved the tap.
    timer = setTimeout(resumeRoute, 750);
  }
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'MONTANINO_PUSH_ROUTE') onVisible();
  });
  window.addEventListener('pageshow', onVisible);
  document.addEventListener('visibilitychange', onVisible);
  onVisible();
})();
