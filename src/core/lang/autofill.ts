import { pinyin as pinyinPro } from 'pinyin-pro';
import { convertToSimplified, convertToTraditional, detectScript, type Script } from './convert';
import { splitGlosses, type DictEntry, type Dictionary } from './dictionary';
import { loadDictionary } from './dict-loader';
import { capitalize, isCjkPunctuation, joinWord, numberedToMarks, westernPunctuation } from './pinyin-format';
import type { CardKind } from '../db/model';
import { orList } from '../format';

export interface AmbiguousSegment {
  /** Position of the segment in the text, in characters. */
  index: number;
  simplified: string;
  chosen: string;
  options: { traditional: string; gloss: string }[];
}

export interface WordGloss {
  simplified: string;
  traditional: string;
  pinyin: string;
  gloss: string;
}

export interface AutoFill {
  script: Script;
  kind: CardKind;
  traditional: string;
  simplified: string;
  pinyin: string;
  /** The pinyin formatted as a word ("yínháng") and as a sentence ("Wǒmen qù yínháng."). */
  pinyinAsWord: string;
  pinyinAsSentence: string;
  pinyinOptions: string[];
  meaning: string;
  meaningOptions: string[];
  notes: string;
  ambiguous: AmbiguousSegment[];
  wordGlosses: WordGloss[];
  inDictionary: boolean;
}

const HAN = /\p{Script=Han}/u;

export function containsHanzi(text: string): boolean {
  return HAN.test(text);
}

/** Auto-fills every card field from a word or sentence typed in either script. */
export async function autofill(input: string): Promise<AutoFill> {
  const dict = await loadDictionary();
  return autofillWith(dict, input);
}

/** The pure part of autofill, separated so it can be unit-tested with a small dictionary. */
export function autofillWith(dict: Dictionary, input: string): AutoFill {
  const text = input.trim();
  const script = detectScript(text);
  const simplified = script === 'simplified' || script === 'same' ? text : convertToSimplified(text);
  let traditional = script === 'traditional' || script === 'same' ? text : convertToTraditional(text);

  const wholeEntries = uniqueEntries([...dict.lookup(simplified), ...dict.lookup(text)]).filter(
    (e) => e.simplified === simplified,
  );
  const inDictionary = wholeEntries.length > 0;

  // A dictionary word with exactly one traditional form beats the converter.
  const wholeTrads = [...new Set(wholeEntries.map((e) => e.traditional))];
  if (script !== 'traditional' && wholeTrads.length === 1 && wholeTrads[0]) traditional = wholeTrads[0];

  const segments = dict.segment(simplified);
  const ambiguous = script === 'traditional' ? [] : findAmbiguous(dict, segments, traditional);

  const chars = [...simplified];
  const readings = pinyinPro(simplified, { type: 'all', toneType: 'symbol' }).map((r) => r.pinyin);
  const hasPunctuation = chars.some(isCjkPunctuation) || /[.?!,;]/.test(simplified);
  const hanSegments = segments.filter((s) => HAN.test(s));
  const kind: CardKind =
    !inDictionary && (hasPunctuation || hanSegments.length >= 3 || chars.length > 6) ? 'sentence' : 'word';

  // Build pinyin word by word, so each word's syllables are joined ("yínháng").
  const words: string[] = [];
  const spaced: string[] = [];
  let offset = 0;
  for (const seg of segments) {
    const len = [...seg].length;
    const syllables = readings.slice(offset, offset + len);
    offset += len;
    if (HAN.test(seg)) {
      const syl = syllables.filter(Boolean);
      words.push(joinWord(syl));
      spaced.push(...syl);
    } else if ([...seg].every(isCjkPunctuation) || /^[.?!,;:]+$/.test(seg)) {
      const p = [...seg].map(westernPunctuation).join('');
      appendToLast(words, p);
      appendToLast(spaced, p);
    } else if (seg.trim()) {
      words.push(seg.trim());
      spaced.push(seg.trim());
    }
  }
  let pinyinAsWord = words.join(' ');
  let spacedPinyin = spaced.join(' ');

  const dictReadings = wholeEntries.map((e) => joinWord(numberedToMarks(e.pinyinNumbered).split(' ')));
  // Use dictionary capitalisation for proper nouns (Běijīng), but only when no common-noun
  // reading matches exactly (书 is "shū", even though "Shū" is also an entry).
  if (!dictReadings.includes(pinyinAsWord)) {
    const caseMatch = dictReadings.find((r) => r.toLowerCase() === pinyinAsWord.toLowerCase());
    if (caseMatch) pinyinAsWord = caseMatch;
  }
  const pinyinAsSentence = capitalize(pinyinAsWord);
  const pinyin = kind === 'sentence' ? pinyinAsSentence : pinyinAsWord;
  if (kind === 'sentence') spacedPinyin = capitalize(spacedPinyin);
  const pinyinOptions = dedupe([...dictReadings, spacedPinyin].filter((p) => p !== pinyin));

  let meaning = '';
  let notes = '';
  const meaningOptions: string[] = [];
  if (kind === 'word' && inDictionary) {
    // Entries whose reading matches the chosen pinyin exactly come first, then case-insensitive matches.
    const score = (e: DictEntry) => {
      const r = readingOf(e);
      return r === pinyin ? 2 : r.toLowerCase() === pinyin.toLowerCase() ? 1 : 0;
    };
    const ordered = [...wholeEntries].sort((a, b) => score(b) - score(a));
    for (const entry of ordered) {
      const { meaning: m, measureWords } = splitGlosses(entry.glosses);
      const line = m.join('; ');
      if (!meaning) {
        meaning = line;
        if (measureWords.length) {
          notes = `Measure word${measureWords.length > 1 ? 's' : ''}: ${orList(measureWords)}`;
        }
      } else if (line && line !== meaning) {
        meaningOptions.push(line);
      }
    }
  }

  const wordGlosses: WordGloss[] =
    kind === 'sentence' || !inDictionary
      ? hanSegments.flatMap((seg) => {
          const entry = dict.lookup(seg).find((e) => e.simplified === seg);
          if (!entry) return [];
          const { meaning: m } = splitGlosses(entry.glosses);
          return [
            {
              simplified: entry.simplified,
              traditional: entry.traditional,
              pinyin: joinWord(numberedToMarks(entry.pinyinNumbered).split(' ')),
              gloss: m.slice(0, 3).join('; '),
            },
          ];
        })
      : [];

  return {
    script,
    kind,
    traditional,
    simplified,
    pinyin,
    pinyinAsWord,
    pinyinAsSentence,
    pinyinOptions,
    meaning,
    meaningOptions: dedupe(meaningOptions),
    notes,
    ambiguous,
    wordGlosses,
    inDictionary,
  };
}

/** Flags simplified segments that map to more than one traditional form (发 → 發/髮). */
function findAmbiguous(
  dict: Dictionary,
  segments: readonly string[],
  traditional: string,
): AmbiguousSegment[] {
  const tradChars = [...traditional];
  const out: AmbiguousSegment[] = [];
  let index = 0;
  for (const seg of segments) {
    const len = [...seg].length;
    if (HAN.test(seg)) {
      const entries = dict.lookup(seg).filter((e) => e.simplified === seg);
      const byTrad = new Map<string, string>();
      for (const e of entries) {
        if (!byTrad.has(e.traditional))
          byTrad.set(e.traditional, splitGlosses(e.glosses).meaning.slice(0, 2).join('; '));
      }
      if (byTrad.size > 1) {
        out.push({
          index,
          simplified: seg,
          chosen: tradChars.slice(index, index + len).join(''),
          options: [...byTrad].map(([t, gloss]) => ({ traditional: t, gloss })),
        });
      }
    }
    index += len;
  }
  return out;
}

/** Replaces the characters of one segment inside the traditional text. */
export function replaceSegment(
  traditional: string,
  index: number,
  length: number,
  replacement: string,
): string {
  const chars = [...traditional];
  chars.splice(index, length, ...replacement);
  return chars.join('');
}

function readingOf(e: DictEntry): string {
  return joinWord(numberedToMarks(e.pinyinNumbered).split(' '));
}

function appendToLast(list: string[], suffix: string): void {
  if (list.length === 0) list.push(suffix);
  else list[list.length - 1] = `${list.at(-1) ?? ''}${suffix}`;
}

function uniqueEntries(entries: DictEntry[]): DictEntry[] {
  return [...new Set(entries)];
}

function dedupe(list: string[]): string[] {
  return [...new Set(list.filter(Boolean))];
}
