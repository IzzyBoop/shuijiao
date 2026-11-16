import { PortalDB } from './database';
import { BACKUP_FORMAT, BACKUP_VERSION, type Backup } from './backup-schema';
import { builtinTemplates, DEFAULT_DECK_ID, defaultDeck } from './defaults';
import {
  LIMITS,
  stateKey,
  type Card,
  type Deck,
  type ReviewLog,
  type ReviewState,
  type StudentLink,
  type Template,
} from './model';

export interface MergeCounts {
  added: number;
  updated: number;
  skipped: number;
}

export interface ImportPreview {
  decks: MergeCounts;
  cards: MergeCounts;
  templates: MergeCounts;
  reviewStates: MergeCounts;
  reviewLogs: MergeCounts;
  links: MergeCounts;
  /** Records dropped because they point at something that doesn't exist. */
  orphans: number;
}

/**
 * Everything the UI needs from storage. Today it is backed by IndexedDB in the
 * student's browser; a sync backend can implement the same interface later.
 */
export interface StudyStore {
  listDecks(): Promise<Deck[]>;
  saveDeck(deck: Deck): Promise<void>;
  deleteDeck(id: string): Promise<void>;

  listCards(deckId?: string): Promise<Card[]>;
  getCard(id: string): Promise<Card | undefined>;
  findCardsByHanzi(text: string): Promise<Card[]>;
  saveCard(card: Card): Promise<void>;
  deleteCard(id: string): Promise<void>;
  countCards(): Promise<number>;

  listTemplates(): Promise<Template[]>;
  saveTemplate(template: Template): Promise<void>;
  deleteTemplate(id: string): Promise<void>;

  listReviewStates(templateIds: readonly string[]): Promise<ReviewState[]>;
  recordReview(state: ReviewState, log: ReviewLog): Promise<void>;
  countReviewsSince(time: number, newOnly: boolean): Promise<number>;

  listLinks(): Promise<StudentLink[]>;
  saveLink(link: StudentLink): Promise<void>;
  deleteLink(id: string): Promise<void>;

  exportBackup(): Promise<Backup>;
  previewImport(backup: Backup): Promise<ImportPreview>;
  applyImport(backup: Backup): Promise<ImportPreview>;
  eraseAll(): Promise<void>;

  getMeta(key: string): Promise<string | number | undefined>;
  setMeta(key: string, value: string | number): Promise<void>;
}

const live = <T extends { deleted: 0 | 1 }>(rows: T[]): T[] => rows.filter((r) => r.deleted === 0);

export class LocalStudyStore implements StudyStore {
  constructor(private readonly db: PortalDB) {}

  async listDecks() {
    const decks = live(await this.db.decks.toArray());
    return decks.sort((a, b) => a.name.localeCompare(b.name));
  }
  async saveDeck(deck: Deck) {
    await this.db.decks.put({ ...deck, updatedAt: Date.now() });
  }
  async deleteDeck(id: string) {
    if (id === DEFAULT_DECK_ID) throw new Error('The default deck cannot be deleted.');
    const now = Date.now();
    await this.db.transaction('rw', this.db.decks, this.db.cards, async () => {
      await this.db.decks.update(id, { deleted: 1, updatedAt: now });
      await this.db.cards.where('deckId').equals(id).modify({ deleted: 1, updatedAt: now });
    });
  }

  async listCards(deckId?: string) {
    const rows = deckId
      ? await this.db.cards.where('deckId').equals(deckId).toArray()
      : await this.db.cards.toArray();
    return live(rows).sort((a, b) => a.createdAt - b.createdAt);
  }
  async getCard(id: string) {
    const card = await this.db.cards.get(id);
    return card?.deleted === 0 ? card : undefined;
  }
  async findCardsByHanzi(text: string) {
    const [a, b] = await Promise.all([
      this.db.cards.where('simplified').equals(text).toArray(),
      this.db.cards.where('traditional').equals(text).toArray(),
    ]);
    const byId = new Map([...a, ...b].map((c) => [c.id, c]));
    return live([...byId.values()]);
  }
  async saveCard(card: Card) {
    if (!(await this.db.cards.get(card.id)) && (await this.db.cards.count()) >= LIMITS.cards) {
      throw new Error(`You have reached the limit of ${LIMITS.cards} cards.`);
    }
    await this.db.cards.put({ ...card, updatedAt: Date.now() });
  }
  async deleteCard(id: string) {
    await this.db.cards.update(id, { deleted: 1, updatedAt: Date.now() });
  }
  async countCards() {
    return await this.db.cards.filter((c) => c.deleted === 0).count();
  }

  async listTemplates() {
    return live(await this.db.templates.toArray()).sort(
      (a, b) => Number(b.builtin) - Number(a.builtin) || a.createdAt - b.createdAt,
    );
  }
  async saveTemplate(template: Template) {
    const existing = await this.db.templates.get(template.id);
    if (existing?.builtin) throw new Error('Built-in templates cannot be changed.');
    await this.db.templates.put({ ...template, builtin: false, updatedAt: Date.now() });
  }
  async deleteTemplate(id: string) {
    const existing = await this.db.templates.get(id);
    if (!existing || existing.builtin) return;
    await this.db.templates.update(id, { deleted: 1, updatedAt: Date.now() });
  }

  async listReviewStates(templateIds: readonly string[]) {
    return this.db.reviewStates
      .where('templateId')
      .anyOf([...templateIds])
      .toArray();
  }
  async recordReview(state: ReviewState, log: ReviewLog) {
    await this.db.transaction('rw', this.db.reviewStates, this.db.reviewLogs, async () => {
      await this.db.reviewStates.put(state);
      await this.db.reviewLogs.add(log);
    });
  }
  async countReviewsSince(time: number, newOnly: boolean) {
    const q = this.db.reviewLogs.where('review').aboveOrEqual(time);
    return newOnly ? q.filter((l) => l.state === 0).count() : q.count();
  }

  async listLinks() {
    return live(await this.db.links.toArray()).sort((a, b) => b.createdAt - a.createdAt);
  }
  async saveLink(link: StudentLink) {
    if (!(await this.db.links.get(link.id)) && (await this.db.links.count()) >= LIMITS.links) {
      throw new Error(`You have reached the limit of ${LIMITS.links} links.`);
    }
    await this.db.links.put({ ...link, updatedAt: Date.now() });
  }
  async deleteLink(id: string) {
    await this.db.links.update(id, { deleted: 1, updatedAt: Date.now() });
  }

  async exportBackup(): Promise<Backup> {
    const [decks, cards, templates, reviewStates, reviewLogs, links] = await Promise.all([
      this.db.decks.toArray(),
      this.db.cards.toArray(),
      this.db.templates.toArray(),
      this.db.reviewStates.toArray(),
      this.db.reviewLogs.toArray(),
      this.db.links.toArray(),
    ]);
    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: Date.now(),
      decks,
      cards,
      templates,
      reviewStates,
      reviewLogs,
      links,
    };
  }

  /** Works out what an import would change, without writing anything. */
  private async plan(backup: Backup) {
    const builtinIds = new Set(builtinTemplates(0).map((t) => t.id));
    const orphansBefore = backup.cards.length + backup.reviewStates.length + backup.reviewLogs.length;

    const decks = await this.mergeRows(this.db.decks, backup.decks, (r) => r.id);
    // Built-in templates are never overwritten from a file; custom ones are always marked non-builtin.
    const templateRows = backup.templates
      .filter((t) => !builtinIds.has(t.id))
      .map((t) => ({ ...t, builtin: false }));
    const templates = await this.mergeRows(this.db.templates, templateRows, (r) => r.id);

    const deckIds = new Set([
      ...(await this.db.decks.toCollection().primaryKeys()),
      ...backup.decks.map((d) => d.id),
    ]);
    const cardRows = backup.cards.map((c) => (deckIds.has(c.deckId) ? c : { ...c, deckId: DEFAULT_DECK_ID }));
    const cards = await this.mergeRows(this.db.cards, cardRows, (r) => r.id);

    const cardIds = new Set([
      ...(await this.db.cards.toCollection().primaryKeys()),
      ...cardRows.map((c) => c.id),
    ]);
    const templateIds = new Set([
      ...(await this.db.templates.toCollection().primaryKeys()),
      ...templateRows.map((t) => t.id),
      ...builtinIds,
    ]);
    const validRef = (r: { cardId: string; templateId: string }) =>
      cardIds.has(r.cardId) && templateIds.has(r.templateId);

    const stateRows = backup.reviewStates
      .filter(validRef)
      .map((s) => ({ ...s, key: stateKey(s.cardId, s.templateId) }));
    const reviewStates = await this.mergeRows(this.db.reviewStates, stateRows, (r) => r.key);

    const logRows = backup.reviewLogs.filter(validRef);
    const existingLogIds = new Set(await this.db.reviewLogs.toCollection().primaryKeys());
    const newLogs = logRows.filter((l) => !existingLogIds.has(l.id));

    const links = await this.mergeRows(this.db.links, backup.links, (r) => r.id);
    if ((await this.db.links.count()) + links.counts.added > LIMITS.links) {
      throw new Error(`Import would exceed the limit of ${LIMITS.links} links.`);
    }

    const total = (await this.db.cards.count()) + cards.counts.added;
    if (total > LIMITS.cards) throw new Error(`Import would exceed the limit of ${LIMITS.cards} cards.`);

    const orphans = orphansBefore - (cardRows.length + stateRows.length + logRows.length);
    return {
      writes: {
        decks: decks.toWrite,
        templates: templates.toWrite,
        cards: cards.toWrite,
        reviewStates: reviewStates.toWrite,
        reviewLogs: newLogs,
        links: links.toWrite,
      },
      preview: {
        decks: decks.counts,
        templates: templates.counts,
        cards: cards.counts,
        reviewStates: reviewStates.counts,
        reviewLogs: { added: newLogs.length, updated: 0, skipped: logRows.length - newLogs.length },
        links: links.counts,
        orphans,
      } satisfies ImportPreview,
    };
  }

  /** Newer updatedAt wins; ties keep the local copy. */
  private async mergeRows<T extends { updatedAt: number }>(
    table: { bulkGet(keys: string[]): Promise<(T | undefined)[]> },
    rows: T[],
    keyOf: (r: T) => string,
  ) {
    const existing = await table.bulkGet(rows.map(keyOf));
    const counts: MergeCounts = { added: 0, updated: 0, skipped: 0 };
    const toWrite: T[] = [];
    rows.forEach((row, i) => {
      const local = existing[i];
      if (!local) {
        counts.added++;
        toWrite.push(row);
      } else if (row.updatedAt > local.updatedAt) {
        counts.updated++;
        toWrite.push(row);
      } else {
        counts.skipped++;
      }
    });
    return { counts, toWrite };
  }

  async previewImport(backup: Backup) {
    return (await this.plan(backup)).preview;
  }

  async applyImport(backup: Backup) {
    const db = this.db;
    return db.transaction(
      'rw',
      [db.decks, db.cards, db.templates, db.reviewStates, db.reviewLogs, db.links],
      async () => {
        const { writes, preview } = await this.plan(backup);
        await db.links.bulkPut(writes.links);
        await db.decks.bulkPut(writes.decks);
        await db.templates.bulkPut(writes.templates);
        await db.cards.bulkPut(writes.cards);
        await db.reviewStates.bulkPut(writes.reviewStates);
        await db.reviewLogs.bulkAdd(writes.reviewLogs);
        return preview;
      },
    );
  }

  async eraseAll() {
    const db = this.db;
    const now = Date.now();
    await db.transaction(
      'rw',
      [db.decks, db.cards, db.templates, db.reviewStates, db.reviewLogs, db.meta, db.links],
      async () => {
        await Promise.all([
          db.decks.clear(),
          db.cards.clear(),
          db.templates.clear(),
          db.reviewStates.clear(),
          db.reviewLogs.clear(),
          db.meta.clear(),
          db.links.clear(),
        ]);
        await db.decks.add(defaultDeck(now));
        await db.templates.bulkAdd(builtinTemplates(now));
      },
    );
  }

  async getMeta(key: string) {
    return (await this.db.meta.get(key))?.value;
  }
  async setMeta(key: string, value: string | number) {
    await this.db.meta.put({ key, value });
  }
}

export const store: StudyStore = new LocalStudyStore(new PortalDB());
