/**
 * Returns a normalised https URL, or null if the input is not a plain https link.
 * Rejects every other scheme (javascript:, data:, http:, file:, ...) and URLs with
 * embedded credentials. Used at build time (tools/check-resources.ts) and at render time.
 */
export function safeHttpsUrl(input: unknown): string | null {
  if (typeof input !== 'string' || input.length === 0 || input.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username !== '' || url.password !== '') return null;
  if (!url.hostname.includes('.')) return null;
  return url.href;
}
