/*
 * EnsinoLibre service worker — makes the site installable and usable offline.
 *
 * Design goals, in order:
 *  1. Never serve a stale app. Navigations are network-first, so a logged-in
 *     teacher always gets the current HTML shell when online; the cache is only
 *     a fallback when the network fails.
 *  2. Never touch anything that isn't a same-origin GET. Supabase API traffic
 *     (auth, RPCs, realtime) is cross-origin and must reach the network
 *     untouched — it is skipped entirely here.
 *  3. Fail safe. A missing precache entry must not break installation, and the
 *     worker cleans up its own old caches on activate.
 *
 * Bump CACHE_VERSION on any change to this file or the precache list.
 */
const CACHE_VERSION = 'v1';
const CACHE = `ensinolibre-${CACHE_VERSION}`;

// Scope is /site/ (this file lives there), so these are relative to it.
const PRECACHE = [
  'index.html',
  'aula.html',
  'docs.html',
  'manifest.webmanifest',
  'assets/styles.css',
  'assets/app.css',
  'assets/vendor/tokens.css',
  'assets/icons/icon-192.png',
  'assets/icons/icon.svg',
  'assets/icons/icon-maskable.svg',
  'assets/brand/wordmark-primary-light.svg',
  'assets/brand/wordmark-primary-dark.svg',
  'assets/brand/favicon-light.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // allSettled, not addAll: one 404 (or a renamed asset) must not abort the
    // whole install and leave the site without a worker.
    await Promise.allSettled(
      PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' }))),
    );
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only ever handle same-origin GETs. Cross-origin (Supabase) and non-GET
  // requests fall straight through to the network.
  if (request.method !== 'GET' || url.origin !== location.origin) return;

  // Navigations: network-first so online users get fresh HTML; on failure fall
  // back to a cached copy of the same page, then to the landing page.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put(request, fresh.clone());
        return fresh;
      } catch {
        return (await caches.match(request))
          || (await caches.match('index.html'))
          || new Response('You are offline and this page has not been cached yet.', {
            status: 503, headers: { 'Content-Type': 'text/plain' },
          });
      }
    })());
    return;
  }

  // Static assets (css/js/svg/png/fonts…): stale-while-revalidate. Serve the
  // cached copy instantly, refresh it in the background. Hashed app bundles are
  // immutable, so this is always safe for them.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    const network = fetch(request).then((res) => {
      if (res && res.ok && res.type === 'basic') cache.put(request, res.clone());
      return res;
    }).catch(() => null);
    return cached || (await network) || new Response('', { status: 504 });
  })());
});
