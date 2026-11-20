import { useEffect, useMemo, useState } from 'preact/hooks';
import type { RouteProps } from '../../core/modules';
import { store, type CardBulkChange } from '../../core/db/store';
import type { Card, Deck } from '../../core/db/model';
import { href } from '../../core/router';
import { cleanTags } from '../../core/safe/text';
import { Pinyin, Simp, Trad } from '../../core/ui/chinese';
import { Icon } from '../../core/ui/Icon';
import { useAsync } from '../../core/ui/useAsync';
import { useStudyPrefs } from '../../core/study-prefs';
import { Pager, usePaging } from '../../core/ui/Pager';
import { rememberCardList } from './return-path';
import { CardEditForm } from './CardEditForm';
import { problemFrom, problemText, ReportLink, type ProblemOrText } from '../../core/ui/problem';

/** Lower-cases and strips tone marks so "yinhang" finds "yínháng". */
function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

type SortKey = 'newest' | 'oldest' | 'pinyin';
const SORT_LABEL: Record<SortKey, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  pinyin: 'A–Z (pinyin)',
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const sorters: Record<SortKey, (a: Card, b: Card) => number> = {
  newest: (a, b) => b.createdAt - a.createdAt,
  oldest: (a, b) => a.createdAt - b.createdAt,
  pinyin: (a, b) => fold(a.pinyin).localeCompare(fold(b.pinyin)),
};

/** What Undo puts back: deleted cards, or the earlier versions of changed cards. */
type Undo = { message: string } & ({ type: 'deleted'; ids: string[] } | { type: 'changed'; cards: Card[] });

/** How many Chinese characters a card has (punctuation and Latin letters don't count). */
const HAN = /\p{Script=Han}/u;
const hanCount = (c: Card) => [...c.traditional].filter((ch) => HAN.test(ch)).length;
type LengthFilter = 'any' | 'one' | 'many';

export function CardsPage({ params }: RouteProps) {
  const deckId = params.deckId;
  const prefs = useStudyPrefs();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [kind, setKind] = useState<'all' | 'word' | 'sentence'>('all');
  const [length, setLength] = useState<LengthFilter>('any');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<Undo | null>(null);
  const [error, setError] = useState<ProblemOrText | null>(null);

  const data = useAsync(async () => {
    const [cards, decks] = await Promise.all([store.listCards(), store.listDecks()]);
    return { cards, decks };
  }, []);

  useEffect(() => {
    rememberCardList(deckId ? `/cards/deck/${deckId}` : '/cards');
    setSelected(new Set());
    setEditingId(null);
  }, [deckId]);

  // The undo bar disappears after a while.
  useEffect(() => {
    if (!undo) return;
    const t = window.setTimeout(() => {
      setUndo(null);
    }, 10_000);
    return () => {
      window.clearTimeout(t);
    };
  }, [undo]);

  const decks = data.data?.decks ?? [];
  const deckName = useMemo(() => new Map(decks.map((d) => [d.id, d.name])), [decks]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of data.data?.cards ?? []) m.set(c.deckId, (m.get(c.deckId) ?? 0) + 1);
    return m;
  }, [data.data]);
  const deck = deckId ? decks.find((d) => d.id === deckId) : undefined;

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    return (data.data?.cards ?? [])
      .filter((c) => !deckId || c.deckId === deckId)
      .filter((c) => kind === 'all' || c.kind === kind)
      .filter((c) => length === 'any' || (length === 'one' ? hanCount(c) === 1 : hanCount(c) >= 2))
      .filter(
        (c) =>
          !q ||
          [c.traditional, c.simplified, c.pinyin, c.meaning, c.notes, c.tags.join(' ')].some((f) =>
            fold(f).includes(q),
          ),
      )
      .sort(sorters[sort]);
  }, [data.data, deckId, query, sort, kind, length]);
  const paging = usePaging(filtered, [deckId, query, kind, length, sort]);
  const shown = paging.shown;
  const total = deck ? (counts.get(deck.id) ?? 0) : (data.data?.cards.length ?? 0);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(problemFrom(err, 'Changing several cards on the Cards page'));
    }
    data.reload();
  };

  const remove = (ids: string[]) =>
    run(async () => {
      await store.deleteCards(ids);
      setSelected(new Set());
      setEditingId(null);
      setUndo({
        type: 'deleted',
        ids,
        message: ids.length === 1 ? 'Card deleted.' : `${ids.length} cards deleted.`,
      });
    });

  const restore = (u: Undo) =>
    run(async () => {
      if (u.type === 'deleted') await store.restoreCards(u.ids);
      else await store.restoreCardVersions(u.cards);
      setUndo(null);
    });

  /** Applies a bulk change to the selected cards, with Undo. */
  const change = (ids: string[], what: CardBulkChange, done: string) =>
    run(async () => {
      const before = await store.updateCards(ids, what);
      // Moved cards leave this deck's list, so start a fresh selection; other changes keep it.
      if (what.deckId !== undefined) setSelected(new Set());
      setUndo({ type: 'changed', cards: before, message: `${plural(before.length, 'card')} ${done}.` });
    });

  const toggle = (id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const pageSelected = shown.length > 0 && shown.every((c) => selected.has(c.id));
  const selectedHere = shown.filter((c) => selected.has(c.id)).length;

  if (deckId && data.data && !deck) {
    return (
      <div class="panel">
        That deck doesn't exist any more. <a href={href('/cards')}>Show all cards</a>
      </div>
    );
  }

  return (
    <>
      <div class="page-head">
        <h1>{deck ? deck.name : 'Cards'}</h1>
        <div class="row">
          <a class="button" href={href('/decks')}>
            Manage decks
          </a>
          {deck && (
            <a class="button" href={href(`/browse/${deck.id}`)}>
              <Icon name="cards" /> Flip through
            </a>
          )}
          <a class="button primary" href={href(deck ? `/add/deck/${deck.id}` : '/add')}>
            <Icon name="plus" /> Add card
          </a>
        </div>
      </div>

      <nav class="chips deck-tabs" aria-label="Decks">
        <a class="chip button" href={href('/cards')} aria-current={!deckId ? 'page' : undefined}>
          All <span class="count">{data.data?.cards.length ?? 0}</span>
        </a>
        {decks.map((d) => (
          <a
            key={d.id}
            class="chip button"
            href={href(`/cards/deck/${d.id}`)}
            aria-current={deckId === d.id ? 'page' : undefined}
          >
            {d.name} <span class="count">{counts.get(d.id) ?? 0}</span>
          </a>
        ))}
      </nav>

      <div class="panel toolbar">
        <input
          type="search"
          class="grow"
          placeholder="Search characters, pinyin, meaning, notes, or tags"
          aria-label="Search cards"
          value={query}
          maxLength={100}
          onInput={(e) => {
            setQuery(e.currentTarget.value);
          }}
        />
        <select
          aria-label="Words or sentences"
          value={kind}
          onChange={(e) => {
            const v = e.currentTarget.value;
            setKind(v === 'word' || v === 'sentence' ? v : 'all');
          }}
        >
          <option value="all">Words &amp; sentences</option>
          <option value="word">Words</option>
          <option value="sentence">Sentences</option>
        </select>
        <select
          aria-label="Number of characters"
          value={length}
          onChange={(e) => {
            const v = e.currentTarget.value;
            setLength(v === 'one' || v === 'many' ? v : 'any');
          }}
        >
          <option value="any">Any length</option>
          <option value="one">1 character</option>
          <option value="many">2+ characters</option>
        </select>
        <select
          aria-label="Sort"
          value={sort}
          onChange={(e) => {
            setSort(e.currentTarget.value as SortKey);
          }}
        >
          {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
            <option key={k} value={k}>
              {SORT_LABEL[k]}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={selecting}
          onClick={() => {
            setSelecting(!selecting);
            setSelected(new Set());
            setEditingId(null);
          }}
        >
          <Icon name="check" /> {selecting ? 'Done selecting' : 'Select'}
        </button>
      </div>

      {selecting && (
        <BulkBar
          count={selected.size}
          offPage={selected.size - selectedHere}
          matching={filtered.length}
          onPage={shown.length}
          paged={paging.pages > 1}
          allSelected={allSelected}
          pageSelected={pageSelected}
          decks={decks}
          onSelectAll={(on) => {
            setSelected(on ? new Set(filtered.map((c) => c.id)) : new Set());
          }}
          onSelectPage={(on) => {
            setSelected((prev) => {
              const next = new Set(prev);
              for (const c of shown) {
                if (on) next.add(c.id);
                else next.delete(c.id);
              }
              return next;
            });
          }}
          onChange={(what, done) => void change([...selected], what, done)}
          onDelete={() => void remove([...selected])}
        />
      )}

      {error && (
        <div class="notice error" role="alert">
          {problemText(error)}
          <ReportLink problem={error} />
        </div>
      )}

      <section class="panel stack" id="card-list">
        <Pager paging={paging} label="Card pages" />
        {shown.length === 0 ? (
          <p class="muted">
            {data.loading
              ? 'Loading…'
              : query
                ? 'No cards match your search.'
                : deck
                  ? 'This deck has no cards yet.'
                  : 'No cards yet.'}
          </p>
        ) : (
          <ul class="list card-list">
            {shown.map((c) =>
              editingId === c.id ? (
                <QuickEdit
                  key={c.id}
                  card={c}
                  decks={decks}
                  onCancel={() => {
                    setEditingId(null);
                  }}
                  onSaved={() => {
                    setEditingId(null);
                    data.reload();
                  }}
                  onDeckCreated={data.reload}
                />
              ) : (
                <li key={c.id} class={selected.has(c.id) ? 'selected' : undefined}>
                  {selecting && (
                    <input
                      type="checkbox"
                      class="row-check"
                      aria-label={`Select ${c.traditional}`}
                      checked={selected.has(c.id)}
                      onChange={(e) => {
                        toggle(c.id, e.currentTarget.checked);
                      }}
                    />
                  )}
                  <div class="grow">
                    <div class="row">
                      <Trad text={c.traditional} class="card-row-hanzi" />
                      {prefs.showSimplified && c.simplified !== c.traditional && (
                        <Simp text={c.simplified} class="muted" />
                      )}
                      <Pinyin text={c.pinyin} />
                      {!deckId && <span class="badge">{deckName.get(c.deckId) ?? 'Unknown deck'}</span>}
                    </div>
                    <div class="muted small truncate">{c.meaning}</div>
                  </div>
                  {!selecting && (
                    <>
                      <button
                        type="button"
                        class="icon-only"
                        aria-label={`Edit ${c.traditional}`}
                        onClick={() => {
                          setEditingId(c.id);
                        }}
                      >
                        <Icon name="edit" />
                      </button>
                      <button
                        type="button"
                        class="icon-only ghost danger"
                        aria-label={`Delete ${c.traditional}`}
                        onClick={() => void remove([c.id])}
                      >
                        <Icon name="trash" />
                      </button>
                    </>
                  )}
                </li>
              ),
            )}
          </ul>
        )}
        <Pager paging={paging} label="Card pages" bottom topId="card-list" />
      </section>
      <p class="small muted">
        {query.trim() || kind !== 'all' || length !== 'any' ? `${filtered.length} of ` : ''}
        {total} card{total === 1 ? '' : 's'}
      </p>

      {undo && (
        <div class="update-banner" role="status">
          <span>{undo.message}</span>
          <button type="button" class="primary" onClick={() => void restore(undo)}>
            Undo
          </button>
        </div>
      )}
    </>
  );
}

function BulkBar({
  count,
  offPage,
  matching,
  onPage,
  paged,
  allSelected,
  pageSelected,
  decks,
  onSelectAll,
  onSelectPage,
  onChange,
  onDelete,
}: {
  count: number;
  /** Selected cards that aren't on the page being shown. */
  offPage: number;
  /** How many cards match the current filters. */
  matching: number;
  /** How many cards are on the page being shown. */
  onPage: number;
  /** Whether the cards are split over more than one page. */
  paged: boolean;
  allSelected: boolean;
  pageSelected: boolean;
  decks: readonly Deck[];
  onSelectAll: (on: boolean) => void;
  onSelectPage: (on: boolean) => void;
  onChange: (change: CardBulkChange, done: string) => void;
  onDelete: () => void;
}) {
  const [target, setTarget] = useState('');
  const [tagText, setTagText] = useState('');
  const tags = cleanTags(tagText);
  const none = count === 0;
  return (
    <div class="panel bulk-bar stack" role="region" aria-label="Selected cards">
      <div class="toolbar">
        {paged ? (
          <>
            <label class="check">
              <input
                type="checkbox"
                checked={pageSelected}
                onChange={(e) => {
                  onSelectPage(e.currentTarget.checked);
                }}
              />
              Select all on this page ({onPage})
            </label>
            {!allSelected && (
              <button
                type="button"
                onClick={() => {
                  onSelectAll(true);
                }}
              >
                Select all {matching} cards
              </button>
            )}
          </>
        ) : (
          <label class="check">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => {
                onSelectAll(e.currentTarget.checked);
              }}
            />
            Select all {matching}
          </label>
        )}
        {count > 0 && (
          <button
            type="button"
            class="ghost"
            onClick={() => {
              onSelectAll(false);
            }}
          >
            Clear selection
          </button>
        )}
        <span class="muted" aria-hidden="true">
          ·
        </span>
        <strong>{count} selected</strong>
        {offPage > 0 && <span class="small muted">({offPage} not on this page)</span>}
      </div>
      <div class="toolbar">
        <span class="small muted bulk-label">Type</span>
        <button
          type="button"
          disabled={none}
          onClick={() => {
            onChange({ kind: 'word' }, 'set to word');
          }}
        >
          Make words
        </button>
        <button
          type="button"
          disabled={none}
          onClick={() => {
            onChange({ kind: 'sentence' }, 'set to sentence');
          }}
        >
          Make sentences
        </button>
      </div>
      <div class="toolbar">
        <span class="small muted bulk-label">Tags</span>
        <input
          type="text"
          class="grow"
          aria-label="Tags to add or remove"
          placeholder="lesson-3, food"
          value={tagText}
          onInput={(e) => {
            setTagText(e.currentTarget.value);
          }}
        />
        <button
          type="button"
          disabled={none || tags.length === 0}
          onClick={() => {
            onChange({ addTags: tags }, `tagged ${tags.join(', ')}`);
            setTagText('');
          }}
        >
          Add tag
        </button>
        <button
          type="button"
          disabled={none || tags.length === 0}
          onClick={() => {
            onChange({ removeTags: tags }, `untagged ${tags.join(', ')}`);
            setTagText('');
          }}
        >
          Remove tag
        </button>
      </div>
      <div class="toolbar">
        <span class="small muted bulk-label">Deck</span>
        <select
          aria-label="Move selected cards to deck"
          value={target}
          onChange={(e) => {
            setTarget(e.currentTarget.value);
          }}
        >
          <option value="">Move to deck…</option>
          {decks.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={none || !target}
          onClick={() => {
            const name = decks.find((d) => d.id === target)?.name ?? 'the deck';
            onChange({ deckId: target }, `moved to “${name}”`);
            setTarget('');
          }}
        >
          Move
        </button>
        <span class="grow" />
        <button type="button" class="danger" disabled={none} onClick={onDelete}>
          <Icon name="trash" /> Delete
        </button>
      </div>
    </div>
  );
}

/** Edits a card in place in the list. Enter saves, Escape cancels. */
function QuickEdit({
  card,
  decks,
  onCancel,
  onSaved,
  onDeckCreated,
}: {
  card: Card;
  decks: readonly Deck[];
  onCancel: () => void;
  onSaved: () => void;
  onDeckCreated: () => void;
}) {
  return (
    <li class="quick-edit">
      <CardEditForm
        card={card}
        decks={decks}
        onCancel={onCancel}
        onSaved={onSaved}
        onDeckCreated={onDeckCreated}
        footer={
          <a href={href(`/cards/${card.id}`)} class="small">
            Open full editor (auto-fill, audio)
          </a>
        }
      />
    </li>
  );
}
