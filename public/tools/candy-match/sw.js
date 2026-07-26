const CACHE = 'candy-match-v1';
const SHELL = [
  '/tools/candy-match/',
  '/tools/candy-match/?source=pwa',
  '/tools/candy-match/css/style.css',
  '/tools/candy-match/js/app.js',
  '/tools/candy-match/js/core.js',
  '/tools/candy-match/manifest.webmanifest',
  '/tools/candy-match/icon-192.png',
  '/tools/candy-match/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('candy-match-') && key !== CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const hit = await caches.match(request);
        if (hit) return hit;
        if (request.mode === 'navigate') return caches.match('/tools/candy-match/');
        return Response.error();
      })
  );
});
