import { convert } from 'pinyin-pro';

/** Converts CC-CEDICT numbered pinyin ("tou2 fa5", "lu:4") to tone marks ("tóu fa", "lǜ"). */
export function numberedToMarks(numbered: string): string {
  const prepared = numbered
    .replace(/u:/gi, (m) => (m.startsWith('U') ? 'V' : 'v'))
    .replace(/([a-zA-Z]+)5\b/g, '$1');
  const marked = convert(prepared, { format: 'numToSymbol' });
  return marked.replace(/v/g, 'ü').replace(/V/g, 'Ü');
}

const PUNCT: Record<string, string> = {
  '，': ',',
  '。': '.',
  '？': '?',
  '！': '!',
  '：': ':',
  '；': ';',
  '、': ',',
  '「': '"',
  '」': '"',
  '『': '"',
  '』': '"',
  '“': '"',
  '”': '"',
  '‘': "'",
  '’': "'",
  '（': '(',
  '）': ')',
  '《': '"',
  '》': '"',
  '…': '...',
  '—': '-',
  '～': '~',
  '·': '·',
};

export function isCjkPunctuation(ch: string): boolean {
  return ch in PUNCT;
}

export function westernPunctuation(ch: string): string {
  return PUNCT[ch] ?? ch;
}

const STARTS_WITH_VOWEL = /^[aeoāáǎàēéěèōóǒò]/i;

/**
 * Joins the syllables of one word the standard way: "yín" + "háng" → "yínháng",
 * with an apostrophe where a syllable starts with a/e/o ("xī" + "ān" → "xī'ān").
 */
export function joinWord(syllables: readonly string[]): string {
  return syllables.reduce(
    (acc, syl, i) => (i > 0 && STARTS_WITH_VOWEL.test(syl) ? `${acc}'${syl}` : acc + syl),
    '',
  );
}

export function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
