import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseChangelog, plainText, stampRelease } from '../../tools/changelog.ts';

const SAMPLE = `# Changelog

## [Unreleased]

### Added

- **Bold** thing with \`code\` and a [link](https://example.com)
  that continues here.

## [0.1.0] - 2026-01-02

### Fixed

- Something.
`;

describe('changelog', () => {
  it('parses releases, sections and wrapped items as plain text', () => {
    const releases = parseChangelog(SAMPLE);
    expect(releases.map((r) => [r.version, r.date])).toEqual([
      ['Unreleased', null],
      ['0.1.0', '2026-01-02'],
    ]);
    expect(releases[0]?.sections[0]).toEqual({
      title: 'Added',
      items: ['Bold thing with code and a link that continues here.'],
    });
  });

  it('strips markdown', () => {
    expect(plainText('**a** *b* `c` [d](https://e.f)')).toBe('a b c d');
  });

  it('stamps Unreleased as a new version and keeps an empty Unreleased', () => {
    const out = stampRelease(SAMPLE, '0.2.0-beta.1', '2026-11-16');
    const releases = parseChangelog(out);
    expect(releases.map((r) => r.version)).toEqual(['Unreleased', '0.2.0-beta.1', '0.1.0']);
    expect(releases[0]?.sections).toEqual([]);
    expect(releases[1]?.date).toBe('2026-11-16');
    expect(releases[1]?.sections[0]?.title).toBe('Added');
  });

  it('refuses to stamp when there is nothing to release, or the version exists', () => {
    const empty = stampRelease(SAMPLE, '0.2.0', '2026-11-16');
    expect(() => stampRelease(empty, '0.3.0', '2026-11-17')).toThrow(/Nothing under/);
    expect(() => stampRelease(SAMPLE, '0.1.0', '2026-11-16')).toThrow(/already has/);
  });

  it('the real CHANGELOG.md parses and has an Unreleased section', () => {
    const releases = parseChangelog(readFileSync('CHANGELOG.md', 'utf8'));
    expect(releases[0]?.version).toBe('Unreleased');
  });
});
