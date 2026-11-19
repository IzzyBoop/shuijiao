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

/** Whether the browser has agreed to keep this site's storage (false if it can't say). */
export async function isStoragePersisted(): Promise<boolean> {
  try {
    return 'storage' in navigator && typeof navigator.storage.persisted === 'function'
      ? await navigator.storage.persisted()
      : false;
  } catch {
    return false;
  }
}

/** Whether this browser lets a site ask to keep its storage at all. */
export function canPersistStorage(): boolean {
  return 'storage' in navigator && typeof navigator.storage.persist === 'function';
}
