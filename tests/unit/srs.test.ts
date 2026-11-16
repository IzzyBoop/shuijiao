import { beforeAll, describe, expect, it } from 'vitest';
import {
  applyReview,
  emptyState,
  formatInterval,
  initScheduler,
  previewDue,
} from '../../src/core/srs/scheduler';
import { buildQueue, startOfStudyDay } from '../../src/core/srs/queue';
import { builtinTemplates, DEFAULT_DECK_ID } from '../../src/core/db/defaults';
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

  it('starts the study day at 04:00 local time', () => {
    const start = new Date(startOfStudyDay(NOW));
    expect(start.getHours()).toBe(4);
    expect(start.getTime()).toBeLessThanOrEqual(NOW);
  });
});
