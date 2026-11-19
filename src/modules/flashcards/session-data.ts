import { store } from '../../core/db/store';
import type { Card, Template } from '../../core/db/model';
import { buildQueue, startOfStudyDay, type QueueItem } from '../../core/srs/queue';
import { getStudyPrefs } from '../../core/study-prefs';
import { initScheduler } from '../../core/srs/scheduler';

export interface SessionData {
  queue: QueueItem[];
  templates: Template[];
  totalCards: number;
}

/** Active templates that still exist; falls back to the first template if none are active. */
export async function activeTemplates(): Promise<Template[]> {
  const all = await store.listTemplates();
  const ids = new Set(getStudyPrefs().activeTemplates);
  const active = all.filter((t) => ids.has(t.id));
  return active.length > 0 ? active : all.slice(0, 1);
}

export interface SessionOptions {
  /**
   * Study ahead: a session the student asks for when nothing is due. Cards come up before
   * they are due, and a fresh day's worth of new cards is allowed on top of today's.
   */
  ahead?: boolean;
}

/** Everything a session is built from, read once (the cards of one deck, or all of them). */
async function readStudyData(deckId: string | undefined, now: number, ahead: boolean) {
  const [cards, templates] = await Promise.all([store.listCards(deckId), activeTemplates(), initScheduler()]);
  const states = await store.listReviewStates(templates.map((t) => t.id));
  const perDay = getStudyPrefs().newPerDay;
  const newToday = ahead ? 0 : await store.countReviewsSince(startOfStudyDay(now), true);
  const newLimit = Math.max(0, perDay - newToday);
  const session = (subset: Card[]): SessionData => ({
    queue: buildQueue({ cards: subset, templates, states, now, newLimit, ahead }),
    templates,
    totalCards: subset.length,
  });
  return { cards, session };
}

export async function loadSession(
  deckId: string | undefined,
  { ahead = false }: SessionOptions = {},
  now = Date.now(),
): Promise<SessionData> {
  const { cards, session } = await readStudyData(deckId, now, ahead);
  return session(cards);
}

/**
 * The Study page's overview: the session for all cards and for each deck, from one read
 * of the cards and their progress (not one per deck).
 */
export async function loadOverview(
  deckIds: readonly string[],
  now = Date.now(),
): Promise<{ all: SessionData; perDeck: Map<string, SessionData> }> {
  const { cards, session } = await readStudyData(undefined, now, false);
  const byDeck = new Map<string, Card[]>(deckIds.map((id) => [id, []]));
  for (const card of cards) byDeck.get(card.deckId)?.push(card);
  return {
    all: session(cards),
    perDeck: new Map([...byDeck].map(([id, deckCards]) => [id, session(deckCards)])),
  };
}
