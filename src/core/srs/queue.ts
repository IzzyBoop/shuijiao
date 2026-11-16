import { stateKey, type Card, type ReviewState, type Template } from '../db/model';

export interface QueueItem {
  card: Card;
  template: Template;
  state: ReviewState | null;
}

/** The study day starts at 04:00 local time, like most SRS apps. */
export function startOfStudyDay(now: number): number {
  const d = new Date(now);
  d.setHours(4, 0, 0, 0);
  if (d.getTime() > now) d.setDate(d.getDate() - 1);
  return d.getTime();
}

export interface QueueInput {
  cards: readonly Card[];
  templates: readonly Template[];
  states: readonly ReviewState[];
  now: number;
  /** New cards still allowed today. */
  newLimit: number;
}

/** Due learning cards first, then due reviews (oldest first), then new cards up to the limit. */
export function buildQueue({ cards, templates, states, now, newLimit }: QueueInput): QueueItem[] {
  const byKey = new Map(states.map((s) => [s.key, s]));
  const learning: QueueItem[] = [];
  const reviews: QueueItem[] = [];
  const fresh: QueueItem[] = [];

  for (const card of cards) {
    if (card.deleted) continue;
    for (const template of templates) {
      const state = byKey.get(stateKey(card.id, template.id)) ?? null;
      if (!state || state.state === 0) {
        fresh.push({ card, template, state });
      } else if (state.due <= now) {
        (state.state === 2 ? reviews : learning).push({ card, template, state });
      }
    }
  }
  const byDue = (a: QueueItem, b: QueueItem) => (a.state?.due ?? 0) - (b.state?.due ?? 0);
  learning.sort(byDue);
  reviews.sort(byDue);
  return [...learning, ...reviews, ...fresh.slice(0, Math.max(0, newLimit))];
}

export function countQueue(items: readonly QueueItem[]): { due: number; fresh: number } {
  let fresh = 0;
  for (const i of items) if (!i.state || i.state.state === 0) fresh++;
  return { due: items.length - fresh, fresh };
}
