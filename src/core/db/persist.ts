/**
 * Asks the browser not to evict this site's storage under pressure. Browsers
 * may grant it silently, prompt, or refuse; the portal works either way.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!('storage' in navigator) || typeof navigator.storage.persist !== 'function') return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
