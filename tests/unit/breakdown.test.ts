import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { breakdownWith } from '../../src/core/lang/breakdown';
import { Dictionary } from '../../src/core/lang/dictionary';
import meta from '../../src/core/lang/dict-meta.json';

let dict: Dictionary;
beforeAll(() => {
  dict = new Dictionary(readFileSync(`public/${meta.file}`, 'utf8'));
});

const parts = (traditional: string, simplified: string) =>
  breakdownWith(dict, { traditional, simplified }).parts.map((p) => [p.traditional, p.pinyin]);

describe('word-by-word meanings for the answer side', () => {
  it('splits a two-character word into its characters, read in context', () => {
    const r = breakdownWith(dict, { traditional: '銀行', simplified: '银行' });
    expect(r.by).toBe('character');
    expect(parts('銀行', '银行')).toEqual([
      ['銀', 'yín'],
      ['行', 'háng'],
    ]);
    expect(r.parts[0]?.gloss).toMatch(/^silver/);
    expect(r.parts[1]?.gloss).toContain('commercial firm');
  });

  it('splits a sentence into dictionary words, skipping punctuation', () => {
    const r = breakdownWith(dict, { traditional: '我們去銀行。', simplified: '我们去银行。' });
    expect(r.by).toBe('word');
    expect(parts('我們去銀行。', '我们去银行。')).toEqual([
      ['我們', 'wǒmen'],
      ['去', 'qù'],
      ['銀行', 'yínháng'],
    ]);
    expect(r.parts[2]?.gloss).toBe('bank');
  });

  it('shows the traditional characters from the card', () => {
    expect(parts('頭髮', '头发').map(([t]) => t)).toEqual(['頭', '髮']);
  });

  it('explains a repeated character once', () => {
    expect(parts('謝謝', '谢谢')).toEqual([['謝', 'xiè']]);
  });

  it('prefers a real meaning over "surname …"', () => {
    const r = breakdownWith(dict, { traditional: '歷史', simplified: '历史' });
    expect(r.parts[1]?.gloss).toMatch(/history/);
    expect(r.parts.every((p) => !/^surname/i.test(p.gloss))).toBe(true);
  });

  it('has nothing to add for a single character', () => {
    expect(breakdownWith(dict, { traditional: '好', simplified: '好' }).parts).toEqual([]);
  });
});
