// =====================================================================
//  CertReady — Service Worker
//
//  IMPORTANT: bump CACHE_NAME (e.g. certready-v2, certready-v3) every
//  time you deploy a new version of CertReady.html. This triggers the
//  old cache to be deleted and users to get the fresh file on next visit.
// =====================================================================

const CACHE_NAME = 'certready-v1';

// ── INSTALL ──────────────────────────────────────────────────────────
// Skip waiting so the new SW activates immediately without needing all
// tabs to be closed first.
self.addEventListener('install', event => {
  self.skipWaiting();
});

// ── ACTIVATE ─────────────────────────────────────────────────────────
// Delete any caches from previous versions, then claim all open tabs so
// this SW starts handling requests right away. Finally, notify the page
// so it can show the "updated" toast on next meaningful visit.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
      .then(() => {
        // Tell every open tab a new version has taken over
        self.clients
          .matchAll({ type: 'window', includeUncontrolled: false })
          .then(clients =>
            clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' }))
          );
      })
  );
});

// ── FETCH ─────────────────────────────────────────────────────────────
// Strategy by request type:
//
//   External origins (Supabase, Gumroad, CDNs) → network only
//   Non-GET requests                            → network only
//   Same-origin GET (the app HTML, etc.)        → stale-while-revalidate
//     • Serve cached version instantly (fast + works offline)
//     • Always update the cache in the background for next time
self.addEventListener('fetch', event => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Leave external API calls completely alone
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(event.request);

      // Background network fetch — updates the cache for next time
      const networkFetch = fetch(event.request)
        .then(response => {
          if (response && response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        // Serve stale immediately, refresh cache in background
        networkFetch.catch(() => {}); // suppress unhandled-rejection noise
        return cached;
      }

      // Nothing in cache yet — wait for the network
      const fresh = await networkFetch;
      return fresh || new Response('Offline — open CertReady while connected first.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      });
    })
  );
});
