import { readRawPref, writeRawPref } from '../safe/prefs';

/**
 * The optional Chinese serif for the 墨 Ink style: Noto Serif TC (Medium), split into
 * pieces by Unicode range (public/fonts/noto-serif-tc/). By default Ink uses the device's
 * own serif; a student can download Noto in Settings so it looks the same everywhere and
 * works offline. The pieces go into the "fonts" cache, which the service worker serves.
 */

const BASE = 'fonts/noto-serif-tc/';
const CSS = `${BASE}noto-serif-tc.css`;
const CACHE = 'fonts';
/** Shown before downloading. Measured from the files (104 pieces). */
export const NOTO_SIZE_MB = 2.9;

export function notoChosen(): boolean {
  return readRawPref('theme.inkFont') === 'noto';
}

/** Adds (or removes) the stylesheet that defines the font, if the student chose it. */
export function applyInkFont(on = notoChosen()): void {
  const id = 'ink-noto-css';
  const existing = document.getElementById(id);
  if (on && !existing) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = CSS;
    document.head.append(link);
  } else if (!on && existing) {
    existing.remove();
  }
}

async function pieceUrls(): Promise<string[]> {
  const response = await fetch(CSS, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Could not get the font list (HTTP ${response.status}).`);
  const css = await response.text();
  const urls = [...css.matchAll(/url\(\.\/([\w.-]+\.woff2)\)/g)].map((m) => `${BASE}${m[1] ?? ''}`);
  return [CSS, ...urls];
}

/** Downloads every piece into the cache (reporting progress), then switches the font on. */
export async function downloadNoto(onProgress: (done: number, total: number) => void): Promise<void> {
  const urls = await pieceUrls();
  const cache = 'caches' in window ? await caches.open(CACHE) : null;
  let done = 0;
  onProgress(0, urls.length);
  for (let i = 0; i < urls.length; i += 6) {
    await Promise.all(
      urls.slice(i, i + 6).map(async (url) => {
        if (cache) {
          if (!(await cache.match(url))) await cache.add(url);
        } else {
          const r = await fetch(url);
          if (!r.ok) throw new Error(`Could not download ${url} (HTTP ${r.status}).`);
        }
        done++;
        onProgress(done, urls.length);
      }),
    );
  }
  writeRawPref('theme.inkFont', 'noto');
  applyInkFont(true);
}

/** Switches back to the device's serif and frees the space. */
export async function removeNoto(): Promise<void> {
  writeRawPref('theme.inkFont', 'device');
  applyInkFont(false);
  if (!('caches' in window)) return;
  const cache = await caches.open(CACHE);
  for (const request of await cache.keys()) {
    if (new URL(request.url).pathname.includes('/fonts/noto-serif-tc/')) await cache.delete(request);
  }
}
