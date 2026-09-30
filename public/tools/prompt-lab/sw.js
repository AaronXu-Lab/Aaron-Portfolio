const CACHE = 'prompt-lab-v8';
const BASE = new URL('./', self.location).pathname;
const SHELL = ['', 'index.html', 'style.css', 'app.js', 'prompt.txt', 'entries.json', 'manifest.webmanifest', 'pelican-v4-192.png', 'pelican-v4-512.png'];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL.map(path => BASE + path));
    const entries = await (await cache.match(BASE + 'entries.json')).json();
    await cache.addAll(entries.map(item => BASE + item.entry));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name.startsWith('prompt-lab-') && name !== CACHE) await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch {
      const cached = await cache.match(event.request, { ignoreSearch: true });
      if (cached) return cached;
      if (url.pathname === BASE) return cache.match(BASE + 'index.html');
      return new Response('此作品资源尚未离线缓存，请联网后打开一次。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
