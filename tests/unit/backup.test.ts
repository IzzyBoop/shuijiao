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
  links: [],
  ...over,
});

const link = (over: Partial<Backup['links'][number]> = {}): Backup['links'][number] => ({
  id: 'link-1',
  title: 'Grammar videos',
  url: 'https://example.com/grammar',
  note: '',
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  deleted: 0,
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

  it('rejects unknown fields, oversized strings, and bad ids', () => {
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

describe('parseBackup links', () => {
  it('accepts backups made before links existed', () => {
    const old: Record<string, unknown> = { ...backup() };
    delete old.links;
    const result = parseBackup(JSON.stringify(old));
    expect(result.ok ? result.backup.links : null).toEqual([]);
  });

  it('accepts a valid link', () => {
    const result = parseBackup(JSON.stringify(backup({ links: [link()] })));
    expect(result.ok ? result.backup.links.length : 0).toBe(1);
  });

  it.each([
    'javascript:alert(1)',
    'http://example.com/',
    'data:text/html,x',
    'https://u:p@example.com/',
    'example.com',
  ])('rejects a link to %s', (url) => {
    expect(parseBackup(JSON.stringify(backup({ links: [link({ url })] }))).ok).toBe(false);
  });

  it('rejects unknown fields in a link', () => {
    const evil = { ...link(), onclick: 'alert(1)' } as Backup['links'][number];
    expect(parseBackup(JSON.stringify(backup({ links: [evil] }))).ok).toBe(false);
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

  it('an edited copy of the same card is asked about; an identical copy merges quietly', async () => {
    await store.saveCard(card({ meaning: 'local' }));
    const local = await store.getCard('card-1');
    const later = (local?.updatedAt ?? 0) + 1;

    // Identical content (only the date differs): nothing to decide, nothing changes.
    const identical = backup({ cards: [card({ meaning: 'local', updatedAt: 1 })] });
    expect(await store.findImportDuplicates(identical)).toEqual([]);
    expect((await store.applyImport(identical)).cards.skipped).toBe(1);

    // Edited copy, newer: by default your card is kept…
    const edited = backup({ cards: [card({ meaning: 'new', updatedAt: later })] });
    expect((await store.applyImport(edited)).duplicatesKeptOld).toBe(1);
    expect((await store.getCard('card-1'))?.meaning).toBe('local');
    // …and "keep new" takes it, keeping the same card.
    const result = await store.applyImport(edited, { deckMode: 'keep', duplicates: { default: 'new' } });
    expect(result.cards.updated).toBe(1);
    expect((await store.getCard('card-1'))?.meaning).toBe('new');
    // Importing the same file again: now identical, so nothing to decide.
    expect(await store.findImportDuplicates(edited)).toEqual([]);
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
    await store.saveLink(link());
    const exported = await store.exportBackup();
    const parsed = parseBackup(JSON.stringify(exported));
    expect(parsed.ok).toBe(true);
    await store.eraseAll();
    expect(await store.countCards()).toBe(0);
    if (parsed.ok) await store.applyImport(parsed.backup);
    expect((await store.listCards()).map((c) => c.id).sort()).toEqual(['card-1', 'card-3']);
    expect((await store.listLinks()).map((l) => l.title)).toEqual(['Grammar videos']);
  });
});

describe('LocalStudyStore links', () => {
  it('saves, lists newest first, and soft-deletes links', async () => {
    const store = new LocalStudyStore(new PortalDB(`test-${crypto.randomUUID()}`));
    await store.saveLink(link({ id: 'a', title: 'First', createdAt: 1 }));
    await store.saveLink(link({ id: 'b', title: 'Second', createdAt: 2 }));
    expect((await store.listLinks()).map((l) => l.title)).toEqual(['Second', 'First']);
    await store.deleteLink('a');
    expect((await store.listLinks()).map((l) => l.id)).toEqual(['b']);
  });
});

describe('LocalStudyStore bulk card operations', () => {
  it('deletes, restores, and moves several cards at once', async () => {
    const store = new LocalStudyStore(new PortalDB(`test-${crypto.randomUUID()}`));
    const now = Date.now();
    await store.saveDeck({ id: 'l2', name: 'Lesson 2', createdAt: now, updatedAt: now, deleted: 0 });
    await store.saveCard(card({ id: 'a' }));
    await store.saveCard(card({ id: 'b' }));
    await store.saveCard(card({ id: 'c' }));

    await store.deleteCards(['a', 'b']);
    expect((await store.listCards()).map((c) => c.id)).toEqual(['c']);
    await store.restoreCards(['a', 'b']);
    expect((await store.listCards()).map((c) => c.id).sort()).toEqual(['a', 'b', 'c']);

    await store.moveCards(['a', 'c'], 'l2');
    expect((await store.listCards('l2')).map((c) => c.id).sort()).toEqual(['a', 'c']);
    await expect(store.moveCards(['b'], 'no-such-deck')).rejects.toThrow(/no longer exists/);
  });
});

describe('LocalStudyStore deck deletion', () => {
  const deck = (id: string, name: string, createdAt: number) => ({
    id,
    name,
    createdAt,
    updatedAt: createdAt,
    deleted: 0 as const,
  });

  it('can delete "My cards", moving its cards to another deck', async () => {
    const store = new LocalStudyStore(new PortalDB(`test-${crypto.randomUUID()}`));
    await store.saveDeck(deck('l1', 'Lesson 1', 5));
    await store.saveCard(card({ id: 'a' }));
    await store.deleteDeck(DEFAULT_DECK_ID, 'l1');
    expect((await store.listDecks()).map((d) => d.id)).toEqual(['l1']);
    expect((await store.getCard('a'))?.deckId).toBe('l1');
  });

  it('deletes the cards too when not moving them', async () => {
    const store = new LocalStudyStore(new PortalDB(`test-${crypto.randomUUID()}`));
    await store.saveDeck(deck('l1', 'Lesson 1', 5));
    await store.saveCard(card({ id: 'a' }));
    await store.deleteDeck(DEFAULT_DECK_ID);
    expect(await store.countCards()).toBe(0);
  });

  it('refuses to delete the last deck, or to move cards into the deck being deleted', async () => {
    const store = new LocalStudyStore(new PortalDB(`test-${crypto.randomUUID()}`));
    await expect(store.deleteDeck(DEFAULT_DECK_ID)).rejects.toThrow(/at least one deck/);
    await store.saveDeck(deck('l1', 'Lesson 1', 5));
    await expect(store.deleteDeck('l1', 'l1')).rejects.toThrow(/another deck/);
    await expect(store.deleteDeck('l1', 'no-such-deck')).rejects.toThrow(/another deck/);
  });

  it('"keep" restores a deleted deck from the file and sends deckless cards to My cards', async () => {
    const store = new LocalStudyStore(new PortalDB(`test-${crypto.randomUUID()}`));
    await store.saveDeck(deck('l1', 'Lesson 1', 5));
    await store.deleteDeck(DEFAULT_DECK_ID, 'l1');
    // An older backup still has its cards in "My cards", plus one whose deck isn't in the file.
    const file = backup({
      decks: [deck(DEFAULT_DECK_ID, 'My cards', 1)],
      cards: [card({ id: 'x', deckId: DEFAULT_DECK_ID }), card({ id: 'y', deckId: 'gone' })],
    });
    expect((await store.previewImport(file, { deckMode: 'keep' })).decksCreated).toEqual(['My cards']);
    await store.applyImport(file, { deckMode: 'keep' });
    expect((await store.listDecks()).map((d) => d.name)).toEqual(['Lesson 1', 'My cards']);
    expect((await store.listCards(DEFAULT_DECK_ID)).map((c) => c.id).sort()).toEqual(['x', 'y']);
  });
});

describe('LocalStudyStore import deck choice', () => {
  const deck = (id: string, name: string) => ({
    id,
    name,
    createdAt: 1,
    updatedAt: 1,
    deleted: 0 as const,
  });
  const file = () =>
    backup({
      decks: [deck('l1', 'Lesson 1'), deck('l2', 'Lesson 2')],
      cards: [
        card({ id: 'a', deckId: 'l1' }),
        card({ id: 'b', deckId: 'l2' }),
        card({ id: 'c', deckId: 'l2' }),
      ],
    });
  const fresh = () => new LocalStudyStore(new PortalDB(`test-${crypto.randomUUID()}`));

  it('"keep" creates the decks the cards came from', async () => {
    const store = fresh();
    const preview = await store.previewImport(file(), { deckMode: 'keep' });
    expect(preview.decksCreated).toEqual(['Lesson 1', 'Lesson 2']);
    await store.applyImport(file(), { deckMode: 'keep' });
    expect((await store.listCards('l2')).map((c) => c.id).sort()).toEqual(['b', 'c']);
    expect((await store.listDecks()).map((d) => d.name)).toEqual(['Lesson 1', 'Lesson 2', 'My cards']);
  });

  it('"my-cards" puts everything in My cards and creates no other decks', async () => {
    const store = fresh();
    const preview = await store.previewImport(file(), { deckMode: 'my-cards' });
    expect(preview.decksCreated).toEqual([]);
    await store.applyImport(file(), { deckMode: 'my-cards' });
    expect((await store.listDecks()).map((d) => d.name)).toEqual(['My cards']);
    expect((await store.listCards(DEFAULT_DECK_ID)).map((c) => c.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('"my-cards" brings My cards back if it was deleted', async () => {
    const store = fresh();
    await store.saveDeck(deck('mine', 'Lesson 9'));
    await store.deleteDeck(DEFAULT_DECK_ID);
    expect((await store.previewImport(file(), { deckMode: 'my-cards' })).decksCreated).toEqual(['My cards']);
    await store.applyImport(file(), { deckMode: 'my-cards' });
    expect((await store.listDecks()).map((d) => d.name)).toEqual(['Lesson 9', 'My cards']);
    expect(await store.countCards()).toBe(3);
  });

  it('"my-cards" makes a new My cards if the original was renamed', async () => {
    const store = fresh();
    await store.saveDeck({ ...deck(DEFAULT_DECK_ID, 'Homework'), createdAt: 0 });
    await store.applyImport(file(), { deckMode: 'my-cards' });
    const decks = await store.listDecks();
    expect(decks.map((d) => d.name)).toEqual(['Homework', 'My cards']);
    const myCards = decks.find((d) => d.name === 'My cards');
    expect((await store.listCards(myCards?.id)).length).toBe(3);
    expect((await store.listCards(DEFAULT_DECK_ID)).length).toBe(0);
  });
});

describe('LocalStudyStore import duplicates', () => {
  const fresh = () => new LocalStudyStore(new PortalDB(`test-${crypto.randomUUID()}`));
  // You already have 銀行 (card "mine"); the backup has a different 银行 card ("theirs").
  const setup = async () => {
    const store = fresh();
    await store.saveCard(card({ id: 'mine', meaning: 'bank (mine)' }));
    const file = backup({
      cards: [
        card({ id: 'theirs', traditional: '銀行', simplified: '银行', meaning: 'bank (theirs)' }),
        card({ id: 'other', traditional: '你好', simplified: '你好', meaning: 'hello' }),
      ],
    });
    return { store, file };
  };

  it('finds cards with the same characters in either script', async () => {
    const { store, file } = await setup();
    const dups = await store.findImportDuplicates(file);
    expect(dups.map((d) => [d.incoming.id, d.existing.map((c) => c.id), d.sameCard])).toEqual([
      ['theirs', ['mine'], false],
    ]);
    expect(dups[0]?.differences).toEqual(['meaning']);
    // An identical copy of the same card is not a duplicate.
    expect(
      await store.findImportDuplicates(backup({ cards: [card({ id: 'mine', meaning: 'bank (mine)' })] })),
    ).toEqual([]);
  });

  it('keep old: skips the imported duplicate', async () => {
    const { store, file } = await setup();
    const result = await store.applyImport(file, { deckMode: 'keep', duplicates: { default: 'old' } });
    expect(result.duplicatesKeptOld).toBe(1);
    expect((await store.listCards()).map((c) => c.meaning).sort()).toEqual(['bank (mine)', 'hello']);
  });

  it('keep new: imports the duplicate and deletes the card you had', async () => {
    const { store, file } = await setup();
    const result = await store.applyImport(file, { deckMode: 'keep', duplicates: { default: 'new' } });
    expect(result.duplicatesReplaced).toBe(1);
    expect((await store.listCards()).map((c) => c.meaning).sort()).toEqual(['bank (theirs)', 'hello']);
  });

  it('per card: individual choices override the default', async () => {
    const { store, file } = await setup();
    await store.applyImport(file, {
      deckMode: 'keep',
      duplicates: { default: 'old', choices: { theirs: 'new' } },
    });
    expect((await store.listCards()).map((c) => c.id).sort()).toEqual(['other', 'theirs']);
  });

  it('skipping a duplicate also drops its study progress from the file', async () => {
    const { store } = await setup();
    const file = backup({
      cards: [card({ id: 'theirs' })],
      reviewStates: [
        {
          key: 'theirs|tpl-reading',
          cardId: 'theirs',
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
    const preview = await store.previewImport(file, { deckMode: 'keep' });
    expect(preview.reviewStates.added).toBe(0);
    expect(preview.orphans).toBe(0);
  });
});

describe('LocalStudyStore import: edited copies of the same cards', () => {
  // Two backups from the same device: the later one has small edits (notes, tags, meaning).
  const teacher = card({ id: 'teacher', traditional: '老師', simplified: '老师', meaning: 'teacher' });
  const bye = card({ id: 'bye', traditional: '再見', simplified: '再见', meaning: 'goodbye' });
  const plural = card({ id: 'plural', traditional: '們', simplified: '们', meaning: 'plural marker' });
  const same = card({ id: 'same', traditional: '好', simplified: '好', meaning: 'good' });
  const before = [teacher, bye, plural, same];
  const after = [
    { ...teacher, tags: ['test'], updatedAt: teacher.updatedAt + 10 },
    { ...bye, meaning: 'goodbye. test', updatedAt: bye.updatedAt + 10 },
    { ...plural, notes: 'test', updatedAt: plural.updatedAt + 10 },
    same,
  ];
  const progress = (cardId: string, reps: number) => ({
    key: `${cardId}|tpl-reading`,
    cardId,
    templateId: 'tpl-reading',
    due: 2,
    stability: 1,
    stabilityFast: 1,
    difficulty: 5,
    scheduledDays: 1,
    learningStep: 0,
    reps,
    lapses: 0,
    state: 2 as const,
    scheduleStatus: 'review' as const,
    lastReview: 1,
    updatedAt: reps,
  });

  it('lists each edited card with what changed', async () => {
    const store = new LocalStudyStore(new PortalDB(`test-${crypto.randomUUID()}`));
    await store.applyImport(backup({ cards: before }));
    const dups = await store.findImportDuplicates(backup({ cards: after }));
    expect(dups.map((d) => [d.incoming.id, d.sameCard, d.differences])).toEqual([
      ['teacher', true, ['tags']],
      ['bye', true, ['meaning']],
      ['plural', true, ['notes']],
    ]);
  });

  it('keep new overwrites an edited card even when the backup copy is older', async () => {
    const store = new LocalStudyStore(new PortalDB(`test-${crypto.randomUUID()}`));
    await store.applyImport(backup({ cards: after }));
    await store.applyImport(backup({ cards: before }), {
      deckMode: 'keep',
      duplicates: { default: 'old', choices: { bye: 'new' } },
    });
    expect((await store.getCard('bye'))?.meaning).toBe('goodbye');
    expect((await store.getCard('teacher'))?.tags).toEqual(['test']);
  });

  it('keeping your copy of the same card still merges study progress from the file', async () => {
    const store = new LocalStudyStore(new PortalDB(`test-${crypto.randomUUID()}`));
    await store.applyImport(backup({ cards: before }));
    const preview = await store.previewImport(backup({ cards: after, reviewStates: [progress('bye', 3)] }), {
      deckMode: 'keep',
      duplicates: { default: 'old' },
    });
    expect(preview.duplicatesKeptOld).toBe(3);
    expect(preview.reviewStates.added).toBe(1);
  });
});
