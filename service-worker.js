/* Азбука Bulgarian Trainer — offline app shell.
 *
 * The whole app (data + audio) lives inside one HTML file, so caching that
 * file IS caching the app. Cache-first for everything in scope, with a
 * network fallback; navigations fall back to the cached shell when offline.
 *
 * After deploying an updated app file, bump CACHE_VERSION so returning
 * visitors pick up the new build on their next launch (old caches are
 * cleaned on activate; the fresh shell is served from the second launch).
 */
const CACHE_VERSION = 'azbuka-v2';
const APP_SHELL = [
  './',
  './manifest.webmanifest',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // Cache each asset individually so one miss (e.g. an icon 404 during
      // partial deploys) doesn't abort the whole install.
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        // Opportunistically cache successful same-origin responses.
        if (resp && resp.ok && new URL(req.url).origin === self.location.origin) {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => {
        // Offline and not cached: for page navigations, serve the app shell.
        if (req.mode === 'navigate') return caches.match('./');
        return Response.error();
      });
    })
  );
});
