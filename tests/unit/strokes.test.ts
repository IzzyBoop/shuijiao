import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isStrokeData, strokeChars, strokeFile } from '../../src/core/lang/strokes';

const DATA = 'node_modules/hanzi-writer-data';

describe('stroke order data', () => {
  it('files are named by code point, in plain ASCII', () => {
    expect(strokeFile('我')).toBe('strokes/6211.json');
    expect(strokeFile('學')).toBe('strokes/5b78.json');
    expect(strokeFile('𠀀')).toBe('strokes/20000.json'); // beyond the BMP: the whole character
  });

  it('picks out each Chinese character once, in order, without punctuation or Latin', () => {
    expect(strokeChars('我是學生。')).toEqual(['我', '是', '學', '生']);
    expect(strokeChars('謝謝！OK 好')).toEqual(['謝', '好']);
    expect(strokeChars('ABC，123')).toEqual([]);
  });

  it('accepts real stroke files and rejects anything else', () => {
    const real: unknown = JSON.parse(readFileSync(`${DATA}/我.json`, 'utf8'));
    expect(isStrokeData(real)).toBe(true);

    const one = { strokes: ['M 1 2 L 3 4 Z'], medians: [[[1, 2]]] };
    expect(isStrokeData(one)).toBe(true);
    expect(isStrokeData({ ...one, radStrokes: [0] })).toBe(true);

    expect(isStrokeData(null)).toBe(false);
    expect(isStrokeData('M 1 2')).toBe(false);
    expect(isStrokeData({ strokes: [], medians: [] })).toBe(false); // no strokes
    expect(isStrokeData({ ...one, medians: [] })).toBe(false); // medians don't match
    expect(isStrokeData({ ...one, strokes: ['<script>'] })).toBe(false); // not a path
    expect(isStrokeData({ ...one, strokes: ['M 1 1 '.repeat(5000)] })).toBe(false); // far too long
    expect(isStrokeData({ ...one, radStrokes: ['0'] })).toBe(false);
    const many = Array.from({ length: 65 }, () => 'M 1 2 Z');
    expect(isStrokeData({ strokes: many, medians: many.map(() => []) })).toBe(false);
  });

  it('every file the build ships passes the check', () => {
    const files = readdirSync(DATA).filter((f) => /^.\.json$/u.test(f));
    expect(files.length).toBeGreaterThan(9000);
    const bad = files.filter((f) => !isStrokeData(JSON.parse(readFileSync(`${DATA}/${f}`, 'utf8'))));
    expect(bad).toEqual([]);
  });
});
