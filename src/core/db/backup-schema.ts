import * as v from 'valibot';
import { CARD_FIELDS, ID_PATTERN, LIMITS } from './model';
import { hasUnsafeChars } from '../safe/text';

/**
 * Schema for backup files. Strict objects reject unknown keys (including
 * "__proto__" and "constructor" smuggled in via JSON), every string has a
 * length cap, and arrays have count caps. Nothing from a backup is used until
 * it has passed this schema.
 */

export const BACKUP_FORMAT = 'shuijiao-backup';
export const BACKUP_VERSION = 1;

const MAX_TIME = 4_102_444_800_000; // year 2100

const id = v.pipe(v.string(), v.regex(ID_PATTERN, 'Invalid id.'));
const time = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(MAX_TIME));
const text = (max: number) =>
  v.pipe(
    v.string(),
    v.maxLength(max),
    v.check((s) => !hasUnsafeChars(s), 'Text contains control characters.'),
  );
const deleted = v.picklist([0, 1] as const);
const state = v.picklist([0, 1, 2, 3] as const);
const finite = (min: number, max: number) => v.pipe(v.number(), v.minValue(min), v.maxValue(max));
const field = v.picklist(CARD_FIELDS);

export const DeckSchema = v.strictObject({
  id,
  name: v.pipe(text(LIMITS.deckName), v.minLength(1)),
  createdAt: time,
  updatedAt: time,
  deleted,
});

export const CardSchema = v.strictObject({
  id,
  deckId: id,
  kind: v.picklist(['word', 'sentence'] as const),
  traditional: text(LIMITS.hanzi),
  simplified: text(LIMITS.hanzi),
  pinyin: text(LIMITS.pinyin),
  meaning: text(LIMITS.meaning),
  notes: text(LIMITS.notes),
  tags: v.pipe(v.array(v.pipe(text(LIMITS.tag), v.minLength(1))), v.maxLength(LIMITS.tags)),
  createdAt: time,
  updatedAt: time,
  deleted,
});

export const TemplateSchema = v.strictObject({
  id,
  name: v.pipe(text(LIMITS.templateName), v.minLength(1)),
  front: v.pipe(v.array(field), v.minLength(1), v.maxLength(CARD_FIELDS.length)),
  back: v.pipe(v.array(field), v.minLength(1), v.maxLength(CARD_FIELDS.length)),
  builtin: v.boolean(),
  createdAt: time,
  updatedAt: time,
  deleted,
});

export const ReviewStateSchema = v.strictObject({
  key: v.pipe(v.string(), v.maxLength(130)),
  cardId: id,
  templateId: id,
  due: time,
  stability: finite(0, 1e7),
  stabilityFast: finite(0, 1e7),
  difficulty: finite(0, 11),
  scheduledDays: finite(0, 1e6),
  learningStep: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(100)),
  reps: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1e6)),
  lapses: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1e6)),
  state,
  scheduleStatus: v.picklist(['new', 'learning', 'review'] as const),
  lastReview: v.nullable(time),
  updatedAt: time,
});

export const ReviewLogSchema = v.strictObject({
  id,
  cardId: id,
  templateId: id,
  rating: v.picklist([1, 2, 3, 4] as const),
  state,
  due: time,
  stability: finite(0, 1e7),
  stabilityFast: finite(0, 1e7),
  difficulty: finite(0, 11),
  scheduledDays: finite(0, 1e6),
  learningStep: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(100)),
  review: time,
});

export const BackupSchema = v.strictObject({
  format: v.literal(BACKUP_FORMAT),
  version: v.literal(BACKUP_VERSION),
  exportedAt: time,
  decks: v.pipe(v.array(DeckSchema), v.maxLength(LIMITS.decks)),
  cards: v.pipe(v.array(CardSchema), v.maxLength(LIMITS.cards)),
  templates: v.pipe(v.array(TemplateSchema), v.maxLength(LIMITS.templates)),
  reviewStates: v.pipe(v.array(ReviewStateSchema), v.maxLength(LIMITS.reviewStates)),
  reviewLogs: v.pipe(v.array(ReviewLogSchema), v.maxLength(LIMITS.reviewLogs)),
});

export type Backup = v.InferOutput<typeof BackupSchema>;

export type ParseResult = { ok: true; backup: Backup } | { ok: false; errors: string[] };

/** Parses backup file text. Never throws. */
export function parseBackup(text: string): ParseResult {
  if (text.length > LIMITS.importBytes) return { ok: false, errors: ['File is larger than 10 MB.'] };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['File is not valid JSON.'] };
  }
  const result = v.safeParse(BackupSchema, raw, { abortPipeEarly: true });
  if (!result.success) {
    const errors = result.issues.slice(0, 5).map((issue) => {
      const path = issue.path?.map((p) => String(p.key)).join('.') ?? 'file';
      return `${path}: ${issue.message}`;
    });
    return { ok: false, errors };
  }
  return { ok: true, backup: result.output };
}
