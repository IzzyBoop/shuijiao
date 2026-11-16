import Dexie, { type EntityTable } from 'dexie';
import type { Card, Deck, ReviewLog, ReviewState, Template } from './model';
import { builtinTemplates, defaultDeck } from './defaults';

export interface MetaRow {
  key: string;
  value: string | number;
}

export class PortalDB extends Dexie {
  decks!: EntityTable<Deck, 'id'>;
  cards!: EntityTable<Card, 'id'>;
  templates!: EntityTable<Template, 'id'>;
  reviewStates!: EntityTable<ReviewState, 'key'>;
  reviewLogs!: EntityTable<ReviewLog, 'id'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor(name = 'chinese-study-portal') {
    super(name);
    // Schema changes: add a new this.version(n) block with an upgrade(); never edit old ones.
    this.version(1).stores({
      decks: 'id, updatedAt',
      cards: 'id, deckId, updatedAt, simplified, traditional, *tags',
      templates: 'id',
      reviewStates: 'key, cardId, templateId, due',
      reviewLogs: 'id, cardId, review',
      meta: 'key',
    });
    this.on('populate', (tx) => {
      const now = Date.now();
      void tx.table('decks').add(defaultDeck(now));
      void tx.table('templates').bulkAdd(builtinTemplates(now));
    });
  }
}
