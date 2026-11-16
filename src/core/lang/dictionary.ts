import { numberedToMarks } from './pinyin-format';

export interface DictEntry {
  traditional: string;
  simplified: string;
  /** Numbered pinyin as in CC-CEDICT, e.g. "tou2 fa5". */
  pinyinNumbered: string;
  glosses: string[];
}

const MAX_WORD = 12;

/**
 * In-memory CC-CEDICT index. Built from the text produced by tools/build-dict.ts.
 * Dictionary content is only ever rendered as text, never as HTML.
 */
export class Dictionary {
  private readonly bySimplified = new Map<string, DictEntry[]>();
  private readonly byTraditional = new Map<string, DictEntry[]>();
  private charTrad: Map<string, Set<string>> | null = null;

  constructor(text: string) {
    for (const line of text.split('\n')) {
      const parts = line.split('\t');
      if (parts.length !== 4) continue;
      const [trad = '', simpRaw = '', pinyin = '', defs = ''] = parts;
      if (!trad || trad.length > MAX_WORD * 4) continue;
      const entry: DictEntry = {
        traditional: trad,
        simplified: simpRaw === '=' ? trad : simpRaw,
        pinyinNumbered: pinyin,
        glosses: defs.split('/').filter(Boolean),
      };
      push(this.bySimplified, entry.simplified, entry);
      push(this.byTraditional, entry.traditional, entry);
    }
  }

  get size(): number {
    return this.bySimplified.size;
  }

  /** Entries whose simplified or traditional form equals the text. */
  lookup(text: string): DictEntry[] {
    const a = this.bySimplified.get(text) ?? [];
    const b = this.byTraditional.get(text) ?? [];
    return b.length === 0 ? a : [...new Set([...a, ...b])];
  }

  has(text: string): boolean {
    return this.bySimplified.has(text) || this.byTraditional.has(text);
  }

  /**
   * Splits text into dictionary words by forward maximum matching.
   * Characters that aren't in the dictionary come out as single-character segments.
   */
  segment(text: string): string[] {
    const chars = [...text];
    const out: string[] = [];
    let i = 0;
    while (i < chars.length) {
      let len = Math.min(MAX_WORD, chars.length - i);
      for (; len > 1; len--) {
        if (this.has(chars.slice(i, i + len).join(''))) break;
      }
      out.push(chars.slice(i, i + len).join(''));
      i += len;
    }
    return out;
  }

  /** Traditional characters a simplified character can correspond to (e.g. 发 → 發, 髮). */
  traditionalOptions(simplifiedChar: string): string[] {
    if (!this.charTrad) {
      this.charTrad = new Map();
      for (const [simp, entries] of this.bySimplified) {
        if ([...simp].length !== 1) continue;
        this.charTrad.set(simp, new Set(entries.map((e) => e.traditional)));
      }
    }
    return [...(this.charTrad.get(simplifiedChar) ?? [])];
  }
}

function push(map: Map<string, DictEntry[]>, key: string, entry: DictEntry): void {
  const list = map.get(key);
  if (list) list.push(entry);
  else map.set(key, [entry]);
}

const REF_WITH_BOTH = /([^\s|[\]/]+)\|([^\s|[\]/]+)\[([^\]]+)\]/g;
const REF_SINGLE = /([^\s|[\]/]+)\[([^\]]+)\]/g;

/** Turns CC-CEDICT cross-references like "個|个[ge4]" into "個/个 (gè)". */
export function formatGloss(gloss: string): string {
  return gloss
    .replace(REF_WITH_BOTH, (_m, t: string, s: string, p: string) => `${t}/${s} (${numberedToMarks(p)})`)
    .replace(REF_SINGLE, (_m, w: string, p: string) => `${w} (${numberedToMarks(p)})`);
}

/** Separates measure-word glosses ("CL:個|个[ge4]") from the meaning glosses. */
export function splitGlosses(glosses: readonly string[]): { meaning: string[]; measureWords: string[] } {
  const meaning: string[] = [];
  const measureWords: string[] = [];
  for (const g of glosses) {
    if (g.startsWith('CL:')) {
      measureWords.push(
        ...g
          .slice(3)
          .split(',')
          .map((x) => formatGloss(x.trim())),
      );
    } else {
      meaning.push(formatGloss(g));
    }
  }
  return { meaning, measureWords };
}
