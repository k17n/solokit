// SoloKit service worker: makes the site installable and fully usable offline.
// This file is a TEMPLATE. After `next build`, scripts/sw-precache.mjs replaces
// the two tokens below in out/sw.js with a content hash and the list of every
// exported file. It is only registered in production builds, never in dev.
const BUILD_ID = '__BUILD_ID__';
const PRECACHE_URLS = __PRECACHE_URLS__;
const CACHE = 'solokit-' + BUILD_ID;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

// Trade-off: skipWaiting + clients.claim + deleting the previous build's cache
// can strand an already-open old page that later lazy-loads an old chunk (the
// chunk is gone from the new cache and the new server). That is acceptable
// while navigation uses plain full-page <a> links; revisit if client-side
// navigation or dynamic imports are added.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith('solokit-') && key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function store(event, cache, request, response) {
  if (response.ok && response.type === 'basic') {
    event.waitUntil(cache.put(request, response.clone()));
  }
}

async function networkFirst(event) {
  const { request } = event;
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    store(event, cache, request, response);
    return response;
  } catch {
    const url = new URL(request.url);
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    return (
      (await cache.match(request, { ignoreSearch: true })) ||
      (await cache.match(url.pathname, { ignoreSearch: true })) ||
      (await cache.match('/')) ||
      Response.error()
    );
  }
}

async function cacheFirst(event) {
  const { request } = event;
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const response = await fetch(request);
    store(event, cache, request, response);
    return response;
  } catch {
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(request.mode === 'navigate' ? networkFirst(event) : cacheFirst(event));
});
