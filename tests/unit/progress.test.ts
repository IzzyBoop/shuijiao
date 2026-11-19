import { describe, expect, it } from 'vitest';
import type { Card, Deck, ReviewLog, ReviewState } from '../../src/core/db/model';
import {
  accuracyByDeck,
  dayKey,
  forecast,
  heatmap,
  streaks,
  troubleCards,
} from '../../src/modules/flashcards/progress-stats';

/** Local time, like the student's clock: Thursday 19 Nov 2026, 3 pm. */
const NOW = new Date(2026, 10, 19, 15, 0).getTime();
const at = (day: number, hour = 10) => new Date(2026, 10, day, hour).getTime();

const card = (id: string, deckId = 'd1'): Card => ({
  id,
  deckId,
  kind: 'word',
  traditional: id,
  simplified: id,
  pinyin: '',
  meaning: id,
  notes: '',
  tags: [],
  createdAt: 1,
  updatedAt: 1,
  deleted: 0,
});
const state = (cardId: string, due: number, over: Partial<ReviewState> = {}): ReviewState => ({
  key: `${cardId}|tpl-reading`,
  cardId,
  templateId: 'tpl-reading',
  due,
  stability: 1,
  stabilityFast: 1,
  difficulty: 5,
  scheduledDays: 1,
  learningStep: 0,
  reps: 3,
  lapses: 0,
  state: 2,
  scheduleStatus: 'review',
  lastReview: 1,
  updatedAt: 1,
  ...over,
});
const log = (cardId: string, rating: 1 | 2 | 3 | 4): ReviewLog => ({
  id: `${cardId}-${rating}-${Math.random()}`,
  cardId,
  templateId: 'tpl-reading',
  rating,
  state: 2,
  due: 1,
  stability: 1,
  stabilityFast: 1,
  difficulty: 5,
  scheduledDays: 1,
  learningStep: 0,
  review: NOW,
});

describe('progress', () => {
  it('counts a review at 3 am as the day before (study days start at 4 am)', () => {
    expect(dayKey(at(19, 3))).toBe('2026-11-18');
    expect(dayKey(at(19, 5))).toBe('2026-11-19');
  });

  it('counts streaks of study days, still alive if today has no reviews yet', () => {
    const times = [at(19), at(18), at(17), at(10), at(9), at(8), at(7), at(6)];
    expect(streaks(times, NOW)).toEqual({ current: 3, longest: 5 });
    expect(streaks([at(18), at(17)], NOW)).toEqual({ current: 2, longest: 2 });
    expect(streaks([at(16)], NOW)).toEqual({ current: 0, longest: 1 });
    expect(streaks([], NOW)).toEqual({ current: 0, longest: 0 });
  });

  it('lays out the last weeks Monday to Sunday, shading the busiest days darkest', () => {
    const columns = heatmap([at(19), at(19), at(19), at(19), at(18)], NOW, 4);
    expect(columns).toHaveLength(4);
    expect(columns.every((c) => c.length === 7)).toBe(true);
    const days = columns.flat();
    expect(new Date(days[0]?.time ?? 0).getDay()).toBe(1); // starts on a Monday
    const today = days.find((d) => d.key === '2026-11-19');
    expect(today).toMatchObject({ count: 4, level: 4, future: false });
    expect(days.find((d) => d.key === '2026-11-18')).toMatchObject({ count: 1, level: 1 });
    expect(days.find((d) => d.key === '2026-11-20')?.future).toBe(true);
    expect(days.filter((d) => d.count > 0)).toHaveLength(2);
  });

  it('forecasts reviews for the next week; overdue cards count for today, new ones not at all', () => {
    const f = forecast(
      [
        state('a', at(10)), // overdue
        state('b', at(19, 20)), // later today
        state('c', at(22)),
        state('d', at(25, 23)),
        state('e', at(27)), // beyond the week
        state('f', at(19), { state: 0 }), // new
      ],
      NOW,
    );
    expect(f.days.map((d) => d.count)).toEqual([2, 0, 0, 1, 0, 0, 1]);
    expect(f.next30).toBe(5);
  });

  it("works out each deck's share of Good and Easy answers", () => {
    const decks: Deck[] = [
      { id: 'd1', name: 'Lesson 1', createdAt: 1, updatedAt: 1, deleted: 0 },
      { id: 'd2', name: 'Lesson 2', createdAt: 1, updatedAt: 1, deleted: 0 },
      { id: 'd3', name: 'Unused', createdAt: 1, updatedAt: 1, deleted: 0 },
    ];
    const rows = accuracyByDeck(
      [log('a', 3), log('a', 4), log('a', 1), log('b', 2), log('gone', 4)],
      [card('a', 'd1'), card('b', 'd2')],
      decks,
    );
    expect(rows.map((r) => [r.deck.name, r.answers, r.share])).toEqual([
      ['Lesson 1', 3, 2 / 3],
      ['Lesson 2', 1, 0],
    ]);
  });

  it('lists the cards forgotten most often, across their card types', () => {
    const rows = troubleCards(
      [
        state('a', 1, { lapses: 1 }),
        state('b', 1, { lapses: 2 }),
        { ...state('b', 1, { lapses: 2 }), key: 'b|tpl-listening', templateId: 'tpl-listening' },
        state('c', 1),
      ],
      [card('a'), card('b'), card('c')],
    );
    expect(rows.map((r) => [r.card.id, r.lapses])).toEqual([
      ['b', 4],
      ['a', 1],
    ]);
  });
});
