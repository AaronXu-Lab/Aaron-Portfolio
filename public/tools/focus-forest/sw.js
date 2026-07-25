/*
 * 专注森林 PWA 的 Service Worker。
 *
 * 预缓存 = 界面 + three 核心 + 默认场景（植物是代码里的低多边形基元，没有额外模型要下）。
 * vendor/ 下是版本锁定的 three 构建产物，内容不变，走缓存优先，不必每次回源 700 KB;
 * 其余同源资源走网络优先，断网回退缓存，发版即自动更新。
 */
const CACHE = 'forest-v2';
const SHELL = [
  '/tools/focus-forest/',
  '/tools/focus-forest/?source=pwa',
  '/tools/focus-forest/css/style.css',
  '/tools/focus-forest/js/app.js',
  '/tools/focus-forest/js/core.js',
  '/tools/focus-forest/js/scene.js',
  '/tools/focus-forest/vendor/three.module.min.js',
  '/tools/focus-forest/vendor/three.core.min.js',
  '/tools/focus-forest/manifest.webmanifest',
  '/tools/focus-forest/icon-192.png',
  '/tools/focus-forest/icon-512.png',
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
            .filter((key) => key.startsWith('forest-') && key !== CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// 完成通知(app.js 经 registration.showNotification 发出)被点开:聚焦已有窗口,没有就开一个
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const SCOPE = '/tools/focus-forest/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((client) => client.url.includes(SCOPE));
      return open ? open.focus() : self.clients.openWindow(SCOPE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;

  // 版本锁定的 three 构建产物：缓存优先
  if (request.url.includes('/tools/focus-forest/vendor/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            if (res.ok) caches.open(CACHE).then((cache) => cache.put(request, res.clone()));
            return res;
          })
      )
    );
    return;
  }

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
        if (request.mode === 'navigate') return caches.match('/tools/focus-forest/');
        return Response.error();
      })
  );
});
