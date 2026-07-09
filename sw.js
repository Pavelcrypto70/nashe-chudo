const CACHE_VERSION = '20260709-18';
const CACHE = 'nashe-chudo-' + CACHE_VERSION;

self.addEventListener('install', e => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  const isCode = /\.(js|html)$/.test(url.pathname) || url.pathname.endsWith('version.js') || url.pathname.endsWith('sync-data.json') || url.pathname.endsWith('/');
  if (isCode) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }));
    return;
  }

  const isStatic = /\.(css|json|svg|png|jpg|webp|woff2?)$/.test(url.pathname);
  if (isStatic) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  }
});
