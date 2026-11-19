import { PortalDB, type UndoInfo } from './database';
import { BACKUP_FORMAT, BACKUP_VERSION, type Backup } from './backup-schema';
import { builtinTemplates, DEFAULT_DECK_ID, defaultDeck } from './defaults';
import {
  deckNameKey,
  LIMITS,
  newId,
  stateKey,
  type Card,
  type CardKind,
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

/** Where imported cards go. */
export type ImportDeckMode =
  /** Back into the decks they came from; missing or deleted decks are (re)created. */
  | 'keep'
  /** All into "My cards", which is created or restored if needed. */
  | 'my-cards';

/** For an imported card that matches a card you already have: keep yours, or take the new one. */
export type DuplicateChoice = 'old' | 'new';

export interface ImportOptions {
  deckMode: ImportDeckMode;
  /** Shown next to "Undo last import" (e.g. the file name). */
  undoLabel?: string;
  /** How to resolve imported cards with the same characters as existing cards. Default: keep old. */
  duplicates?: {
    default: DuplicateChoice;
    /** Per imported card id, overriding the default. */
    choices?: Readonly<Record<string, DuplicateChoice>>;
  };
}

/** An imported card whose characters match one or more cards you already have. */
export interface ImportDuplicate {
  incoming: Card;
  existing: Card[];
  /** True when the backup has an edited copy of the very same card (same id). */
  sameCard: boolean;
  /** Which fields differ between the backup's card and yours. */
  differences: CardDifference[];
}

export const CARD_DIFFERENCE_FIELDS = [
  'traditional',
  'simplified',
  'pinyin',
  'meaning',
  'notes',
  'tags',
  'kind',
  'deck',
] as const;
export type CardDifference = (typeof CARD_DIFFERENCE_FIELDS)[number];

/** Pinyin compared loosely: case, spaces, apostrophes and hyphens don't matter. */
const pinyinKey = (p: string): string =>
  p
    .normalize('NFC')
    .toLocaleLowerCase()
    .replace(/[\s'’-]/g, '');

/**
 * Two different cards are duplicates when they share characters and have the same
 * reading. 行 háng and 行 xíng are different words. A card without pinyin matches on
 * its characters alone.
 */
function sameReading(a: Card, b: Card): boolean {
  const pa = pinyinKey(a.pinyin);
  const pb = pinyinKey(b.pinyin);
  return pa === '' || pb === '' || pa === pb;
}

/** The fields in which two cards differ (ignoring ids and timestamps). */
export function cardDifferences(a: Card, b: Card): CardDifference[] {
  const value = (c: Card, f: CardDifference): string =>
    f === 'tags' ? [...c.tags].sort().join('\u0000') : f === 'deck' ? c.deckId : c[f];
  return CARD_DIFFERENCE_FIELDS.filter((f) => value(a, f) !== value(b, f));
}

const DEFAULT_IMPORT: ImportOptions = { deckMode: 'keep' };
const MY_CARDS = 'My cards';

/** A change applied to many cards at once from the Cards page. */
export interface CardBulkChange {
  kind?: CardKind;
  deckId?: string;
  addTags?: readonly string[];
  removeTags?: readonly string[];
}

export interface ImportPreview {
  /** Names of decks the import creates or restores. */
  decksCreated: string[];
  decks: MergeCounts;
  cards: MergeCounts;
  templates: MergeCounts;
  reviewStates: MergeCounts;
  reviewLogs: MergeCounts;
  links: MergeCounts;
  /** Imported duplicates skipped in favour of the cards you already have. */
  duplicatesKeptOld: number;
  /** Your cards that take the wording of a duplicate in the backup (keeping their progress). */
  duplicatesReplaced: number;
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
  /**
   * Deletes a deck. Its cards move to `moveCardsTo` if given, otherwise they are deleted
   * too. The last remaining deck can't be deleted, so every card always has a home.
   */
  deleteDeck(id: string, moveCardsTo?: string): Promise<void>;

  listCards(deckId?: string): Promise<Card[]>;
  getCard(id: string): Promise<Card | undefined>;
  findCardsByHanzi(text: string): Promise<Card[]>;
  /** Cards with the same traditional or simplified characters (optionally ignoring one card). */
  findDuplicates(traditional: string, simplified: string, excludeId?: string): Promise<Card[]>;
  saveCard(card: Card): Promise<void>;
  deleteCard(id: string): Promise<void>;
  /** Soft-deletes several cards at once. */
  deleteCards(ids: readonly string[]): Promise<void>;
  /** Undoes a delete. */
  restoreCards(ids: readonly string[]): Promise<void>;
  moveCards(ids: readonly string[], deckId: string): Promise<void>;
  /** Applies one change to many cards; returns the cards as they were, for Undo. */
  updateCards(ids: readonly string[], change: CardBulkChange): Promise<Card[]>;
  /** Puts earlier versions of cards back (Undo for updateCards). */
  restoreCardVersions(cards: readonly Card[]): Promise<void>;
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
  /**
   * Imported cards that match cards you already have: edited copies of the same card, or
   * different cards with the same characters and pinyin.
   */
  findImportDuplicates(backup: Backup): Promise<ImportDuplicate[]>;
  previewImport(backup: Backup, options?: ImportOptions): Promise<ImportPreview>;
  /** Applies an import, first keeping a copy of everything so it can be undone. */
  applyImport(backup: Backup, options?: ImportOptions): Promise<ImportPreview>;
  /** Erases everything. Unless `keepCopy` is false, a copy is kept so it can be undone. */
  eraseAll(options?: { keepCopy?: boolean }): Promise<void>;

  /** The last import or erase, if it can be undone, and how many answers were given since. */
  getUndo(): Promise<(UndoInfo & { reviewsSince: number }) | null>;
  /** Puts everything back as it was just before the last import or erase. */
  undoLast(): Promise<void>;
  /** Deletes the copy kept for Undo. */
  discardUndo(): Promise<void>;

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
    const key = deckNameKey(deck.name);
    const clash = live(await this.db.decks.toArray()).find(
      (d) => d.id !== deck.id && deckNameKey(d.name) === key,
    );
    if (clash && deck.deleted === 0) throw new Error(`You already have a deck called “${clash.name}”.`);
    await this.db.decks.put({ ...deck, updatedAt: Date.now() });
  }
  async deleteDeck(id: string, moveCardsTo?: string) {
    const now = Date.now();
    await this.db.transaction('rw', this.db.decks, this.db.cards, async () => {
      const remaining = live(await this.db.decks.toArray());
      if (!remaining.some((d) => d.id === id)) return;
      if (remaining.length <= 1) {
        throw new Error('You need at least one deck. Create another deck before deleting this one.');
      }
      const cards = this.db.cards.where('deckId').equals(id);
      if (moveCardsTo !== undefined) {
        if (moveCardsTo === id || !remaining.some((d) => d.id === moveCardsTo)) {
          throw new Error('Choose another deck to move the cards to.');
        }
        await cards.modify({ deckId: moveCardsTo, updatedAt: now });
      } else {
        await cards.modify({ deleted: 1, updatedAt: now });
      }
      await this.db.decks.update(id, { deleted: 1, updatedAt: now });
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
  async findDuplicates(traditional: string, simplified: string, excludeId?: string) {
    const texts = [...new Set([traditional.trim(), simplified.trim()].filter(Boolean))];
    const found = (await Promise.all(texts.map((t) => this.findCardsByHanzi(t)))).flat();
    const byId = new Map(found.filter((c) => c.id !== excludeId).map((c) => [c.id, c]));
    return [...byId.values()];
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
  async deleteCards(ids: readonly string[]) {
    const now = Date.now();
    await this.db.cards
      .where('id')
      .anyOf([...ids])
      .modify({ deleted: 1, updatedAt: now });
  }
  async restoreCards(ids: readonly string[]) {
    const now = Date.now();
    await this.db.cards
      .where('id')
      .anyOf([...ids])
      .modify({ deleted: 0, updatedAt: now });
  }
  async updateCards(ids: readonly string[], change: CardBulkChange) {
    return this.db.transaction('rw', this.db.cards, this.db.decks, async () => {
      if (change.deckId !== undefined) {
        const deck = await this.db.decks.get(change.deckId);
        if (!deck || deck.deleted) throw new Error('That deck no longer exists.');
      }
      const before = live((await this.db.cards.bulkGet([...ids])).filter((c): c is Card => c !== undefined));
      const now = Date.now();
      const remove = new Set(change.removeTags ?? []);
      const after = before.map((card) => {
        let tags = card.tags.filter((t) => !remove.has(t));
        if (change.addTags?.length) tags = [...new Set([...tags, ...change.addTags])].slice(0, LIMITS.tags);
        return {
          ...card,
          kind: change.kind ?? card.kind,
          deckId: change.deckId ?? card.deckId,
          tags,
          updatedAt: now,
        };
      });
      await this.db.cards.bulkPut(after);
      return before;
    });
  }
  async restoreCardVersions(cards: readonly Card[]) {
    const now = Date.now();
    await this.db.cards.bulkPut(cards.map((c) => ({ ...c, updatedAt: now })));
  }
  async moveCards(ids: readonly string[], deckId: string) {
    const deck = await this.db.decks.get(deckId);
    if (!deck || deck.deleted) throw new Error('That deck no longer exists.');
    const now = Date.now();
    await this.db.cards
      .where('id')
      .anyOf([...ids])
      .modify({ deckId, updatedAt: now });
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
  /**
   * Decides which deck each imported card goes into and which decks must be written.
   * 'keep': cards go back to their own decks; decks that don't exist here (or were
   *   deleted) are created/restored from the file. Cards whose deck isn't in the file
   *   go to "My cards".
   * 'my-cards': every card goes to "My cards"; the file's decks are ignored.
   * "My cards" means the live deck with that name; if there is none, it is restored
   * (if it was deleted) or created.
   */
  private async planDecks(backup: Backup, mode: ImportDeckMode) {
    const now = Date.now();
    const local = new Map((await this.db.decks.toArray()).map((d) => [d.id, d]));
    const writes = new Map<string, Deck>();
    const created = new Set<string>();
    const final = (id: string) => writes.get(id) ?? local.get(id);
    const write = (deck: Deck) => {
      writes.set(deck.id, deck);
      if (deck.deleted === 0 && local.get(deck.id)?.deleted !== 0) created.add(deck.name);
    };

    let myCardsId: string | null = null;
    const myCards = (): string => {
      if (myCardsId) return myCardsId;
      const all = new Map([...local, ...writes]);
      const named = [...all.values()].find(
        (d) => d.deleted === 0 && d.name.trim().toLowerCase() === 'my cards',
      );
      if (named) return (myCardsId = named.id);
      const original = all.get(DEFAULT_DECK_ID);
      const deck: Deck =
        !original || original.deleted === 1
          ? { ...defaultDeck(now), name: MY_CARDS, createdAt: original?.createdAt ?? now }
          : // The original deck was renamed and is still in use: make a new "My cards".
            { id: newId(), name: MY_CARDS, createdAt: now, updatedAt: now, deleted: 0 };
      write(deck);
      return (myCardsId = deck.id);
    };

    const liveCards = backup.cards.filter((c) => c.deleted === 0);
    let deckIdFor: (deckId: string) => string;

    if (mode === 'my-cards') {
      if (liveCards.length > 0) myCards();
      deckIdFor = () => myCards();
    } else {
      // Your live deck with this name (ignoring case and spacing), oldest first.
      const sameName = (name: string): Deck | undefined => {
        const key = deckNameKey(name);
        return [...new Map([...local, ...writes]).values()]
          .filter((d) => d.deleted === 0 && deckNameKey(d.name) === key)
          .sort((a, b) => a.createdAt - b.createdAt)[0];
      };
      // Decks you share with the file (same id, still here) merge by date as usual.
      const shared = backup.decks.filter((d) => local.get(d.id)?.deleted === 0);
      for (const d of (await this.mergeRows(this.db.decks, shared, (r) => r.id)).toWrite) write(d);
      // Any other deck from the file goes into your deck with the same name if you have
      // one (decks made on another device have different ids); otherwise it is created.
      const remap = new Map<string, string>();
      const others = backup.decks
        .filter((d) => local.get(d.id)?.deleted !== 0 && d.deleted === 0)
        .sort((a, b) => a.createdAt - b.createdAt);
      for (const d of others) {
        const match = sameName(d.name);
        if (match) {
          if (match.id !== d.id) remap.set(d.id, match.id);
        } else {
          write({ ...d, deleted: 0, updatedAt: Math.max(d.updatedAt, local.get(d.id)?.updatedAt ?? 0) + 1 });
        }
      }
      const fromFile = new Map(backup.decks.map((d) => [d.id, d]));
      deckIdFor = (deckId) => {
        const id = remap.get(deckId) ?? deckId;
        if (final(id)?.deleted === 0) return id;
        const described = fromFile.get(id);
        if (!described) return myCards();
        const match = sameName(described.name);
        if (match) return match.id;
        // The deck is in the file but missing or deleted here: bring it (back) in.
        write({ ...(final(id) ?? described), name: described.name, deleted: 0, updatedAt: now });
        return id;
      };
    }

    const cardRows = backup.cards.map((c) => {
      if (c.deleted === 1) return c;
      const target = deckIdFor(c.deckId);
      return target === c.deckId ? c : { ...c, deckId: target };
    });

    const deckRows = [...writes.values()];
    const counts: MergeCounts = {
      added: deckRows.filter((d) => !local.has(d.id)).length,
      updated: deckRows.filter((d) => local.has(d.id)).length,
      skipped: backup.decks.filter((d) => !writes.has(d.id)).length,
    };
    const liveAfter = new Set(
      [...local.values(), ...deckRows].filter((d) => final(d.id)?.deleted === 0).map((d) => d.id),
    );
    if (liveAfter.size > LIMITS.decks) {
      throw new Error(`Import would exceed the limit of ${LIMITS.decks} decks.`);
    }
    return { cardRows, deckRows, counts, created: [...created] };
  }

  async findImportDuplicates(backup: Backup): Promise<ImportDuplicate[]> {
    const all = await this.db.cards.toArray();
    const byId = new Map(all.map((c) => [c.id, c]));
    const byText = new Map<string, Card[]>();
    for (const card of live(all)) {
      for (const text of new Set([card.traditional, card.simplified])) {
        const list = byText.get(text);
        if (list) list.push(card);
        else byText.set(text, [card]);
      }
    }
    const out: ImportDuplicate[] = [];
    for (const incoming of backup.cards) {
      if (incoming.deleted === 1) continue;
      const same = byId.get(incoming.id);
      if (same) {
        // The same card from another backup. If yours is deleted, the usual date rule
        // applies; if it's identical there is nothing to decide; if it was edited, ask.
        if (same.deleted === 1) continue;
        const differences = cardDifferences(same, incoming);
        if (differences.length > 0) out.push({ incoming, existing: [same], sameCard: true, differences });
        continue;
      }
      const matches = new Map<string, Card>();
      for (const text of [incoming.traditional, incoming.simplified]) {
        for (const card of byText.get(text) ?? []) {
          if (sameReading(card, incoming)) matches.set(card.id, card);
        }
      }
      const existing = [...matches.values()];
      const first = existing[0];
      if (first) {
        out.push({ incoming, existing, sameCard: false, differences: cardDifferences(first, incoming) });
      }
    }
    return out;
  }

  private async plan(backup: Backup, { deckMode, duplicates }: ImportOptions) {
    const builtinIds = new Set(builtinTemplates(0).map((t) => t.id));

    // Duplicates. Nothing of yours is ever deleted, and your study progress is always kept.
    // - "old" skips the imported card. For a different card with the same characters its
    //   study progress is skipped too; for an edited copy of the same card, progress from
    //   the file still merges as usual (the card itself is unchanged).
    // - "new" takes the backup's wording. An edited copy overwrites yours even if it is
    //   older, keeping the same card id. For a different card, your matching cards are
    //   updated in place with its wording (keeping their id, deck and progress), and the
    //   imported card itself, with its progress, is skipped.
    const skip = new Set<string>();
    const skipWithProgress = new Set<string>();
    const force = new Map<string, number>();
    const reworded = new Map<string, Card>();
    let replaced = 0;
    let keptOld = 0;
    const now = Date.now();
    for (const { incoming, existing, sameCard } of await this.findImportDuplicates(backup)) {
      const choice = duplicates?.choices?.[incoming.id] ?? duplicates?.default ?? 'old';
      if (choice === 'old') {
        keptOld++;
        skip.add(incoming.id);
        if (!sameCard) skipWithProgress.add(incoming.id);
      } else if (sameCard) {
        replaced++;
        const mine = existing[0]?.updatedAt ?? 0;
        force.set(incoming.id, Math.max(now, mine + 1));
      } else {
        skip.add(incoming.id);
        skipWithProgress.add(incoming.id);
        for (const card of existing) {
          if (!reworded.has(card.id)) replaced++;
          const { kind, traditional, simplified, pinyin, meaning, notes, tags } = incoming;
          reworded.set(card.id, {
            ...card,
            kind,
            traditional,
            simplified,
            pinyin,
            meaning,
            notes,
            tags: [...tags],
            updatedAt: Math.max(now, card.updatedAt + 1),
          });
        }
      }
    }
    const kept: Backup = {
      ...backup,
      cards: backup.cards
        .filter((c) => !skip.has(c.id))
        .map((c) => {
          const at = force.get(c.id);
          return at === undefined ? c : { ...c, updatedAt: at };
        }),
    };
    const notSkipped = (r: { cardId: string }) => !skipWithProgress.has(r.cardId);
    const reviewStatesIn = backup.reviewStates.filter(notSkipped);
    const reviewLogsIn = backup.reviewLogs.filter(notSkipped);
    const orphansBefore = kept.cards.length + reviewStatesIn.length + reviewLogsIn.length;

    const decks = await this.planDecks(kept, deckMode);
    // Built-in templates are never overwritten from a file; custom ones are always marked non-builtin.
    const templateRows = backup.templates
      .filter((t) => !builtinIds.has(t.id))
      .map((t) => ({ ...t, builtin: false }));
    const templates = await this.mergeRows(this.db.templates, templateRows, (r) => r.id);

    const cardRows = decks.cardRows;
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

    const stateRows = reviewStatesIn
      .filter(validRef)
      .map((s) => ({ ...s, key: stateKey(s.cardId, s.templateId) }));
    const reviewStates = await this.mergeRows(this.db.reviewStates, stateRows, (r) => r.key);

    const logRows = reviewLogsIn.filter(validRef);
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
        decks: decks.deckRows,
        templates: templates.toWrite,
        cards: [...cards.toWrite, ...reworded.values()],
        reviewStates: reviewStates.toWrite,
        reviewLogs: newLogs,
        links: links.toWrite,
      },
      preview: {
        decksCreated: decks.created,
        decks: decks.counts,
        templates: templates.counts,
        cards: cards.counts,
        reviewStates: reviewStates.counts,
        reviewLogs: { added: newLogs.length, updated: 0, skipped: logRows.length - newLogs.length },
        links: links.counts,
        duplicatesKeptOld: keptOld,
        duplicatesReplaced: replaced,
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

  async previewImport(backup: Backup, options: ImportOptions = DEFAULT_IMPORT) {
    return (await this.plan(backup, options)).preview;
  }

  /** Every table, for transactions that copy or replace all of the student's data. */
  private allTables() {
    const db = this.db;
    return [db.decks, db.cards, db.templates, db.reviewStates, db.reviewLogs, db.links, db.meta, db.undo];
  }

  /** Keeps a copy of everything for Undo. Call inside a transaction over allTables(). */
  private async keepUndoCopy(kind: UndoInfo['kind'], label: string) {
    const backup = await this.exportBackup();
    const meta = await this.db.meta.toArray();
    await this.db.undo.bulkPut([
      { id: 'info', kind, label, takenAt: backup.exportedAt },
      { id: 'data', backup, meta },
    ]);
  }

  async applyImport(backup: Backup, options: ImportOptions = DEFAULT_IMPORT) {
    const db = this.db;
    return db.transaction('rw', this.allTables(), async () => {
      // In the same transaction: if the import fails, the previous copy is kept too.
      await this.keepUndoCopy('import', options.undoLabel ?? 'a backup');
      const { writes, preview } = await this.plan(backup, options);
      await db.links.bulkPut(writes.links);
      await db.decks.bulkPut(writes.decks);
      await db.templates.bulkPut(writes.templates);
      await db.cards.bulkPut(writes.cards);
      await db.reviewStates.bulkPut(writes.reviewStates);
      await db.reviewLogs.bulkAdd(writes.reviewLogs);
      return preview;
    });
  }

  async eraseAll({ keepCopy = true }: { keepCopy?: boolean } = {}) {
    const db = this.db;
    const now = Date.now();
    await db.transaction('rw', this.allTables(), async () => {
      if (keepCopy) await this.keepUndoCopy('erase', '');
      else await db.undo.clear();
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
    });
  }

  async getUndo() {
    const info = await this.db.undo.get('info');
    if (info?.id !== 'info') return null;
    const reviewsSince = await this.db.reviewLogs.where('review').above(info.takenAt).count();
    return { kind: info.kind, label: info.label, takenAt: info.takenAt, reviewsSince };
  }

  async undoLast() {
    const db = this.db;
    await db.transaction('rw', this.allTables(), async () => {
      const data = await db.undo.get('data');
      if (data?.id !== 'data') throw new Error('There is nothing to undo.');
      const { backup, meta } = data;
      await Promise.all([
        db.decks.clear(),
        db.cards.clear(),
        db.templates.clear(),
        db.reviewStates.clear(),
        db.reviewLogs.clear(),
        db.links.clear(),
        db.meta.clear(),
      ]);
      await db.decks.bulkAdd(backup.decks);
      await db.cards.bulkAdd(backup.cards);
      await db.templates.bulkAdd(backup.templates);
      await db.reviewStates.bulkAdd(backup.reviewStates);
      await db.reviewLogs.bulkAdd(backup.reviewLogs);
      await db.links.bulkAdd(backup.links);
      await db.meta.bulkAdd(meta);
      await db.undo.clear();
    });
  }

  async discardUndo() {
    await this.db.undo.clear();
  }

  async getMeta(key: string) {
    return (await this.db.meta.get(key))?.value;
  }
  async setMeta(key: string, value: string | number) {
    await this.db.meta.put({ key, value });
  }
}

export const store: StudyStore = new LocalStudyStore(new PortalDB());
