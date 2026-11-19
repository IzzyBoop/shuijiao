// EMERGENCY ONLY: a service worker that removes itself. If a released service worker is
// broken (for example, it serves a version that crashes and never updates), deploy this
// in its place: Actions → "CI and deploy" → Run workflow → tick the kill switch.
//
// Browsers check sw.js for changes on every visit. They install this one, which deletes
// the portal's caches and unregisters itself. The open page keeps working, and from the
// next visit the portal loads straight from the site, with no service worker, until a
// normal release brings it back. Study data (IndexedDB) is not touched.
//
// It never reloads pages itself: the portal registers sw.js on every visit, so a reload
// here would repeat forever.
'use strict';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.registration.unregister()),
  );
});
