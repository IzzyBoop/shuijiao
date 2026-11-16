/**
 * Stored record types. Every record has a stable id and updatedAt, and records
 * are soft-deleted (deleted = 1) so a future sync backend can merge changes.
 * Times are epoch milliseconds.
 */

export const CARD_FIELDS = ['traditional', 'simplified', 'pinyin', 'meaning', 'audio'] as const;
export type CardField = (typeof CARD_FIELDS)[number];

export const FIELD_LABELS: Record<CardField, string> = {
  traditional: 'Traditional',
  simplified: 'Simplified',
  pinyin: 'Pinyin',
  meaning: 'Meaning',
  audio: 'Audio',
};

export type Deleted = 0 | 1;

export interface Deck {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  deleted: Deleted;
}

export type CardKind = 'word' | 'sentence';

export interface Card {
  id: string;
  deckId: string;
  kind: CardKind;
  traditional: string;
  simplified: string;
  pinyin: string;
  meaning: string;
  notes: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  deleted: Deleted;
}

export interface Template {
  id: string;
  name: string;
  front: CardField[];
  back: CardField[];
  builtin: boolean;
  createdAt: number;
  updatedAt: number;
  deleted: Deleted;
}

/** FSRS scheduling state for one (card, template) pair. */
export interface ReviewState {
  key: string;
  cardId: string;
  templateId: string;
  due: number;
  stability: number;
  stabilityFast: number;
  difficulty: number;
  scheduledDays: number;
  learningStep: number;
  reps: number;
  lapses: number;
  /** 0 New, 1 Learning, 2 Review, 3 Relearning */
  state: 0 | 1 | 2 | 3;
  scheduleStatus: ScheduleStatus;
  lastReview: number | null;
  updatedAt: number;
}

export type ScheduleStatus = 'new' | 'learning' | 'review';

export interface ReviewLog {
  id: string;
  cardId: string;
  templateId: string;
  /** 1 Again, 2 Hard, 3 Good, 4 Easy */
  rating: 1 | 2 | 3 | 4;
  /** State before this review. */
  state: 0 | 1 | 2 | 3;
  due: number;
  stability: number;
  stabilityFast: number;
  difficulty: number;
  scheduledDays: number;
  learningStep: number;
  review: number;
}

/** A link a student saved for themselves (Resources → My links). */
export interface StudentLink {
  id: string;
  title: string;
  /** Always a validated https URL. */
  url: string;
  note: string;
  createdAt: number;
  updatedAt: number;
  deleted: Deleted;
}

export const stateKey = (cardId: string, templateId: string): string => `${cardId}|${templateId}`;

/** Limits applied everywhere data enters the app (forms and backup import). */
export const LIMITS = {
  hanzi: 200,
  pinyin: 800,
  meaning: 1000,
  notes: 2000,
  tag: 32,
  tags: 20,
  deckName: 80,
  templateName: 60,
  decks: 500,
  cards: 50_000,
  templates: 50,
  reviewStates: 200_000,
  linkTitle: 120,
  linkNote: 300,
  links: 500,
  reviewLogs: 300_000,
  importBytes: 10 * 1024 * 1024,
} as const;

export const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function newId(): string {
  return crypto.randomUUID();
}
