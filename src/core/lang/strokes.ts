/**
 * Stroke order data for single characters (mainland standard), from hanzi-writer-data
 * (Make Me a Hanzi, Arphic Public License). The build copies it to strokes/<code point>.json
 * (see vite.config.ts); each file is fetched the first time its character is viewed, then
 * the service worker keeps it for offline use.
 */

const HAN = /\p{Script=Han}/u;

/** strokes/6211.json for 我: plain ASCII names, whatever the character. */
export function strokeFile(char: string): string {
  return `strokes/${(char.codePointAt(0) ?? 0).toString(16)}.json`;
}

/** The distinct Chinese characters in some text, in order (punctuation and Latin left out). */
export function strokeChars(text: string): string[] {
  return [...new Set([...text].filter((c) => HAN.test(c)))];
}

export interface StrokeData {
  strokes: string[];
  medians: number[][][];
  radStrokes?: number[];
}

/** Checks the shape of a stroke file before it is drawn (it comes from our own site, but still). */
export function isStrokeData(value: unknown): value is StrokeData {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const pathOk = (s: unknown) => typeof s === 'string' && s.length < 20_000 && /^[MLQCZ0-9 .,-]+$/.test(s);
  return (
    Array.isArray(v.strokes) &&
    v.strokes.length > 0 &&
    v.strokes.length <= 64 &&
    v.strokes.every(pathOk) &&
    Array.isArray(v.medians) &&
    v.medians.length === v.strokes.length &&
    (v.radStrokes === undefined ||
      (Array.isArray(v.radStrokes) && v.radStrokes.every((n) => Number.isInteger(n))))
  );
}

export class StrokesUnavailable extends Error {
  override name = 'StrokesUnavailable';
}

/** The stroke data for one character; StrokesUnavailable if there is none (rare characters). */
export async function loadStrokes(char: string): Promise<StrokeData> {
  const response = await fetch(strokeFile(char));
  if (response.status === 404) throw new StrokesUnavailable(char);
  if (!response.ok) throw new Error(`Could not load the stroke order (HTTP ${response.status}).`);
  // A server that answers every unknown path with the app's page (as `vite preview` does)
  // means the same as a 404: there is no file for this character.
  if (!(response.headers.get('content-type') ?? '').includes('json')) throw new StrokesUnavailable(char);
  const data: unknown = await response.json();
  if (!isStrokeData(data)) throw new StrokesUnavailable(char);
  return data;
}
