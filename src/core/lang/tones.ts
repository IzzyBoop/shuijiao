// Kept separate from pinyin-format.ts so the main bundle doesn't pull in pinyin-pro.

/** The tone of one pinyin syllable (1–4, 5 = neutral), used for colouring. */
export function toneOf(syllable: string): 1 | 2 | 3 | 4 | 5 {
  const n = syllable.normalize('NFD');
  if (n.includes('\u0304')) return 1;
  if (n.includes('\u0301')) return 2;
  if (n.includes('\u030C')) return 3;
  if (n.includes('\u0300')) return 4;
  return 5;
}
