import { useState } from 'preact/hooks';
import { store } from '../../core/db/store';
import { DEFAULT_DECK_ID } from '../../core/db/defaults';
import { LIMITS, newId, type Deck } from '../../core/db/model';
import { cleanText } from '../../core/safe/text';
import { Icon } from '../../core/ui/Icon';
import { errorMessage, useAsync } from '../../core/ui/useAsync';

export function DecksPage() {
  const data = useAsync(async () => {
    const [decks, cards] = await Promise.all([store.listDecks(), store.listCards()]);
    const counts = new Map<string, number>();
    for (const c of cards) counts.set(c.deckId, (counts.get(c.deckId) ?? 0) + 1);
    return { decks, counts };
  }, []);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    const clean = cleanText(name, LIMITS.deckName);
    if (!clean) return;
    if ((data.data?.decks.length ?? 0) >= LIMITS.decks) {
      setError('You have reached the maximum number of decks.');
      return;
    }
    const now = Date.now();
    await store.saveDeck({ id: newId(), name: clean, createdAt: now, updatedAt: now, deleted: 0 });
    setName('');
    data.reload();
  };

  const rename = async (deck: Deck) => {
    const next = window.prompt('New deck name', deck.name);
    if (next === null) return;
    const clean = cleanText(next, LIMITS.deckName);
    if (!clean) return;
    await store.saveDeck({ ...deck, name: clean });
    data.reload();
  };

  const remove = async (deck: Deck, count: number) => {
    const msg = count
      ? `Delete “${deck.name}” and its ${count} cards? This cannot be undone (unless you have a backup).`
      : `Delete “${deck.name}”?`;
    if (!window.confirm(msg)) return;
    try {
      await store.deleteDeck(deck.id);
      data.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <>
      <div class="page-head">
        <h1>Decks</h1>
      </div>
      {error && <div class="notice error">{error}</div>}
      <form
        class="panel row"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input
          type="text"
          class="grow"
          placeholder="New deck name, e.g. Lesson 4"
          aria-label="New deck name"
          value={name}
          maxLength={LIMITS.deckName}
          onInput={(e) => {
            setName(e.currentTarget.value);
          }}
        />
        <button type="submit" class="primary" disabled={!name.trim()}>
          <Icon name="plus" /> Add deck
        </button>
      </form>
      <section class="panel">
        <ul class="list">
          {(data.data?.decks ?? []).map((d) => {
            const count = data.data?.counts.get(d.id) ?? 0;
            return (
              <li key={d.id}>
                <div class="grow">
                  <div class="truncate">{d.name}</div>
                  <div class="small muted">{count} cards</div>
                </div>
                <button
                  type="button"
                  class="icon-only"
                  aria-label={`Rename ${d.name}`}
                  onClick={() => void rename(d)}
                >
                  <Icon name="edit" />
                </button>
                {d.id !== DEFAULT_DECK_ID && (
                  <button
                    type="button"
                    class="icon-only ghost danger"
                    aria-label={`Delete ${d.name}`}
                    onClick={() => void remove(d, count)}
                  >
                    <Icon name="trash" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
