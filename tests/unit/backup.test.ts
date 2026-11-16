import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, parseBackup, type Backup } from '../../src/core/db/backup-schema';
import { PortalDB } from '../../src/core/db/database';
import { LocalStudyStore } from '../../src/core/db/store';
import { DEFAULT_DECK_ID } from '../../src/core/db/defaults';
import type { Card } from '../../src/core/db/model';

const card = (over: Partial<Card> = {}): Card => ({
  id: 'card-1',
  deckId: DEFAULT_DECK_ID,
  kind: 'word',
  traditional: '銀行',
  simplified: '银行',
  pinyin: 'yínháng',
  meaning: 'bank',
  notes: '',
  tags: [],
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  deleted: 0,
  ...over,
});

const backup = (over: Partial<Backup> = {}): Backup => ({
  format: BACKUP_FORMAT,
  version: 1,
  exportedAt: 1_700_000_000_000,
  decks: [],
  cards: [card()],
  templates: [],
  reviewStates: [],
  reviewLogs: [],
  ...over,
});

describe('parseBackup', () => {
  it('accepts a valid backup', () => {
    expect(parseBackup(JSON.stringify(backup())).ok).toBe(true);
  });

  it('rejects non-JSON and wrong formats', () => {
    expect(parseBackup('not json').ok).toBe(false);
    expect(parseBackup('[]').ok).toBe(false);
    expect(parseBackup(JSON.stringify({ ...backup(), format: 'other' })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ ...backup(), version: 2 })).ok).toBe(false);
  });

  it('rejects prototype-pollution keys', () => {
    const text = JSON.stringify(backup()).replace('"format"', '"__proto__":{"polluted":true},"format"');
    expect(parseBackup(text).ok).toBe(false);
    const inCard = JSON.stringify(backup()).replace(
      '"id":"card-1"',
      '"id":"card-1","constructor":{"prototype":{"x":1}}',
    );
    expect(parseBackup(inCard).ok).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('rejects unknown fields, oversized strings and bad ids', () => {
    expect(
      parseBackup(JSON.stringify(backup({ cards: [{ ...card(), html: '<img onerror=x>' } as Card] }))).ok,
    ).toBe(false);
    expect(parseBackup(JSON.stringify(backup({ cards: [card({ meaning: 'x'.repeat(5000) })] }))).ok).toBe(
      false,
    );
    expect(parseBackup(JSON.stringify(backup({ cards: [card({ id: '../../etc' })] }))).ok).toBe(false);
    expect(parseBackup(JSON.stringify(backup({ cards: [card({ meaning: 'evil‮txt' })] }))).ok).toBe(false);
  });

  it('rejects wrong types and out-of-range numbers', () => {
    expect(
      parseBackup(JSON.stringify(backup({ cards: [{ ...card(), tags: 'x' } as unknown as Card] }))).ok,
    ).toBe(false);
    expect(parseBackup(JSON.stringify(backup({ cards: [card({ createdAt: -1 })] }))).ok).toBe(false);
    expect(parseBackup(JSON.stringify(backup({ cards: [card({ deleted: 2 as 0 })] }))).ok).toBe(false);
  });

  it('treats markup in text as plain text (it is never rendered as HTML)', () => {
    const result = parseBackup(
      JSON.stringify(backup({ cards: [card({ meaning: '<script>alert(1)</script>' })] })),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects files over the size limit', () => {
    expect(parseBackup(' '.repeat(10 * 1024 * 1024 + 1)).ok).toBe(false);
  });
});

describe('LocalStudyStore import', () => {
  let store: LocalStudyStore;
  beforeEach(() => {
    store = new LocalStudyStore(new PortalDB(`test-${crypto.randomUUID()}`));
  });

  it('seeds the default deck and built-in templates', async () => {
    expect((await store.listDecks()).map((d) => d.id)).toEqual([DEFAULT_DECK_ID]);
    expect((await store.listTemplates()).length).toBe(4);
  });

  it('merges by id, newer wins, and is idempotent', async () => {
    await store.saveCard(card({ meaning: 'local' }));
    const local = await store.getCard('card-1');
    const older = backup({ cards: [card({ meaning: 'old', updatedAt: 1 })] });
    expect((await store.applyImport(older)).cards).toEqual({ added: 0, updated: 0, skipped: 1 });
    expect((await store.getCard('card-1'))?.meaning).toBe('local');

    const newer = backup({ cards: [card({ meaning: 'new', updatedAt: (local?.updatedAt ?? 0) + 1 })] });
    expect((await store.applyImport(newer)).cards.updated).toBe(1);
    expect((await store.getCard('card-1'))?.meaning).toBe('new');
    expect((await store.applyImport(newer)).cards.skipped).toBe(1);
  });

  it('never overwrites built-in templates and moves cards from unknown decks to the default deck', async () => {
    const b = backup({
      cards: [card({ id: 'card-2', deckId: 'missing-deck' })],
      templates: [
        {
          id: 'tpl-reading',
          name: 'Hacked',
          front: ['meaning'],
          back: ['audio'],
          builtin: true,
          createdAt: 1,
          updatedAt: 9e12,
          deleted: 0,
        },
      ],
    });
    await store.applyImport(b);
    expect((await store.listTemplates()).find((t) => t.id === 'tpl-reading')?.name).not.toBe('Hacked');
    expect((await store.getCard('card-2'))?.deckId).toBe(DEFAULT_DECK_ID);
  });

  it('drops review states that point at missing cards', async () => {
    const b = backup({
      cards: [],
      reviewStates: [
        {
          key: 'ghost|tpl-reading',
          cardId: 'ghost',
          templateId: 'tpl-reading',
          due: 1,
          stability: 1,
          stabilityFast: 1,
          difficulty: 5,
          scheduledDays: 1,
          learningStep: 0,
          reps: 1,
          lapses: 0,
          state: 2,
          scheduleStatus: 'review',
          lastReview: 1,
          updatedAt: 1,
        },
      ],
    });
    const preview = await store.previewImport(b);
    expect(preview.orphans).toBe(1);
    expect(preview.reviewStates.added).toBe(0);
  });

  it('export → erase → import restores the same cards', async () => {
    await store.saveCard(card());
    await store.saveCard(card({ id: 'card-3', traditional: '頭髮', simplified: '头发' }));
    const exported = await store.exportBackup();
    const parsed = parseBackup(JSON.stringify(exported));
    expect(parsed.ok).toBe(true);
    await store.eraseAll();
    expect(await store.countCards()).toBe(0);
    if (parsed.ok) await store.applyImport(parsed.backup);
    expect((await store.listCards()).map((c) => c.id).sort()).toEqual(['card-1', 'card-3']);
  });
});
