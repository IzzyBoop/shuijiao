import { readRawPref, removeRawPref } from '../safe/prefs';

/**
 * v1.3.0 let 墨 Ink users download Noto Serif TC (2.9 MB) into the "fonts" cache. That
 * option was removed in the next release; this frees the space, once, for anyone who had
 * downloaded it. Ink now uses the device's own serif.
 */
export async function cleanUpNotoDownload(): Promise<void> {
  if (readRawPref('theme.inkFont') === null) return;
  removeRawPref('theme.inkFont');
  try {
    if (!('caches' in window)) return;
    const cache = await caches.open('fonts');
    for (const request of await cache.keys()) {
      if (new URL(request.url).pathname.includes('/fonts/noto-serif-tc/')) await cache.delete(request);
    }
  } catch {
    // Cache storage unavailable: nothing was stored there either.
  }
}
