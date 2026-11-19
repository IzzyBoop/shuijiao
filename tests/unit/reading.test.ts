import { describe, expect, it } from 'vitest';
import { sameReading } from '../../src/core/lang/reading';

describe('sameReading: is this the same word?', () => {
  it('不 and 一 change tone with the next syllable: still the same word', () => {
    expect(sameReading('bù', 'bú', '不')).toBe(true);
    expect(sameReading('yī', 'yí', '一')).toBe(true);
    expect(sameReading('yī', 'yì', '一')).toBe(true);
    expect(sameReading('bùshì', 'búshì', '不是')).toBe(true);
    expect(sameReading('yígè', 'yī gè', '一個')).toBe(true);
    expect(sameReading('qī', 'qí', '七')).toBe(true);
    // …but only for those characters, and only in their own syllable.
    expect(sameReading('bùshì', 'bùshí', '不是')).toBe(false);
  });

  it('a neutral tone matches any tone', () => {
    expect(sameReading('xièxie', 'xiè xiè', '謝謝')).toBe(true);
    expect(sameReading('dōngxi', 'dōng xī', '東西')).toBe(true);
    expect(sameReading('xuésheng', 'xuéshēng', '學生')).toBe(true);
  });

  it('different words stay different', () => {
    expect(sameReading('háng', 'xíng', '行')).toBe(false); // other letters
    expect(sameReading('hǎo', 'hào', '好')).toBe(false); // same letters, a real tone difference
    expect(sameReading('cháng', 'zhǎng', '長')).toBe(false);
  });

  it("spacing, capitals, tone numbers, ü and apostrophes don't matter", () => {
    expect(sameReading('Nǐ hǎo', 'nǐhǎo', '你好')).toBe(true);
    expect(sameReading('ni3 hao3', 'nǐhǎo', '你好')).toBe(true);
    expect(sameReading('xie4xie5', 'xièxiè', '謝謝')).toBe(true);
    expect(sameReading('lǜ', 'lv4', '綠')).toBe(true);
    expect(sameReading('lü4', 'lǜ', '綠')).toBe(true);
    expect(sameReading("Xī'ān", 'xī ān', '西安')).toBe(true);
    expect(sameReading('ni3 hao3', 'nǐ hào', '你好')).toBe(false);
  });

  it('a reading without tones, or none at all, matches', () => {
    expect(sameReading('ni hao', 'nǐ hǎo', '你好')).toBe(true);
    expect(sameReading('', 'hǎo', '好')).toBe(true);
  });

  it('splits by the number of characters, including 兒', () => {
    expect(sameReading('yìdiǎnr', 'yī diǎn r', '一點兒')).toBe(true);
    expect(sameReading('xiān', 'xī ān', '西安')).toBe(true); // two characters, so xi + an
  });
});
