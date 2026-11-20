// Service worker template. vite.config.ts fills in VERSION and PRECACHE at build time
// and writes the result to dist/sw.js.
'use strict';

const VERSION = __VERSION__;
const PRECACHE = __PRECACHE__;
const SHELL_CACHE = 'shell-' + VERSION;
const DICT_CACHE = 'dict';
const COURSE_CACHE = 'course';
const FONT_CACHE = 'fonts';
const STROKE_CACHE = 'strokes';

// Files in assets/ have their content's hash in their name: the same name means the
// same file. Take those from the previous version's cache instead of downloading them
// again, so an update only downloads what changed. Everything else (the page, the
// manifest, icons) is fetched fresh. If any file fails, the install fails and is
// retried later, so a version is never half-cached.
async function precache() {
  const cache = await caches.open(SHELL_CACHE);
  const previous = (await caches.keys()).filter((key) => key.startsWith('shell-') && key !== SHELL_CACHE);
  const fromPrevious = async (url) => {
    for (const key of previous) {
      const hit = await caches.match(url, { cacheName: key, ignoreVary: true });
      if (hit) return hit;
    }
    return undefined;
  };
  await Promise.all(
    PRECACHE.map(async (url) => {
      const kept = url.startsWith('./assets/') ? await fromPrevious(url) : undefined;
      const response = kept || (await fetch(new Request(url, { cache: 'reload' })));
      if (!response.ok) throw new Error('Could not download ' + url);
      await cache.put(url, response);
    }),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![SHELL_CACHE, DICT_CACHE, COURSE_CACHE, FONT_CACHE, STROKE_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  // Only pages on this site can reach the worker, but check the sender anyway.
  if (event.origin !== self.location.origin) return;
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Videos stream straight from the site (with range requests) and are never cached.
  if (url.pathname.includes('/media/')) return;

  if (request.mode === 'navigate') {
    // Single-page app with hash routing: every navigation is the app shell.
    event.respondWith(
      caches
        .match('./', { cacheName: SHELL_CACHE, ignoreSearch: true, ignoreVary: true })
        .then((cached) => cached || fetch(request)),
    );
    return;
  }

  if (url.pathname.endsWith('.woff2') || url.pathname.includes('/fonts/cjk/')) {
    // Fonts (墨 Ink's, and the Chinese ones for devices without their own) aren't
    // precached: each is cached on first use, then served from the cache. Their names
    // change with their content, so a cached copy is never out of date.
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
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

  if (url.pathname.includes('/strokes/')) {
    // Stroke order data, one small file per character: cached the first time it's viewed.
    event.respondWith(
      caches.open(STROKE_CACHE).then((cache) =>
        cache.match(request, { ignoreVary: true }).then(
          (cached) =>
            cached ||
            fetch(request).then((response) => {
              const json = response.headers.get('content-type')?.includes('json');
              if (response.ok && response.type === 'basic' && json) cache.put(request, response.clone());
              return response;
            }),
        ),
      ),
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

  if (url.pathname.endsWith('/course/course-deck.json')) {
    // The course cards change now and then: always ask the site first, and keep the last
    // good copy so the Course cards page still works offline.
    event.respondWith(
      caches.open(COURSE_CACHE).then((cache) =>
        fetch(request)
          .then((response) => {
            if (response.ok && response.type === 'basic') cache.put(request, response.clone());
            return response;
          })
          .catch(() =>
            cache.match(request, { ignoreVary: true }).then((cached) => cached || Response.error()),
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
