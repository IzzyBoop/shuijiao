import { useState } from 'preact/hooks';
import { store } from '../../core/db/store';
import { href } from '../../core/router';
import { LIMITS, newId, type Deck } from '../../core/db/model';
import { cleanText } from '../../core/safe/text';
import { Dialog } from '../../core/ui/Dialog';
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

  const [deleting, setDeleting] = useState<Deck | null>(null);
  const decks = data.data?.decks ?? [];

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
          {decks.map((d) => {
            const count = data.data?.counts.get(d.id) ?? 0;
            return (
              <li key={d.id}>
                <div class="grow">
                  <a class="truncate" href={href(`/cards/deck/${d.id}`)}>
                    {d.name}
                  </a>
                  <div class="small muted">
                    {count} card{count === 1 ? '' : 's'}
                  </div>
                </div>
                <button
                  type="button"
                  class="icon-only"
                  aria-label={`Rename ${d.name}`}
                  onClick={() => void rename(d)}
                >
                  <Icon name="edit" />
                </button>
                <button
                  type="button"
                  class="icon-only ghost danger"
                  aria-label={`Delete ${d.name}`}
                  disabled={decks.length <= 1}
                  title={decks.length <= 1 ? 'You need at least one deck' : undefined}
                  onClick={() => {
                    setError(null);
                    setDeleting(d);
                  }}
                >
                  <Icon name="trash" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      {decks.length <= 1 && (
        <p class="small muted">You need at least one deck, so the last one can't be deleted.</p>
      )}

      {deleting && (
        <DeleteDeckDialog
          deck={deleting}
          count={data.data?.counts.get(deleting.id) ?? 0}
          others={decks.filter((d) => d.id !== deleting.id)}
          onClose={() => {
            setDeleting(null);
          }}
          onDone={(err) => {
            setDeleting(null);
            if (err) setError(err);
            data.reload();
          }}
        />
      )}
    </>
  );
}

/** Asks what to do with a deck's cards before deleting it. */
function DeleteDeckDialog({
  deck,
  count,
  others,
  onClose,
  onDone,
}: {
  deck: Deck;
  count: number;
  others: readonly Deck[];
  onClose: () => void;
  onDone: (error?: string) => void;
}) {
  const [mode, setMode] = useState<'move' | 'delete'>('move');
  const [target, setTarget] = useState(others[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const cards = `${count} card${count === 1 ? '' : 's'}`;

  const confirm = async () => {
    setBusy(true);
    try {
      await store.deleteDeck(deck.id, count > 0 && mode === 'move' ? target : undefined);
      onDone();
    } catch (err) {
      onDone(errorMessage(err));
    }
  };

  return (
    <Dialog
      open
      title={`Delete “${deck.name}”?`}
      onClose={onClose}
      actions={
        <>
          <button type="button" class="primary" autofocus onClick={onClose}>
            Cancel
          </button>
          <button type="button" class="danger" disabled={busy} onClick={() => void confirm()}>
            <Icon name="trash" />{' '}
            {count > 0 && mode === 'delete' ? `Delete deck and ${cards}` : 'Delete deck'}
          </button>
        </>
      }
    >
      {count === 0 ? (
        <p>This deck is empty.</p>
      ) : (
        <fieldset class="choice-group">
          <legend>
            It has {cards}. What should happen to {count === 1 ? 'it' : 'them'}?
          </legend>
          <label class="check">
            <input
              type="radio"
              name="deck-cards"
              checked={mode === 'move'}
              onChange={() => {
                setMode('move');
              }}
            />
            Move {count === 1 ? 'it' : 'them'} to
            <select
              aria-label="Deck to move the cards to"
              value={target}
              onFocus={() => {
                setMode('move');
              }}
              onChange={(e) => {
                setTarget(e.currentTarget.value);
                setMode('move');
              }}
            >
              {others.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label class="check">
            <input
              type="radio"
              name="deck-cards"
              checked={mode === 'delete'}
              onChange={() => {
                setMode('delete');
              }}
            />
            Delete {count === 1 ? 'it' : 'them'} too, with {count === 1 ? 'its' : 'their'} study history
          </label>
        </fieldset>
      )}
      <p class="small muted">
        {count > 0 && mode === 'delete'
          ? "This can't be undone unless you have a backup."
          : 'Moved cards keep their study progress.'}
      </p>
    </Dialog>
  );
}
