// Generated with a content-derived cache version by build:stash.
const CACHE = "stash-shell-d6c5d81313a5";
const SHELL = ["/tools/stash/","/tools/stash/app.js","/tools/stash/style.css","/tools/stash/copy.svg","/tools/stash/upload-simple.svg","/tools/stash/file.svg","/tools/stash/icon-32.png","/tools/stash/icon-180.png","/tools/stash/icon-192.png","/tools/stash/icon-512.png","/tools/stash/manifest.webmanifest"];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  // Let the browser wait for existing windows to close; never interrupt edits/uploads.
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('stash-shell-') && key !== CACHE).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const path = request.mode === 'navigate' && ['/tools/stash/', '/tools/stash/index.html'].includes(url.pathname) ? '/tools/stash/' : url.pathname;
  if (!SHELL.includes(path)) return; // API, downloads and image contents never enter Cache Storage.
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(path)) || fetch(request)));
});
