import { useMemo, useState } from 'preact/hooks';
import { store } from '../../core/db/store';
import { href } from '../../core/router';
import { Pinyin, Simp, Trad } from '../../core/ui/chinese';
import { Icon } from '../../core/ui/Icon';
import { useAsync } from '../../core/ui/useAsync';
import { useStudyPrefs } from '../../core/study-prefs';

/** Lower-cases and strips tone marks so "yinhang" finds "yínháng". */
function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function CardsPage() {
  const prefs = useStudyPrefs();
  const [deckId, setDeckId] = useState('');
  const [query, setQuery] = useState('');
  const data = useAsync(
    async () => ({ cards: await store.listCards(deckId || undefined), decks: await store.listDecks() }),
    [deckId],
  );

  const shown = useMemo(() => {
    const cards = data.data?.cards ?? [];
    const q = fold(query.trim());
    if (!q) return cards;
    return cards.filter((c) =>
      [c.traditional, c.simplified, c.pinyin, c.meaning, c.tags.join(' ')].some((f) => fold(f).includes(q)),
    );
  }, [data.data, query]);

  const remove = async (id: string) => {
    if (!window.confirm('Delete this card and its study history?')) return;
    await store.deleteCard(id);
    data.reload();
  };

  return (
    <>
      <div class="page-head">
        <h1>Cards</h1>
        <div class="row">
          <a class="button" href={href('/decks')}>
            Decks
          </a>
          <a class="button primary" href={href('/add')}>
            <Icon name="plus" /> Add card
          </a>
        </div>
      </div>
      <div class="panel grid">
        <input
          type="search"
          placeholder="Search characters, pinyin, meaning or tags"
          aria-label="Search cards"
          value={query}
          maxLength={100}
          onInput={(e) => {
            setQuery(e.currentTarget.value);
          }}
        />
        <select
          aria-label="Deck"
          value={deckId}
          onChange={(e) => {
            setDeckId(e.currentTarget.value);
          }}
        >
          <option value="">All decks</option>
          {(data.data?.decks ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      {data.error && <div class="notice error">{data.error}</div>}
      <section class="panel">
        {shown.length === 0 ? (
          <p class="muted">{data.loading ? 'Loading…' : 'No cards found.'}</p>
        ) : (
          <ul class="list">
            {shown.map((c) => (
              <li key={c.id}>
                <div class="grow">
                  <div class="row">
                    <Trad text={c.traditional} class="card-row-hanzi" />
                    {prefs.showSimplified && c.simplified !== c.traditional && (
                      <Simp text={c.simplified} class="muted" />
                    )}
                    <Pinyin text={c.pinyin} />
                  </div>
                  <div class="muted small truncate">{c.meaning}</div>
                </div>
                <a class="button icon-only" href={href(`/cards/${c.id}`)} aria-label="Edit card">
                  <Icon name="edit" />
                </a>
                <button
                  type="button"
                  class="icon-only ghost danger"
                  aria-label="Delete card"
                  onClick={() => void remove(c.id)}
                >
                  <Icon name="trash" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p class="small muted">{shown.length} cards</p>
    </>
  );
}
