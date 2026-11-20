import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { THEME_FAMILIES } from '../../src/core/theme/themes';

const css = readFileSync('src/core/theme/themes.css', 'utf8');
const TOKENS = [
  'bg',
  'surface',
  'surface-2',
  'border',
  'text',
  'muted',
  'accent',
  'on-accent',
  'ok',
  'warn',
  'danger',
  'tone1',
  'tone2',
  'tone3',
  'tone4',
  'tone5',
];

function palette(id: string): Record<string, string> {
  const block = new RegExp(`\\[data-theme='${id}'\\]\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  const pairs = [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m): [string, string] => [
    m[1] ?? '',
    m[2] ?? '',
  ]);
  return Object.fromEntries(pairs);
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c = 0) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
const contrast = (a = '#000000', b = '#ffffff') => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
};

const allIds = THEME_FAMILIES.flatMap((f) => [f.light, ...f.dark.map((d) => d.id)]);

describe('themes', () => {
  it('every theme in the picker defines every colour', () => {
    for (const id of allIds) expect(Object.keys(palette(id)).sort(), id).toEqual([...TOKENS].sort());
  });

  // Text, links, buttons and the pinyin tone colours must be easy to read: WCAG AA, 4.5:1.
  // (Some older light themes keep their original, paler tone colours.)
  const CHECKED = [
    'default-light',
    'default-dark',
    'tokyo-night-day',
    'tokyo-night',
    'tokyo-night-storm',
    'kanagawa-lotus',
    'kanagawa-wave',
    'kanagawa-dragon',
    'everforest-light',
    'everforest-dark',
    'alucard',
    'dracula',
    'solarized-light',
    'solarized-dark',
  ];
  it.each(CHECKED)('%s: text, links, buttons and tones are easy to read', (id) => {
    const p = palette(id);
    const pairs: [string, string | undefined, string | undefined][] = [
      ['text', p.text, p.surface],
      ['text on page', p.text, p.bg],
      ['muted', p.muted, p.surface],
      ['links', p.accent, p.surface],
      ['button', p['on-accent'], p.accent],
      ['danger', p.danger, p.surface],
      ...[1, 2, 3, 4, 5].map((t): [string, string | undefined, string | undefined] => [
        `tone ${t}`,
        p[`tone${t}`],
        p.surface,
      ]),
    ];
    for (const [what, fg, bg] of pairs) expect(contrast(fg, bg), `${id} ${what}`).toBeGreaterThanOrEqual(4.5);
  });
});
