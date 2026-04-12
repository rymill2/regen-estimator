const CACHE_NAME = 'regen-estimator-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
];

// Cross-origin resources to cache at runtime (network-first, cache fallback)
const RUNTIME_CACHE_ORIGINS = [
  'https://cdn.jsdelivr.net',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  const isSameOrigin = url.origin === self.location.origin;
  const isCacheableThirdParty = RUNTIME_CACHE_ORIGINS.some(o => url.origin === o);

  if (!isSameOrigin && !isCacheableThirdParty) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      // Navigation (HTML): network first, fall back to cached index.html
      if (request.mode === 'navigate') {
        try {
          const networkResponse = await fetch(request);
          cache.put(request, networkResponse.clone());
          return networkResponse;
        } catch {
          return (await cache.match('/index.html')) || Response.error();
        }
      }

      // Third-party CDN resources: cache first, network fallback + update
      if (isCacheableThirdParty) {
        const cached = await cache.match(request);
        if (cached) {
          fetch(request).then(r => r.ok && cache.put(request, r)).catch(() => {});
          return cached;
        }
        try {
          const networkResponse = await fetch(request);
          if (networkResponse.ok) cache.put(request, networkResponse.clone());
          return networkResponse;
        } catch {
          return Response.error();
        }
      }

      // Same-origin assets: cache first, network fallback + background revalidate
      const cached = await cache.match(request);
      if (cached) {
        fetch(request).then(r => r.ok && cache.put(request, r)).catch(() => {});
        return cached;
      }
      try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) cache.put(request, networkResponse.clone());
        return networkResponse;
      } catch {
        return Response.error();
      }
    })
  );
});

// Background Sync: relay flush signal to all open clients
self.addEventListener('sync', event => {
  if (event.tag === 'flush-offline-queue') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => client.postMessage('flush-offline-queue'));
      })
    );
  }
});
