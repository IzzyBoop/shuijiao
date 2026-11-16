import { describe, expect, it } from 'vitest';
import { diffText, tokenize } from '../../src/core/diff';

const marked = (segs: { text: string; changed: boolean }[]) =>
  segs.map((s) => (s.changed ? `[${s.text}]` : s.text)).join('');

describe('diffText', () => {
  it('splits Chinese by character and English by word', () => {
    expect(tokenize('我們 are here.')).toEqual(['我', '們', ' ', 'are', ' ', 'here', '.']);
  });

  it('marks a word added at the end', () => {
    const d = diffText('goodbye; see you again later', 'goodbye; see you again later. test');
    expect(marked(d.before)).toBe('goodbye; see you again later');
    expect(marked(d.after)).toBe('goodbye; see you again later[. test]');
  });

  it('marks words removed and added in the middle', () => {
    const d = diffText('to thank; thanks', 'to thank; thank you');
    expect(marked(d.before)).toBe('to thank; [thanks]');
    expect(marked(d.after)).toBe('to thank; [thank you]');
  });

  it('compares Chinese character by character', () => {
    const d = diffText('我是學生', '我不是學生');
    expect(marked(d.before)).toBe('我是學生');
    expect(marked(d.after)).toBe('我[不]是學生');
  });

  it('handles empty text and identical text', () => {
    expect(marked(diffText('', 'test').after)).toBe('[test]');
    expect(diffText('', 'test').before).toEqual([]);
    expect(marked(diffText('same', 'same').after)).toBe('same');
  });

  it('falls back to marking everything for very long texts', () => {
    const long = 'word '.repeat(600);
    const d = diffText(long, `${long}extra`);
    expect(d.after).toEqual([{ text: `${long}extra`, changed: true }]);
  });
});
