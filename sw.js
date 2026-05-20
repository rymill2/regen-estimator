const CACHE = 'regen-estimator-v3';

// Precached at install — all served locally, available immediately offline
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/html2pdf.min.js',
];

// CDN origins to runtime-cache (stale-while-revalidate)
const CDN_ORIGINS = [
  'https://cdn.jsdelivr.net',    // Supabase JS
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://cdnjs.cloudflare.com',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith('http')) return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isCDN = CDN_ORIGINS.some(o => url.origin === o);

  if (!isSameOrigin && !isCDN) return;

  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req);

      if (req.mode === 'navigate') {
        // Navigation: network first so the latest shell is always fetched when online
        try {
          const fresh = await fetch(req);
          if (fresh.ok) cache.put(req, fresh.clone());
          return fresh;
        } catch {
          return cached || caches.match('/index.html');
        }
      }

      if (cached) {
        // Stale-while-revalidate: return cached immediately, refresh in background
        fetch(req).then(r => {
          if (r && (r.ok || r.type === 'opaque')) cache.put(req, r);
        }).catch(() => {});
        return cached;
      }

      // Not cached yet — fetch, cache, and return
      try {
        const fresh = await fetch(req);
        if (fresh && (fresh.ok || fresh.type === 'opaque')) {
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        // Absolute fallback for navigation
        if (req.mode === 'navigate') return caches.match('/index.html');
        return new Response('', { status: 503, statusText: 'Offline' });
      }
    })
  );
});

// Relay background-sync signal to open windows
self.addEventListener('sync', e => {
  if (e.tag === 'flush-offline-queue') {
    e.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients =>
        clients.forEach(c => c.postMessage('flush-offline-queue'))
      )
    );
  }
});
