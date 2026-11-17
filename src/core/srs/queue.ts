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
  /**
   * Study ahead: also bring up cards that are not due yet, soonest first, after the due
   * ones. For a session the student asks for when nothing is due.
   */
  ahead?: boolean;
}

/**
 * Due learning cards first, then due reviews (oldest first), then new cards up to the limit.
 * When studying ahead, cards that are not due yet come last, the soonest first.
 */
export function buildQueue({ cards, templates, states, now, newLimit, ahead }: QueueInput): QueueItem[] {
  const byKey = new Map(states.map((s) => [s.key, s]));
  const learning: QueueItem[] = [];
  const reviews: QueueItem[] = [];
  const fresh: QueueItem[] = [];
  const early: QueueItem[] = [];

  // Card type by card type (not card by card), so one card's types aren't back to back.
  for (const template of templates) {
    for (const card of cards) {
      if (card.deleted) continue;
      const state = byKey.get(stateKey(card.id, template.id)) ?? null;
      if (!state || state.state === 0) {
        fresh.push({ card, template, state });
      } else if (state.due <= now) {
        (state.state === 2 ? reviews : learning).push({ card, template, state });
      } else if (ahead) {
        early.push({ card, template, state });
      }
    }
  }
  const byDue = (a: QueueItem, b: QueueItem) => (a.state?.due ?? 0) - (b.state?.due ?? 0);
  learning.sort(byDue);
  reviews.sort(byDue);
  early.sort(byDue);
  return separateSameCard([...learning, ...reviews, ...fresh.slice(0, Math.max(0, newLimit)), ...early]);
}

/** How far ahead to look for a different card when two of the same are adjacent. */
const SWAP_WINDOW = 12;

/**
 * Makes sure the same card (in another card type) never comes up twice in a row,
 * when there is any other card to put between them. One pass, looking a little ahead.
 */
export function separateSameCard(items: readonly QueueItem[]): QueueItem[] {
  const out = [...items];
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1];
    const cur = out[i];
    if (!prev || cur?.card.id !== prev.card.id) continue;
    const limit = Math.min(out.length, i + SWAP_WINDOW);
    for (let j = i + 1; j < limit; j++) {
      const other = out[j];
      if (other && other.card.id !== prev.card.id) {
        out[i] = other;
        out[j] = cur;
        break;
      }
    }
  }
  return out;
}

/** Roughly how long one card takes, used to place a card that's due again during the session. */
const MS_PER_CARD = 8_000;
/** A card you need to see again waits for at least this many other cards. */
const MIN_GAP = 3;

/**
 * Puts a card that is due again soon (after Again or Hard) back into the rest of the
 * session: about as many cards later as fit before it's due, but never sooner than
 * MIN_GAP cards, and not right next to another type of the same card.
 */
export function requeue(rest: readonly QueueItem[], item: QueueItem, now: number): QueueItem[] {
  const wait = Math.ceil(Math.max(0, (item.state?.due ?? now) - now) / MS_PER_CARD);
  let at = Math.min(rest.length, Math.max(MIN_GAP, wait));
  const sameCardAt = (i: number) => rest[i]?.card.id === item.card.id;
  while (at < rest.length && (sameCardAt(at - 1) || sameCardAt(at))) at++;
  return [...rest.slice(0, at), item, ...rest.slice(at)];
}

export function countQueue(items: readonly QueueItem[]): { due: number; fresh: number } {
  let fresh = 0;
  for (const i of items) if (!i.state || i.state.state === 0) fresh++;
  return { due: items.length - fresh, fresh };
}
