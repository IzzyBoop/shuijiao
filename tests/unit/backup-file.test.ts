import 'fake-indexeddb/auto';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { encodeBackupFile, readBackupFile } from '../../src/core/db/backup-file';
import { BACKUP_FORMAT, type Backup } from '../../src/core/db/backup-schema';
import { PortalDB } from '../../src/core/db/database';
import { DEFAULT_DECK_ID } from '../../src/core/db/defaults';
import { stateKey, type Card, type ReviewLog, type ReviewState } from '../../src/core/db/model';
import { LocalStudyStore } from '../../src/core/db/store';

const T0 = 1_763_287_200_000;
const DAY = 86_400_000;

const small = (): Backup => ({
  format: BACKUP_FORMAT,
  version: 1,
  exportedAt: T0,
  decks: [],
  cards: [],
  templates: [],
  reviewStates: [],
  reviewLogs: [],
  links: [],
});

describe('backup files', () => {
  it('compresses on export and reads the compressed file back', async () => {
    const text = JSON.stringify(small());
    const file = await encodeBackupFile(text);
    expect(file.extension).toBe('.json.gz');
    const head = new Uint8Array(await file.blob.slice(0, 2).arrayBuffer());
    expect([...head]).toEqual([0x1f, 0x8b]);
    const result = await readBackupFile(file.blob);
    expect(result.ok).toBe(true);
  });

  it('still reads plain .json backups from older versions', async () => {
    const result = await readBackupFile(new Blob([JSON.stringify(small())]));
    expect(result.ok).toBe(true);
  });

  it('stops decompressing as soon as the text passes the limit', async () => {
    // 2 MB of spaces compresses to a couple of KB: the file is small, the text is not.
    const bomb = new Blob([gzipSync(Buffer.alloc(2 * 1024 * 1024, 0x20))]);
    expect(bomb.size).toBeLessThan(10_000);
    const result = await readBackupFile(bomb, 1024 * 1024);
    expect(result).toEqual({ ok: false, errors: [expect.stringContaining('larger than 1 MB')] });
  });

  it('rejects files over the limit before reading them', async () => {
    const result = await readBackupFile(new Blob(['x'.repeat(2048)]), 1024);
    expect(result.ok).toBe(false);
  });

  it('reports a damaged compressed file instead of throwing', async () => {
    const result = await readBackupFile(new Blob([new Uint8Array([0x1f, 0x8b, 1, 2, 3, 4])]));
    expect(result).toEqual({ ok: false, errors: ['The file is damaged or is not a backup.'] });
  });

  it('round-trips a year of heavy study, which used to be over the old 10 MB limit', async () => {
    const db = new PortalDB(`test-${crypto.randomUUID()}`);
    const store = new LocalStudyStore(db);
    await store.countCards(); // opens the database and adds the built-in deck and card types
    const templates = ['tpl-reading', 'tpl-listening'];
    const cards: Card[] = [];
    const states: ReviewState[] = [];
    for (let i = 0; i < 1500; i++) {
      const id = crypto.randomUUID();
      cards.push({
        id,
        deckId: DEFAULT_DECK_ID,
        kind: 'word',
        traditional: '銀行',
        simplified: '银行',
        pinyin: 'yínháng',
        meaning: 'bank',
        notes: '',
        tags: [],
        createdAt: T0,
        updatedAt: T0,
        deleted: 0,
      });
      for (const templateId of templates) {
        states.push({
          key: stateKey(id, templateId),
          cardId: id,
          templateId,
          due: T0 + 30 * DAY,
          stability: Math.random() * 100,
          stabilityFast: Math.random() * 100,
          difficulty: 1 + Math.random() * 9,
          scheduledDays: Math.random() * 60,
          learningStep: 0,
          reps: 20,
          lapses: 2,
          state: 2,
          scheduleStatus: 'review',
          lastReview: T0,
          updatedAt: T0,
        });
      }
    }
    // About 110 reviews a day for a year, with full-precision FSRS numbers like real ones.
    const logs: ReviewLog[] = Array.from({ length: 40_000 }, (_, i) => {
      const s = states[i % states.length];
      if (!s) throw new Error('unreachable');
      return {
        id: crypto.randomUUID(),
        cardId: s.cardId,
        templateId: s.templateId,
        rating: 3,
        state: 2,
        due: T0 - DAY + i * 788_000,
        stability: Math.random() * 100,
        stabilityFast: Math.random() * 100,
        difficulty: 1 + Math.random() * 9,
        scheduledDays: Math.random() * 60,
        learningStep: 0,
        review: T0 - 365 * DAY + i * 788_000,
      };
    });
    await db.cards.bulkPut(cards);
    await db.reviewStates.bulkPut(states);
    await db.reviewLogs.bulkPut(logs);

    const text = JSON.stringify(await store.exportBackup());
    expect(text.length).toBeGreaterThan(10 * 1024 * 1024);
    const file = await encodeBackupFile(text);
    expect(file.blob.size).toBeLessThan(text.length / 2);

    const result = await readBackupFile(file.blob);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.cards).toHaveLength(1500);
    expect(result.backup.reviewStates).toHaveLength(3000);
    expect(result.backup.reviewLogs).toHaveLength(40_000);

    await store.eraseAll();
    await store.applyImport(result.backup);
    expect(await store.countCards()).toBe(1500);
    expect(await db.reviewLogs.count()).toBe(40_000);
  }, 120_000);
});
