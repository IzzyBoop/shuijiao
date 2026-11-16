import { store } from '../../core/db/store';
import type { Template } from '../../core/db/model';
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

export async function loadSession(deckId: string | undefined, now = Date.now()): Promise<SessionData> {
  const [cards, templates] = await Promise.all([store.listCards(deckId), activeTemplates(), initScheduler()]);
  const states = await store.listReviewStates(templates.map((t) => t.id));
  const newToday = await store.countReviewsSince(startOfStudyDay(now), true);
  const newLimit = Math.max(0, getStudyPrefs().newPerDay - newToday);
  return {
    queue: buildQueue({ cards, templates, states, now, newLimit }),
    templates,
    totalCards: cards.length,
  };
}
