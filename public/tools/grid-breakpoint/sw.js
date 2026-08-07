/*
 * Grid Breakpoint 计算器的 Service Worker。
 *
 * 全部资源都是同源静态文件，且计算不依赖网络：预缓存外壳，
 * 其余走网络优先、断网回退缓存，发版即自动更新。
 */
const CACHE = 'grid-bp-v1';
const SHELL = [
  '/tools/grid-breakpoint/',
  '/tools/grid-breakpoint/?source=pwa',
  '/tools/grid-breakpoint/css/style.css',
  '/tools/grid-breakpoint/js/app.js',
  '/tools/grid-breakpoint/js/core.js',
  '/tools/grid-breakpoint/manifest.webmanifest',
  '/tools/grid-breakpoint/icon.svg',
  '/tools/grid-breakpoint/icon-192.png',
  '/tools/grid-breakpoint/icon-512.png',
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
            .filter((key) => key.startsWith('grid-bp-') && key !== CACHE)
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
        if (request.mode === 'navigate') return caches.match('/tools/grid-breakpoint/');
        return Response.error();
      })
  );
});
