import { pinyin as pinyinPro } from 'pinyin-pro';
import type { WordGloss } from './autofill';
import { splitGlosses, type DictEntry, type Dictionary } from './dictionary';
import { loadDictionary } from './dict-loader';
import { joinWord, numberedToMarks } from './pinyin-format';

const HAN = /\p{Script=Han}/u;

export interface Breakdown {
  /** Sentences and phrases split into words; single dictionary words into characters. */
  by: 'word' | 'character';
  parts: WordGloss[];
}

const NONE: Breakdown = { by: 'word', parts: [] };

/** Glosses that only say "surname …" or "variant of …" aren't useful as a meaning. */
const UNHELPFUL = /^(surname |(old |archaic )?variant of |used in )/i;

/**
 * Splits a card's text into its words (or, for a single word, its characters) with a
 * short dictionary meaning for each, for the answer side of a flashcard. Readings come
 * from the whole text in context, so 行 in 銀行 is "háng", not "xíng".
 */
export function breakdownWith(
  dict: Dictionary,
  card: { traditional: string; simplified: string },
): Breakdown {
  const simplified = [...card.simplified];
  const traditional = [...card.traditional];
  if (simplified.filter((c) => HAN.test(c)).length < 2) return NONE;
  // The traditional text lines up character for character, except in rare edited cards.
  const tradAt = (start: number, len: number) =>
    traditional.length === simplified.length ? traditional.slice(start, start + len).join('') : '';
  const readings = pinyinPro(card.simplified, { type: 'all', toneType: 'symbol' }).map((r) => r.pinyin);

  const segments = dict.segment(card.simplified);
  const hanSegments = segments.filter((s) => HAN.test(s));
  const by: Breakdown['by'] = hanSegments.length >= 2 ? 'word' : 'character';
  const pieces = by === 'word' ? segments : simplified;

  const parts: WordGloss[] = [];
  const seen = new Set<string>();
  let at = 0;
  for (const piece of pieces) {
    const len = [...piece].length;
    const start = at;
    at += len;
    if (!HAN.test(piece)) continue;
    const reading = joinWord(readings.slice(start, start + len).filter(Boolean));
    const trad = tradAt(start, len);
    // A repeated character or word (謝謝) is explained once.
    const key = `${trad || piece}\t${reading}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = bestEntry(dict.lookup(piece), piece, trad, reading);
    if (!entry) continue;
    const meaning = splitGlosses(entry.glosses).meaning.filter((g) => !UNHELPFUL.test(g));
    if (meaning.length === 0) continue;
    parts.push({
      simplified: piece,
      traditional: trad || entry.traditional,
      pinyin: reading || joinWord(numberedToMarks(entry.pinyinNumbered).split(' ')),
      gloss: meaning.slice(0, 3).join('; '),
    });
  }
  return parts.length > 0 ? { by, parts } : NONE;
}

/** The entry that best matches the characters and their reading in context. */
function bestEntry(
  entries: readonly DictEntry[],
  simplified: string,
  traditional: string,
  reading: string,
): DictEntry | undefined {
  let best: DictEntry | undefined;
  let bestScore = -Infinity;
  for (const e of entries) {
    if (e.simplified !== simplified) continue;
    const r = joinWord(numberedToMarks(e.pinyinNumbered).split(' '));
    let score = 0;
    if (traditional && e.traditional === traditional) score += 4;
    if (r === reading) score += 2;
    else if (r.toLowerCase() === reading.toLowerCase()) score += 1;
    if (e.glosses.every((g) => UNHELPFUL.test(g))) score -= 8;
    if (score > bestScore) {
      best = e;
      bestScore = score;
    }
  }
  return best;
}

const cache = new Map<string, Breakdown>();

/** Starts loading the dictionary ahead of time, so the first answer doesn't wait for it. */
export function warmUp(): Promise<unknown> {
  return loadDictionary();
}

/** The breakdown for a card, loading the dictionary the first time (cached for offline use). */
export async function breakdown(card: { traditional: string; simplified: string }): Promise<Breakdown> {
  const key = `${card.traditional}\t${card.simplified}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const result = breakdownWith(await loadDictionary(), card);
  if (cache.size > 500) cache.clear();
  cache.set(key, result);
  return result;
}
