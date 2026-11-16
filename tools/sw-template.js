// Service worker template. vite.config.ts fills in VERSION and PRECACHE at build time
// and writes the result to dist/sw.js.
'use strict';

const VERSION = __VERSION__;
const PRECACHE = __PRECACHE__;
const SHELL_CACHE = 'shell-' + VERSION;
const DICT_CACHE = 'dict';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== SHELL_CACHE && key !== DICT_CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // Single-page app with hash routing: every navigation is the app shell.
    event.respondWith(
      caches
        .match('./', { cacheName: SHELL_CACHE, ignoreSearch: true, ignoreVary: true })
        .then((cached) => cached || fetch(request)),
    );
    return;
  }

  if (url.pathname.includes('/dict/')) {
    // Dictionary files are content-hashed and large: cache on first use, then serve from cache.
    event.respondWith(
      caches.open(DICT_CACHE).then((cache) =>
        cache.match(request, { ignoreVary: true }).then(
          (cached) =>
            cached ||
            fetch(request).then((response) => {
              if (response.ok && response.type === 'basic') cache.put(request, response.clone());
              return response;
            }),
        ),
      ),
    );
    return;
  }

  // ignoreVary: cached files are same-origin static assets; a "Vary: Origin" header from the
  // host would otherwise stop module scripts (sent with an Origin header) from matching.
  event.respondWith(
    caches
      .match(request, { cacheName: SHELL_CACHE, ignoreVary: true })
      .then((cached) => cached || fetch(request)),
  );
});
