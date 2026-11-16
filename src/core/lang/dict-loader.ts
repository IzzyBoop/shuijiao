import { Dictionary } from './dictionary';
import meta from './dict-meta.json';

let pending: Promise<Dictionary> | null = null;

/**
 * Loads the dictionary once (≈4 MB compressed). The service worker caches it,
 * so later loads and offline use are instant.
 */
export function loadDictionary(): Promise<Dictionary> {
  pending ??= (async () => {
    const url = new URL(meta.file, document.baseURI);
    if (url.origin !== window.location.origin) throw new Error('Dictionary must be same-origin.');
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) throw new Error(`Could not load the dictionary (HTTP ${res.status}).`);
    const dict = new Dictionary(await res.text());
    void pruneOldDictionaries(url.href);
    return dict;
  })().catch((err: unknown) => {
    pending = null;
    throw err;
  });
  return pending;
}

async function pruneOldDictionaries(current: string): Promise<void> {
  try {
    const cache = await caches.open('dict');
    for (const req of await cache.keys()) {
      if (req.url !== current) await cache.delete(req);
    }
  } catch {
    // Cache API unavailable (e.g. private mode): nothing to prune.
  }
}

export const dictionaryInfo = meta;
