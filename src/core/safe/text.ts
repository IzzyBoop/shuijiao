// Control characters other than tab/newline, plus Unicode bidi overrides/isolates that
// can be used to make text display differently from what it contains.
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‎‏‪-‮⁦-⁩]/g;

/** Normalises user text: NFC, strips unsafe control characters, trims, enforces a max length. */
export function cleanText(input: string, max: number, multiline = false): string {
  let s = input.normalize('NFC').replace(UNSAFE_CHARS, '');
  if (!multiline) s = s.replace(/[\r\n\t]+/g, ' ');
  s = s.trim();
  return s.length > max ? s.slice(0, max) : s;
}

export function hasUnsafeChars(input: string): boolean {
  UNSAFE_CHARS.lastIndex = 0;
  const found = UNSAFE_CHARS.test(input);
  UNSAFE_CHARS.lastIndex = 0;
  return found;
}

export function cleanTags(input: string): string[] {
  const seen = new Set<string>();
  for (const raw of input.split(/[,，\s]+/)) {
    const tag = cleanText(raw, 32).toLowerCase();
    if (tag) seen.add(tag);
    if (seen.size >= 20) break;
  }
  return [...seen];
}
