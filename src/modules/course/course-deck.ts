import { parseBackup, type Backup } from '../../core/db/backup-schema';
import type { Card } from '../../core/db/model';
import type { ImportDuplicate } from '../../core/db/store';

/** The course cards, published with the site (see tools/make-course-deck.ts). */
export const COURSE_DECK_URL = 'course/course-deck.json';

/** Meta key: the version (exportedAt) of the course cards the student has seen. */
export const COURSE_SEEN_KEY = 'courseSeenAt';

export type CourseLoad =
  { kind: 'ok'; backup: Backup } | { kind: 'none' } | { kind: 'error'; message: string };

/** Fetches and checks the course cards. Never throws. */
export async function loadCourseDeck(): Promise<CourseLoad> {
  let response: Response;
  try {
    response = await fetch(COURSE_DECK_URL, {
      // Ask the site each time, so students see an update as soon as it's published.
      cache: 'no-cache',
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
  } catch {
    return { kind: 'error', message: "Couldn't reach the site. Check your connection and try again." };
  }
  // A missing file comes back as 404 on the live site, or as the app page from a local server.
  if (response.status === 404) return { kind: 'none' };
  if (!response.ok) {
    return {
      kind: 'error',
      message: `The site answered with an error (${response.status}). Try again later.`,
    };
  }
  if (!(response.headers.get('content-type') ?? '').includes('json')) return { kind: 'none' };
  const result = parseBackup(await response.text());
  if (!result.ok) {
    return {
      kind: 'error',
      message: `The course cards on the site can't be read. ${result.errors.join(' ')}`,
    };
  }
  return { kind: 'ok', backup: result.backup };
}

/** How a course card compares with the student's own cards. */
export type CourseCardStatus = 'new' | 'have' | 'changed';

export interface CourseDeckSummary {
  id: string;
  name: string;
  cards: { card: Card; status: CourseCardStatus }[];
}

export interface CourseSummary {
  updatedAt: number;
  total: number;
  words: number;
  sentences: number;
  counts: Record<CourseCardStatus, number>;
  decks: CourseDeckSummary[];
}

/**
 * Groups the course cards by deck and marks each one as new to the student, already
 * theirs, or theirs but different (an edited copy, or the same word with other details).
 */
export function summarizeCourse(
  backup: Backup,
  myCards: readonly Card[],
  duplicates: readonly ImportDuplicate[],
): CourseSummary {
  const mine = new Set(myCards.filter((c) => c.deleted === 0).map((c) => c.id));
  const dupById = new Map(duplicates.map((d) => [d.incoming.id, d]));
  const statusOf = (card: Card): CourseCardStatus => {
    const dup = dupById.get(card.id);
    if (dup) return dup.differences.length > 0 ? 'changed' : 'have';
    return mine.has(card.id) ? 'have' : 'new';
  };

  const cards = backup.cards.filter((c) => c.deleted === 0).sort((a, b) => a.createdAt - b.createdAt);
  const decks = new Map<string, CourseDeckSummary>();
  for (const d of backup.decks) {
    if (d.deleted === 0) decks.set(d.id, { id: d.id, name: d.name, cards: [] });
  }
  // Cards whose deck isn't in the file go to "My cards" on import, so list them that way.
  const other: CourseDeckSummary = { id: '', name: 'My cards', cards: [] };
  const counts: Record<CourseCardStatus, number> = { new: 0, have: 0, changed: 0 };
  for (const card of cards) {
    const status = statusOf(card);
    counts[status]++;
    (decks.get(card.deckId) ?? other).cards.push({ card, status });
  }

  const words = cards.filter((c) => c.kind === 'word').length;
  return {
    updatedAt: backup.exportedAt,
    total: cards.length,
    words,
    sentences: cards.length - words,
    counts,
    decks: [...decks.values(), other].filter((d) => d.cards.length > 0),
  };
}
