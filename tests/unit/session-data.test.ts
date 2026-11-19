import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { store } from '../../src/core/db/store';
import type { Card } from '../../src/core/db/model';
import { loadOverview, loadSession, type SessionData } from '../../src/modules/flashcards/session-data';
import { tagSlug } from '../../src/core/tags';

const NOW = 1_800_000_000_000;
const card = (id: string, deckId: string, i: number): Card => ({
  id,
  deckId,
  kind: 'word',
  traditional: `字${i}`,
  simplified: `字${i}`,
  pinyin: 'zì',
  meaning: 'character',
  notes: '',
  tags: [],
  createdAt: NOW - 1000 + i,
  updatedAt: NOW - 1000 + i,
  deleted: 0,
});
const ids = (s: SessionData | undefined) => s?.queue.map((q) => `${q.card.id}|${q.template.id}`);

describe('the Study page overview', () => {
  it('builds the same queues from one read as loading each deck on its own', async () => {
    await store.saveDeck({ id: 'deck-a', name: 'A', createdAt: 1, updatedAt: 1, deleted: 0 });
    await store.saveDeck({ id: 'deck-b', name: 'B', createdAt: 1, updatedAt: 1, deleted: 0 });
    for (let i = 0; i < 30; i++) await store.saveCard(card(`c${i}`, i % 3 === 0 ? 'deck-a' : 'deck-b', i));
    // Some cards already studied and due, so the queue mixes reviews with new cards.
    for (let i = 0; i < 10; i++) {
      await store.recordReview(
        {
          key: `c${i}|tpl-reading`,
          cardId: `c${i}`,
          templateId: 'tpl-reading',
          due: NOW - 60_000 * i,
          stability: 2,
          stabilityFast: 2,
          difficulty: 5,
          scheduledDays: 2,
          learningStep: 0,
          reps: 2,
          lapses: 0,
          state: 2,
          scheduleStatus: 'review',
          lastReview: NOW - 2 * 86_400_000,
          updatedAt: NOW - 2 * 86_400_000,
        },
        {
          id: `log-${i}`,
          cardId: `c${i}`,
          templateId: 'tpl-reading',
          rating: 3,
          state: 1,
          due: NOW,
          stability: 2,
          stabilityFast: 2,
          difficulty: 5,
          scheduledDays: 2,
          learningStep: 0,
          review: NOW - 2 * 86_400_000,
        },
      );
    }

    const overview = await loadOverview(['deck-a', 'deck-b', 'empty'], NOW);
    expect(ids(overview.all)).toEqual(ids(await loadSession(undefined, {}, NOW)));
    for (const deck of ['deck-a', 'deck-b', 'empty']) {
      expect(ids(overview.perDeck.get(deck))).toEqual(ids(await loadSession(deck, {}, NOW)));
      expect(overview.perDeck.get(deck)?.totalCards).toBe((await loadSession(deck, {}, NOW)).totalCards);
    }
    expect(overview.all.totalCards).toBe(30);

    // Tags: every card is tagged "all", every third also "third".
    for (let i = 0; i < 30; i++) {
      const c = card(`c${i}`, i % 3 === 0 ? 'deck-a' : 'deck-b', i);
      await store.saveCard({ ...c, tags: i % 3 === 0 ? ['all', 'third'] : ['all'] });
    }
    const tagged = await loadOverview(['deck-a', 'deck-b'], NOW);
    expect([...tagged.perTag.keys()]).toEqual(['all', 'third']);
    expect(tagged.perTag.get('third')?.totalCards).toBe(10);
    expect(ids(tagged.perTag.get('third'))).toEqual(
      ids(await loadSession(undefined, { tag: tagSlug('third') }, NOW)),
    );
    expect(ids(tagged.perTag.get('all'))).toEqual(ids(tagged.all));
    expect(overview.perDeck.get('deck-a')?.totalCards).toBe(10);
  });
});
