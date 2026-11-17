import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { autofillWith, replaceSegment } from '../../src/core/lang/autofill';
import { Dictionary, formatGloss } from '../../src/core/lang/dictionary';
import { detectScript } from '../../src/core/lang/convert';
import { joinWord, numberedToMarks } from '../../src/core/lang/pinyin-format';
import { toneOf } from '../../src/core/lang/tones';
import meta from '../../src/core/lang/dict-meta.json';

let dict: Dictionary;
beforeAll(() => {
  dict = new Dictionary(readFileSync(`public/${meta.file}`, 'utf8'));
});

describe('pinyin formatting', () => {
  it('converts CC-CEDICT numbered pinyin', () => {
    expect(numberedToMarks('tou2 fa5')).toBe('tóu fa');
    expect(numberedToMarks('lu:4')).toBe('lǜ');
    expect(numberedToMarks('nu:3 er2')).toBe('nǚ ér');
    expect(numberedToMarks('Bei3 jing1')).toBe('Běi jīng');
  });

  it('joins syllables with apostrophes where needed', () => {
    expect(joinWord(['xī', 'ān'])).toBe("xī'ān");
    expect(joinWord(['yín', 'háng'])).toBe('yínháng');
  });

  it('detects tones', () => {
    expect([toneOf('mā'), toneOf('má'), toneOf('mǎ'), toneOf('mà'), toneOf('ma')]).toEqual([1, 2, 3, 4, 5]);
  });

  it('formats dictionary cross-references', () => {
    expect(formatGloss('variant of 個|个[ge4]')).toBe('variant of 個/个 (gè)');
    expect(formatGloss('Taiwan pr. [fa3]')).toBe('Taiwan pr. fǎ');
  });
});

describe('script detection', () => {
  it('tells traditional from simplified', () => {
    expect(detectScript('銀行')).toBe('traditional');
    expect(detectScript('银行')).toBe('simplified');
    expect(detectScript('你好')).toBe('same');
  });
});

describe('autofill', () => {
  it('fills a simplified word', () => {
    const r = autofillWith(dict, '银行');
    expect(r.kind).toBe('word');
    expect(r.traditional).toBe('銀行');
    expect(r.simplified).toBe('银行');
    expect(r.pinyin).toBe('yínháng');
    expect(r.meaning).toMatch(/bank/);
  });

  it('fills a traditional word', () => {
    const r = autofillWith(dict, '頭髮');
    expect(r.simplified).toBe('头发');
    expect(r.traditional).toBe('頭髮');
    expect(r.pinyin).toBe('tóufa');
    expect(r.meaning).toMatch(/hair/);
  });

  it('picks the right traditional form from the dictionary word', () => {
    expect(autofillWith(dict, '头发').traditional).toBe('頭髮');
    expect(autofillWith(dict, '发展').traditional).toBe('發展');
  });

  it('flags single characters with several traditional forms', () => {
    const r = autofillWith(dict, '发');
    expect(r.ambiguous.length).toBe(1);
    expect(r.ambiguous[0]?.options.map((o) => o.traditional)).toEqual(expect.arrayContaining(['發', '髮']));
  });

  it('keeps proper-noun capitalisation', () => {
    expect(autofillWith(dict, '北京').pinyin).toBe('Běijīng');
  });

  it('offers other readings of polyphonic words', () => {
    const r = autofillWith(dict, '行');
    expect([r.pinyin, ...r.pinyinOptions]).toEqual(expect.arrayContaining(['xíng', 'háng']));
  });

  it('handles a sentence', () => {
    const r = autofillWith(dict, '我们去银行。');
    expect(r.kind).toBe('sentence');
    expect(r.traditional).toBe('我們去銀行。');
    expect(r.pinyin).toBe('Wǒmen qù yínháng.');
    expect(r.meaning).toBe('');
    expect(r.wordGlosses.map((g) => g.simplified)).toEqual(['我们', '去', '银行']);
  });

  it('offers both word-style and sentence-style pinyin', () => {
    const s = autofillWith(dict, '我们去银行。');
    expect(s.pinyinAsSentence).toBe('Wǒmen qù yínháng.');
    expect(s.pinyinAsWord).toBe('wǒmen qù yínháng.');
    const w = autofillWith(dict, '银行');
    expect([w.pinyinAsWord, w.pinyinAsSentence]).toEqual(['yínháng', 'Yínháng']);
    // Proper nouns keep their capital either way.
    expect(autofillWith(dict, '北京').pinyinAsWord).toBe('Běijīng');
  });

  it('moves measure words to notes', () => {
    const r = autofillWith(dict, '书');
    expect(r.notes).toMatch(/^Measure words?: /);
    // Several measure words are offered as alternatives, with the Oxford comma.
    expect(r.notes).toMatch(/, or /);
    expect(r.meaning).not.toMatch(/CL:/);
  });

  it('replaces a segment of traditional text', () => {
    expect(replaceSegment('頭發', 1, 1, '髮')).toBe('頭髮');
  });
});
