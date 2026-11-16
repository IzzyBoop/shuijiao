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

export type UserUrlResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Turns what a student typed into a safe https link. Adds "https://" to bare
 * domains ("example.com/page"); refuses http and every other scheme.
 */
export function normaliseUserUrl(input: string): UserUrlResult {
  const raw = input.trim();
  if (!raw) return { ok: false, error: 'Enter a web address.' };
  if (/^http:\/\//i.test(raw)) {
    return { ok: false, error: 'Only secure links (https://) can be saved. Try the https:// version.' };
  }
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw);
  // A bare domain like "example.com/x" has no scheme; anything else with a colon
  // before the first slash (javascript:, data:, mailto:, ...) is refused.
  const candidate = hasScheme ? raw : `https://${raw.replace(/^\/+/, '')}`;
  const url = safeHttpsUrl(candidate);
  if (!url) return { ok: false, error: 'That is not a valid https:// web address.' };
  return { ok: true, url };
}
