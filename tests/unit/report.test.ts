import { describe, expect, it } from 'vitest';
import { reportProblemUrl } from '../../src/core/report';
import { safeHttpsUrl } from '../../src/core/safe/url';

describe('reportProblemUrl', () => {
  it('pre-fills the details and version fields of the form', () => {
    const url = new URL(reportProblemUrl('Backup check failed.', '9.9.9'));
    expect(url.origin).toBe('https://docs.google.com');
    expect(url.searchParams.get('usp')).toBe('pp_url');
    expect(url.searchParams.get('entry.1650357924')).toBe('9.9.9');
    expect(url.searchParams.get('entry.2015925771')).toContain('Backup check failed.');
  });

  it('shortens long details so the link still opens', () => {
    const url = reportProblemUrl('銀行 '.repeat(2000), '9.9.9');
    expect(url.length).toBeLessThanOrEqual(2048);
    expect(safeHttpsUrl(url)).toBe(url);
    expect(new URL(url).searchParams.get('entry.2015925771')).toMatch(/…/);
  });
});
