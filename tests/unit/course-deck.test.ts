import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, parseBackup, type Backup } from '../../src/core/db/backup-schema';
import type { Card } from '../../src/core/db/model';
import type { ImportDuplicate } from '../../src/core/db/store';
import { summarizeCourse } from '../../src/modules/course/course-deck';

const PUBLISHED = 'public/course/course-deck.json';

const card = (over: Partial<Card> = {}): Card => ({
  id: 'c1',
  deckId: 'd1',
  kind: 'word',
  traditional: '你好',
  simplified: '你好',
  pinyin: 'nǐhǎo',
  meaning: 'hello',
  notes: '',
  tags: [],
  createdAt: 1,
  updatedAt: 1,
  deleted: 0,
  ...over,
});

const backup = (over: Partial<Backup> = {}): Backup => ({
  format: BACKUP_FORMAT,
  version: 1,
  exportedAt: 1_800_000_000_000,
  decks: [
    { id: 'd1', name: 'Lesson 1', createdAt: 1, updatedAt: 1, deleted: 0 },
    { id: 'd2', name: 'Lesson 2', createdAt: 2, updatedAt: 2, deleted: 0 },
  ],
  cards: [],
  templates: [],
  reviewStates: [],
  reviewLogs: [],
  links: [],
  ...over,
});

describe('published course cards', () => {
  it.runIf(existsSync(PUBLISHED))('pass the backup schema and carry no personal study data', () => {
    const result = parseBackup(readFileSync(PUBLISHED, 'utf8'));
    if (!result.ok) throw new Error(result.errors.join(' '));
    const { backup: b } = result;
    expect(b.cards.length).toBeGreaterThan(0);
    expect(b.cards.every((c) => c.deleted === 0)).toBe(true);
    expect(b.decks.every((d) => d.deleted === 0)).toBe(true);
    expect(b.reviewStates).toEqual([]);
    expect(b.reviewLogs).toEqual([]);
    expect(b.links).toEqual([]);
    expect(b.templates).toEqual([]);
  });
});

describe('summarizeCourse', () => {
  it('groups live cards by deck, in order, and counts words and sentences', () => {
    const s = summarizeCourse(
      backup({
        cards: [
          card({ id: 'a', deckId: 'd2', createdAt: 3 }),
          card({ id: 'b', deckId: 'd1', createdAt: 2, kind: 'sentence' }),
          card({ id: 'c', deckId: 'd1', createdAt: 1 }),
          card({ id: 'gone', deckId: 'd1', deleted: 1 }),
          card({ id: 'lost', deckId: 'missing' }),
        ],
      }),
      [],
      [],
    );
    expect(s.total).toBe(4);
    expect([s.words, s.sentences]).toEqual([3, 1]);
    expect(s.decks.map((d) => [d.name, d.cards.map((c) => c.card.id)])).toEqual([
      ['Lesson 1', ['c', 'b']],
      ['Lesson 2', ['a']],
      ['My cards', ['lost']],
    ]);
    expect(s.counts).toEqual({ new: 4, have: 0, changed: 0 });
    expect(s.updatedAt).toBe(1_800_000_000_000);
  });

  it('leaves out decks with no cards', () => {
    const s = summarizeCourse(backup({ cards: [card()] }), [], []);
    expect(s.decks.map((d) => d.name)).toEqual(['Lesson 1']);
  });

  it('marks cards as new, already yours, or yours with different details', () => {
    const same = card({ id: 'same' });
    const edited = card({ id: 'edited', meaning: 'hi' });
    const fresh = card({ id: 'fresh' });
    const dup: ImportDuplicate = {
      incoming: edited,
      existing: [card({ id: 'edited' })],
      sameCard: true,
      differences: ['meaning'],
    };
    const s = summarizeCourse(backup({ cards: [same, edited, fresh] }), [card({ id: 'same' })], [dup]);
    expect(s.decks[0]?.cards.map((c) => [c.card.id, c.status])).toEqual([
      ['same', 'have'],
      ['edited', 'changed'],
      ['fresh', 'new'],
    ]);
    expect(s.counts).toEqual({ new: 1, have: 1, changed: 1 });
  });

  it('treats the same word saved under another id, with nothing different, as yours', () => {
    const incoming = card({ id: 'theirs' });
    const dup: ImportDuplicate = {
      incoming,
      existing: [card({ id: 'mine' })],
      sameCard: false,
      differences: [],
    };
    const s = summarizeCourse(backup({ cards: [incoming] }), [card({ id: 'mine' })], [dup]);
    expect(s.counts).toEqual({ new: 0, have: 1, changed: 0 });
  });
});
