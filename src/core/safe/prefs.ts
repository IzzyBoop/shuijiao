/**
 * Small preference store on top of localStorage. Every access is wrapped in
 * try/catch because storage can be blocked (private mode, disabled site data).
 * Values are always validated on read; a bad or missing value returns the fallback.
 */
const PREFIX = 'portal.';

export function readPref<T>(key: string, fallback: T, isValid: (v: unknown) => v is T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the preference simply won't persist.
  }
}

/** Raw string prefs read by public/theme-init.js before the app loads. */
export function writeRawPref(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    // ignore
  }
}

export function readRawPref(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
export const isNumberIn =
  (min: number, max: number) =>
  (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
export const isOneOf =
  <T extends string>(options: readonly T[]) =>
  (v: unknown): v is T =>
    typeof v === 'string' && (options as readonly string[]).includes(v);
export const isShortString =
  (max: number) =>
  (v: unknown): v is string =>
    typeof v === 'string' && v.length <= max;
