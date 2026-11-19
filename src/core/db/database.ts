import Dexie, { type EntityTable, type Table } from 'dexie';
import { getAppStatus, setAppStatus } from '../app-status';
import type { Backup } from './backup-schema';
import type { Card, Deck, ReviewLog, ReviewState, StudentLink, Template } from './model';
import { builtinTemplates, defaultDeck } from './defaults';

export interface MetaRow {
  key: string;
  value: string | number;
}

/** What the last import or erase was, for "Undo". */
export interface UndoInfo {
  kind: 'import' | 'erase';
  /** For an import: the file name, or "Course cards". */
  label: string;
  takenAt: number;
}

/**
 * The copy of everything taken just before the last import or erase. The small "info"
 * row is kept apart from the big "data" row so showing the Undo button doesn't load it.
 */
export type UndoRow = ({ id: 'info' } & UndoInfo) | { id: 'data'; backup: Backup; meta: MetaRow[] };

export class PortalDB extends Dexie {
  decks!: EntityTable<Deck, 'id'>;
  cards!: EntityTable<Card, 'id'>;
  templates!: EntityTable<Template, 'id'>;
  reviewStates!: EntityTable<ReviewState, 'key'>;
  reviewLogs!: EntityTable<ReviewLog, 'id'>;
  meta!: EntityTable<MetaRow, 'key'>;
  links!: EntityTable<StudentLink, 'id'>;
  undo!: Table<UndoRow, string>;

  constructor(name = 'shuijiao') {
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
    // v2: students' own links on the Resources page. Existing tables are kept as they are.
    this.version(2).stores({
      links: 'id, updatedAt',
    });
    // v3: a copy of everything from just before the last import or erase, for Undo.
    this.version(3).stores({
      undo: 'id',
    });
    // A newer version of the portal, open in another tab, is upgrading the database. Dexie
    // closes this tab's connection so the upgrade can go ahead; this tab's code is now
    // out of date and must reload.
    this.on('versionchange', (event) => {
      if (event.newVersion !== null && event.newVersion > event.oldVersion) {
        setAppStatus({ reload: 'other-tab' });
      }
    });
    // This tab is the newer one, and an older tab that doesn't use Dexie's close-on-upgrade
    // is holding the database open.
    this.on('blocked', () => {
      setAppStatus({ blocked: true });
    });
    this.on('ready', () => {
      if (getAppStatus().blocked) setAppStatus({ blocked: false });
    });
    this.on('populate', (tx) => {
      const now = Date.now();
      void tx.table('decks').add(defaultDeck(now));
      void tx.table('templates').bulkAdd(builtinTemplates(now));
    });
  }
}
