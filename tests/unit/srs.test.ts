import { beforeAll, describe, expect, it } from 'vitest';
import {
  applyReview,
  emptyState,
  formatInterval,
  initScheduler,
  previewDue,
} from '../../src/core/srs/scheduler';
import { buildQueue, requeue, separateSameCard, startOfStudyDay } from '../../src/core/srs/queue';
import { builtinTemplates, DEFAULT_DECK_ID } from '../../src/core/db/defaults';
import type { QueueItem } from '../../src/core/srs/queue';
import type { Card } from '../../src/core/db/model';

const NOW = Date.parse('2026-11-16T10:00:00Z');

beforeAll(async () => {
  await initScheduler();
});

const card = (id: string): Card => ({
  id,
  deckId: DEFAULT_DECK_ID,
  kind: 'word',
  traditional: '好',
  simplified: '好',
  pinyin: 'hǎo',
  meaning: 'good',
  notes: '',
  tags: [],
  createdAt: NOW,
  updatedAt: NOW,
  deleted: 0,
});

describe('scheduler', () => {
  it('schedules a new card: Again soon, Easy much later', () => {
    const due = previewDue(emptyState('c1', 'tpl-reading', NOW), NOW);
    expect(due[1] - NOW).toBeLessThan(15 * 60_000);
    expect(due[4]).toBeGreaterThan(due[3]);
    expect(due[3]).toBeGreaterThan(due[1]);
  });

  it('records a review and moves the card on', () => {
    const { state, log } = applyReview(emptyState('c1', 'tpl-reading', NOW), 3, NOW);
    expect(state.reps).toBe(1);
    expect(state.due).toBeGreaterThan(NOW);
    expect(state.lastReview).toBe(NOW);
    expect(log.rating).toBe(3);
    expect(log.state).toBe(0);
  });

  it('formats intervals', () => {
    expect(formatInterval(60_000)).toBe('1m');
    expect(formatInterval(3 * 3_600_000)).toBe('3h');
    expect(formatInterval(4 * 86_400_000)).toBe('4d');
  });
});

describe('queue', () => {
  const templates = builtinTemplates(NOW).slice(0, 1);

  it('puts due cards before new ones and respects the new-card limit', () => {
    const cards = [card('a'), card('b'), card('c')];
    const due = {
      ...emptyState('a', 'tpl-reading', NOW),
      state: 2 as const,
      scheduleStatus: 'review' as const,
      due: NOW - 1000,
    };
    const q = buildQueue({ cards, templates, states: [due], now: NOW, newLimit: 1 });
    expect(q.map((i) => i.card.id)).toEqual(['a', 'b']);
  });

  it('leaves out cards that are not due yet', () => {
    const later = {
      ...emptyState('a', 'tpl-reading', NOW),
      state: 2 as const,
      scheduleStatus: 'review' as const,
      due: NOW + 86_400_000,
    };
    expect(buildQueue({ cards: [card('a')], templates, states: [later], now: NOW, newLimit: 10 })).toEqual(
      [],
    );
  });

  it('studying ahead brings up cards that are not due, the soonest first, after the rest', () => {
    const review = (id: string, due: number) => ({
      ...emptyState(id, 'tpl-reading', NOW),
      state: 2 as const,
      scheduleStatus: 'review' as const,
      due,
    });
    const day = 86_400_000;
    const states = [review('far', NOW + 9 * day), review('due', NOW - 1000), review('soon', NOW + day)];
    const cards = [card('far'), card('due'), card('soon'), card('new')];
    const input = { cards, templates, states, now: NOW, newLimit: 5 };

    // Ordinarily only what is due, and the new card.
    expect(buildQueue(input).map((i) => i.card.id)).toEqual(['due', 'new']);
    // Ahead: the same, then the others in the order they would have come up.
    expect(buildQueue({ ...input, ahead: true }).map((i) => i.card.id)).toEqual([
      'due',
      'new',
      'soon',
      'far',
    ]);
    // They keep their state, so answering them counts as an early review.
    const soon = buildQueue({ ...input, ahead: true })[2];
    expect(soon?.state?.due).toBe(NOW + day);
  });

  it('studying ahead with every card already seen still gives a session', () => {
    const later = {
      ...emptyState('a', 'tpl-reading', NOW),
      state: 2 as const,
      scheduleStatus: 'review' as const,
      due: NOW + 86_400_000,
    };
    const input = { cards: [card('a')], templates, states: [later], now: NOW, newLimit: 10 };
    expect(buildQueue(input)).toEqual([]);
    expect(buildQueue({ ...input, ahead: true }).map((i) => i.card.id)).toEqual(['a']);
  });

  it('starts the study day at 04:00 local time', () => {
    const start = new Date(startOfStudyDay(NOW));
    expect(start.getHours()).toBe(4);
    expect(start.getTime()).toBeLessThanOrEqual(NOW);
  });
});

describe('no repeats in a row', () => {
  const templates = builtinTemplates(NOW);
  const template = (t: number) => {
    const found = templates[t];
    if (!found) throw new Error(`no template ${t}`);
    return found;
  };
  const item = (cardId: string, t = 0, due?: number): QueueItem => ({
    card: card(cardId),
    template: template(t),
    state: due === undefined ? null : { ...emptyState(cardId, 'tpl-reading', NOW), state: 1, due },
  });
  const ids = (q: readonly QueueItem[]) => q.map((i) => i.card.id);

  it('a card you pressed Again on does not jump to the front of new cards', () => {
    // The bug: new cards have no due time, so the card came straight back, over and over.
    const rest = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10'].map((id) => item(id));
    const again = item('x', 0, NOW + 60_000);
    const q = requeue(rest, again, NOW);
    expect(ids(q).indexOf('x')).toBeGreaterThanOrEqual(3);
    // Simulate a session where you press Again on "x" every time it shows:
    // it must never be shown twice in a row while other cards remain.
    let queue = q;
    const shown: string[] = [];
    while (queue.length > 0 && shown.length < 30) {
      const [head, ...tail] = queue;
      if (!head) break;
      shown.push(head.card.id);
      queue =
        head.card.id === 'x' && shown.filter((s) => s === 'x').length < 4 ? requeue(tail, again, NOW) : tail;
    }
    // "x" twice in a row is only allowed once no other cards are left.
    for (let k = 1; k < shown.length; k++) {
      if (shown[k] === 'x' && shown[k - 1] === 'x')
        expect(shown.slice(k).every((id) => id === 'x')).toBe(true);
    }
    expect(shown.filter((id) => id !== 'x')).toHaveLength(10);
  });

  it('comes back after about as many cards as fit before it is due', () => {
    const rest = Array.from({ length: 200 }, (_, i) => item(`n${i}`));
    expect(ids(requeue(rest, item('x', 0, NOW + 10 * 60_000), NOW)).indexOf('x')).toBe(75);
    expect(ids(requeue(rest, item('x', 0, NOW + 1_000), NOW)).indexOf('x')).toBe(3);
  });

  it('with only a couple of cards left, it goes to the end', () => {
    expect(ids(requeue([item('a'), item('b')], item('x', 0, NOW + 60_000), NOW))).toEqual(['a', 'b', 'x']);
    expect(ids(requeue([], item('x', 0, NOW + 60_000), NOW))).toEqual(['x']);
  });

  it('is not placed next to another card type of the same card', () => {
    const rest = [item('a'), item('b'), item('c'), item('x', 1), item('d'), item('e')];
    const q = ids(requeue(rest, item('x', 0, NOW + 1_000), NOW));
    const at = q.indexOf('x');
    expect(q[at + 1]).not.toBe('x');
    expect(q[at - 1]).not.toBe('x');
  });

  it('separates two types of the same card when something else can go between', () => {
    expect(ids(separateSameCard([item('a', 0), item('a', 1), item('b'), item('c')]))).toEqual([
      'a',
      'b',
      'a',
      'c',
    ]);
    // Nothing else to put between them: left as is.
    expect(ids(separateSameCard([item('a', 0), item('a', 1)]))).toEqual(['a', 'a']);
  });

  it('new cards studied in several card types are interleaved', () => {
    const q = buildQueue({
      cards: [card('a'), card('b'), card('c')],
      templates: templates.slice(0, 2),
      states: [],
      now: NOW,
      newLimit: 6,
    });
    const order = ids(q);
    expect(order).toHaveLength(6);
    for (let i = 1; i < order.length; i++) expect(order[i]).not.toBe(order[i - 1]);
  });
});
