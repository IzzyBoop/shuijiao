import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { parseBackup } from '../../src/core/db/backup-schema';
import { PortalDB } from '../../src/core/db/database';
import { builtinTemplates, defaultDeck } from '../../src/core/db/defaults';
import { LocalStudyStore } from '../../src/core/db/store';

/*
 * Students' browsers hold databases made by earlier versions of the portal. These are
 * frozen copies of the schemas that shipped. NEVER EDIT THEM: they are what is out there.
 * A schema change goes in a new this.version(n) in src/core/db/database.ts, and its
 * stores are added below as a new frozen version.
 */
const SHIPPED = [
  // v1 (0.1.0-beta.1): cards, decks, card types, progress, review history, settings.
  {
    decks: 'id, updatedAt',
    cards: 'id, deckId, updatedAt, simplified, traditional, *tags',
    templates: 'id',
    reviewStates: 'key, cardId, templateId, due',
    reviewLogs: 'id, cardId, review',
    meta: 'key',
  },
  // v2: students' own links.
  { links: 'id, updatedAt' },
  // v3: the copy kept for "Undo the last import or erase".
  { undo: 'id' },
] as const;

const T = 1_763_287_200_000;

/** Makes a database the way version `n` of the portal did, with a student's data in it. */
async function databaseFromVersion(n: 1 | 2): Promise<string> {
  const name = `upgrade-${crypto.randomUUID()}`;
  const old = new Dexie(name);
  for (let v = 1; v <= n; v++) old.version(v).stores(SHIPPED[v - 1] ?? {});
  old.on('populate', (tx) => {
    void tx.table('decks').add(defaultDeck(T));
    void tx.table('templates').bulkAdd(builtinTemplates(T));
  });
  await old.open();
  await old.table('decks').put({ id: 'lesson-1', name: 'Lesson 1', createdAt: T, updatedAt: T, deleted: 0 });
  await old.table('cards').bulkPut([
    {
      id: 'card-bank',
      deckId: 'lesson-1',
      kind: 'word',
      traditional: '銀行',
      simplified: '银行',
      pinyin: 'yínháng',
      meaning: 'bank',
      notes: 'L1',
      tags: ['money'],
      createdAt: T,
      updatedAt: T,
      deleted: 0,
    },
    {
      id: 'card-gone',
      deckId: 'default-deck',
      kind: 'word',
      traditional: '頭髮',
      simplified: '头发',
      pinyin: 'tóufa',
      meaning: 'hair',
      notes: '',
      tags: [],
      createdAt: T,
      updatedAt: T + 1,
      deleted: 1,
    },
  ]);
  await old.table('reviewStates').put({
    key: 'card-bank|tpl-reading',
    cardId: 'card-bank',
    templateId: 'tpl-reading',
    due: T + 3 * 86_400_000,
    stability: 3.2,
    stabilityFast: 3.2,
    difficulty: 4.9,
    scheduledDays: 3,
    learningStep: 0,
    reps: 3,
    lapses: 1,
    state: 2,
    scheduleStatus: 'review',
    lastReview: T,
    updatedAt: T,
  });
  await old.table('reviewLogs').put({
    id: 'log-1',
    cardId: 'card-bank',
    templateId: 'tpl-reading',
    rating: 3,
    state: 2,
    due: T,
    stability: 2.1,
    stabilityFast: 2.1,
    difficulty: 5,
    scheduledDays: 2,
    learningStep: 0,
    review: T,
  });
  await old.table('meta').put({ key: 'lastBackupAt', value: T });
  if (n >= 2) {
    await old.table('links').put({
      id: 'link-1',
      title: 'Grammar',
      url: 'https://example.com/',
      note: '',
      createdAt: T,
      updatedAt: T,
      deleted: 0,
    });
  }
  old.close();
  return name;
}

describe('upgrading a database made by an earlier version', () => {
  for (const n of [1, 2] as const) {
    it(`keeps everything from a v${n} database, and the new features work on it`, async () => {
      const db = new PortalDB(await databaseFromVersion(n));
      const store = new LocalStudyStore(db);

      // Everything the student had is still there.
      expect((await store.listCards()).map((c) => [c.id, c.meaning, c.tags])).toEqual([
        ['card-bank', 'bank', ['money']],
      ]);
      expect(await store.countCards()).toBe(1);
      expect((await store.listDecks()).map((d) => d.name).sort()).toEqual(['Lesson 1', 'My cards']);
      expect((await store.listTemplates()).length).toBe(4);
      const [state] = await store.listReviewStates(['tpl-reading']);
      expect(state).toMatchObject({ reps: 3, lapses: 1, stability: 3.2 });
      expect(await store.countReviewsSince(0, false)).toBe(1);
      expect(await store.getMeta('lastBackupAt')).toBe(T);
      expect((await store.listLinks()).length).toBe(n >= 2 ? 1 : 0);
      expect(db.verno).toBe(SHIPPED.length);

      // Backups, imports and undo (which needs the new table) all work on it.
      const backup = parseBackup(JSON.stringify(await store.exportBackup()));
      expect(backup.ok).toBe(true);
      if (!backup.ok) return;
      await store.eraseAll();
      expect(await store.countCards()).toBe(0);
      await store.undoLast();
      expect(await store.countCards()).toBe(1);
      await store.eraseAll({ keepCopy: false });
      await store.applyImport(backup.backup);
      expect((await store.listCards()).map((c) => c.id)).toEqual(['card-bank']);
      expect((await store.listReviewStates(['tpl-reading']))[0]?.reps).toBe(3);
      db.close();
    });
  }

  it("the portal's schema is exactly the shipped versions: old ones were never edited", async () => {
    const db = new PortalDB(`fresh-${crypto.randomUUID()}`);
    await db.open();
    const expected = Object.assign({}, ...SHIPPED) as Record<string, string>;
    const actual = Object.fromEntries(
      db.tables.map((t) => [
        t.name,
        [t.schema.primKey.src, ...t.schema.indexes.map((i) => i.src)].join(', '),
      ]),
    );
    expect(actual).toEqual(expected);
    expect(db.verno).toBe(SHIPPED.length);
    db.close();
  });
});
