import { describe, expect, it } from 'vitest';
import { normaliseUserUrl, safeHttpsUrl } from '../../src/core/safe/url';
import { cleanTags, cleanText, hasUnsafeChars } from '../../src/core/safe/text';
import { matchRoute } from '../../src/core/router';
import type { RouteDef } from '../../src/core/modules';

describe('safeHttpsUrl', () => {
  it('accepts plain https links', () => {
    expect(safeHttpsUrl('https://www.mdbg.net/chinese/dictionary')).toBe(
      'https://www.mdbg.net/chinese/dictionary',
    );
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://example.com',
    'file:///etc/passwd',
    'https://user:pass@example.com',
    'https://localhost/',
    '//example.com',
    '',
    'not a url',
    'https://example.com/' + 'a'.repeat(3000),
  ])('rejects %s', (input) => {
    expect(safeHttpsUrl(input)).toBeNull();
  });

  it('rejects non-strings', () => {
    expect(safeHttpsUrl(42)).toBeNull();
    expect(safeHttpsUrl({ href: 'https://x.com' })).toBeNull();
  });
});

describe('cleanText', () => {
  it('strips control and bidi-override characters', () => {
    expect(cleanText('ab‮cd\u0000e', 50)).toBe('abcde');
    expect(hasUnsafeChars('a⁦b')).toBe(true);
    expect(hasUnsafeChars('普通話')).toBe(false);
  });

  it('collapses newlines unless multiline, trims, and truncates', () => {
    expect(cleanText('  a\nb  ', 50)).toBe('a b');
    expect(cleanText('a\nb', 50, true)).toBe('a\nb');
    expect(cleanText('x'.repeat(20), 5)).toBe('xxxxx');
  });

  it('normalises to NFC', () => {
    expect(cleanText('á', 10)).toBe('á');
  });

  it('cleans tags', () => {
    expect(cleanTags('Lesson-3, food，FOOD  verbs')).toEqual(['lesson-3', 'food', 'verbs']);
    expect(cleanTags(Array.from({ length: 40 }, (_, i) => `t${i}`).join(','))).toHaveLength(20);
  });
});

describe('matchRoute', () => {
  const Dummy = () => null;
  const routes: RouteDef[] = [
    { path: '/', title: 'Home', component: Dummy },
    { path: '/cards/:id', title: 'Card', component: Dummy },
  ];

  it('matches static and parameter routes', () => {
    expect(matchRoute('/', routes)?.route.title).toBe('Home');
    expect(matchRoute('/cards/abc-123', routes)?.params).toEqual({ id: 'abc-123' });
  });

  it.each([
    '/cards/<script>',
    '/cards/a%20b',
    '/cards/' + 'x'.repeat(65),
    '/cards/a/b',
    '/unknown',
    '/cards/',
  ])('rejects %s', (path) => {
    expect(matchRoute(path, routes)?.route.title === 'Card').toBeFalsy();
  });
});

describe('normaliseUserUrl', () => {
  it('adds https:// to bare domains', () => {
    expect(normaliseUserUrl('www.youtube.com/watch?v=1')).toEqual({
      ok: true,
      url: 'https://www.youtube.com/watch?v=1',
    });
    expect(normaliseUserUrl('  https://example.com  ')).toEqual({ ok: true, url: 'https://example.com/' });
  });

  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'data:text/html,hi',
    'mailto:a@b.com',
    'file:///etc/passwd',
    'http://example.com',
    'https://user:pw@example.com',
    'localhost',
    '',
    '   ',
  ])('refuses %s', (input) => {
    expect(normaliseUserUrl(input).ok).toBe(false);
  });

  it('explains why http links are refused', () => {
    const r = normaliseUserUrl('http://example.com');
    expect(r.ok ? '' : r.error).toMatch(/https/);
  });
});

describe('list formatting', () => {
  it('uses the Oxford comma', async () => {
    const { andList, orList } = await import('../../src/core/format');
    expect(andList(['a'])).toBe('a');
    expect(andList(['a', 'b'])).toBe('a and b');
    expect(andList(['a', 'b', 'c'])).toBe('a, b, and c');
    expect(orList(['Chrome', 'Edge', 'Safari'])).toBe('Chrome, Edge, or Safari');
  });

  it('stamps dates with the local calendar date', async () => {
    const { localDateStamp } = await import('../../src/core/format');
    // Built from local parts, so the stamp must match them whatever the time zone.
    expect(localDateStamp(new Date(2026, 10, 16, 23, 59))).toBe('2026-11-16');
    expect(localDateStamp(new Date(2027, 0, 5, 0, 1))).toBe('2027-01-05');
  });
});
