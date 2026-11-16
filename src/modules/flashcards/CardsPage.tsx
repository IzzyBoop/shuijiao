import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { RouteProps } from '../../core/modules';
import { store } from '../../core/db/store';
import { LIMITS, type Card, type Deck } from '../../core/db/model';
import { href } from '../../core/router';
import { cleanTags, cleanText } from '../../core/safe/text';
import { Pinyin, Simp, Trad } from '../../core/ui/chinese';
import { Icon } from '../../core/ui/Icon';
import { errorMessage, useAsync } from '../../core/ui/useAsync';
import { useStudyPrefs } from '../../core/study-prefs';
import { rememberCardList } from './return-path';

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
const PAGE = 200;

const sorters: Record<SortKey, (a: Card, b: Card) => number> = {
  newest: (a, b) => b.createdAt - a.createdAt,
  oldest: (a, b) => a.createdAt - b.createdAt,
  pinyin: (a, b) => fold(a.pinyin).localeCompare(fold(b.pinyin)),
};

interface Undo {
  ids: string[];
  message: string;
}

export function CardsPage({ params }: RouteProps) {
  const deckId = params.deckId;
  const prefs = useStudyPrefs();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [limit, setLimit] = useState(PAGE);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<Undo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const data = useAsync(async () => {
    const [cards, decks] = await Promise.all([store.listCards(), store.listDecks()]);
    return { cards, decks };
  }, []);

  useEffect(() => {
    rememberCardList(deckId ? `/cards/deck/${deckId}` : '/cards');
    setSelected(new Set());
    setEditingId(null);
    setLimit(PAGE);
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
      .filter(
        (c) =>
          !q ||
          [c.traditional, c.simplified, c.pinyin, c.meaning, c.notes, c.tags.join(' ')].some((f) =>
            fold(f).includes(q),
          ),
      )
      .sort(sorters[sort]);
  }, [data.data, deckId, query, sort]);
  const shown = filtered.slice(0, limit);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    }
    data.reload();
  };

  const remove = (ids: string[]) =>
    run(async () => {
      await store.deleteCards(ids);
      setSelected(new Set());
      setEditingId(null);
      setUndo({ ids, message: ids.length === 1 ? 'Card deleted.' : `${ids.length} cards deleted.` });
    });

  const restore = (u: Undo) =>
    run(async () => {
      await store.restoreCards(u.ids);
      setUndo(null);
    });

  const move = (ids: string[], target: string) =>
    run(async () => {
      await store.moveCards(ids, target);
      setSelected(new Set());
    });

  const toggle = (id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const allShownSelected = shown.length > 0 && shown.every((c) => selected.has(c.id));

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
            setLimit(PAGE);
          }}
        />
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
          allSelected={allShownSelected}
          decks={decks}
          onSelectAll={(on) => {
            setSelected(on ? new Set(shown.map((c) => c.id)) : new Set());
          }}
          onMove={(target) => void move([...selected], target)}
          onDelete={() => void remove([...selected])}
        />
      )}

      {error && (
        <div class="notice error" role="alert">
          {error}
        </div>
      )}

      <section class="panel">
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
        {filtered.length > shown.length && (
          <div class="mt">
            <button
              type="button"
              onClick={() => {
                setLimit((l) => l + PAGE);
              }}
            >
              Show more ({filtered.length - shown.length} more)
            </button>
          </div>
        )}
      </section>
      <p class="small muted">
        {query.trim() ? `${filtered.length} of ` : ''}
        {deck ? (counts.get(deck.id) ?? 0) : (data.data?.cards.length ?? 0)} cards
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
  allSelected,
  decks,
  onSelectAll,
  onMove,
  onDelete,
}: {
  count: number;
  allSelected: boolean;
  decks: readonly Deck[];
  onSelectAll: (on: boolean) => void;
  onMove: (deckId: string) => void;
  onDelete: () => void;
}) {
  const [target, setTarget] = useState('');
  return (
    <div class="panel toolbar bulk-bar" role="region" aria-label="Selected cards">
      <label class="check">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={(e) => {
            onSelectAll(e.currentTarget.checked);
          }}
        />
        Select all shown
      </label>
      <strong>{count} selected</strong>
      <span class="grow" />
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
        disabled={count === 0 || !target}
        onClick={() => {
          onMove(target);
          setTarget('');
        }}
      >
        Move
      </button>
      <button type="button" class="danger" disabled={count === 0} onClick={onDelete}>
        <Icon name="trash" /> Delete
      </button>
    </div>
  );
}

const EDIT_FIELDS = [
  { key: 'traditional', label: 'Traditional', max: LIMITS.hanzi, lang: 'zh-Hant' },
  { key: 'simplified', label: 'Simplified', max: LIMITS.hanzi, lang: 'zh-Hans' },
  { key: 'pinyin', label: 'Pinyin', max: LIMITS.pinyin, lang: undefined },
  { key: 'meaning', label: 'Meaning', max: LIMITS.meaning, lang: undefined },
] as const;

type EditKey = (typeof EDIT_FIELDS)[number]['key'];

/** Edits a card in place in the list. Enter saves, Escape cancels. */
function QuickEdit({
  card,
  decks,
  onCancel,
  onSaved,
}: {
  card: Card;
  decks: readonly Deck[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<EditKey, string>>({
    traditional: card.traditional,
    simplified: card.simplified,
    pinyin: card.pinyin,
    meaning: card.meaning,
  });
  const [notes, setNotes] = useState(card.notes);
  const [tags, setTags] = useState(card.tags.join(', '));
  const [deckId, setDeckId] = useState(card.deckId);
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
  }, []);

  const save = async () => {
    const cleaned = {
      traditional: cleanText(values.traditional, LIMITS.hanzi),
      simplified: cleanText(values.simplified, LIMITS.hanzi),
      pinyin: cleanText(values.pinyin, LIMITS.pinyin),
      meaning: cleanText(values.meaning, LIMITS.meaning, true),
    };
    const missing = EDIT_FIELDS.find((f) => !cleaned[f.key]);
    if (missing) {
      setError(`${missing.label} can't be empty.`);
      return;
    }
    try {
      await store.saveCard({
        ...card,
        ...cleaned,
        notes: cleanText(notes, LIMITS.notes, true),
        tags: cleanTags(tags),
        deckId,
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <li class="quick-edit">
      <form
        class="full"
        aria-label={`Edit ${card.traditional}`}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
        }}
      >
        {error && (
          <div class="notice error" role="alert">
            {error}
          </div>
        )}
        <div class="grid">
          {EDIT_FIELDS.map((f, i) => (
            <label class="field" key={f.key}>
              <span class="field-label">{f.label}</span>
              <input
                type="text"
                ref={i === 0 ? first : null}
                lang={f.lang}
                maxLength={f.max}
                value={values[f.key]}
                onInput={(e) => {
                  const v = e.currentTarget.value;
                  setValues((prev) => ({ ...prev, [f.key]: v }));
                }}
              />
            </label>
          ))}
          <label class="field">
            <span class="field-label">Notes</span>
            <input
              type="text"
              maxLength={LIMITS.notes}
              value={notes}
              onInput={(e) => {
                setNotes(e.currentTarget.value);
              }}
            />
          </label>
          <label class="field">
            <span class="field-label">Tags</span>
            <input
              type="text"
              value={tags}
              onInput={(e) => {
                setTags(e.currentTarget.value);
              }}
            />
          </label>
          <label class="field">
            <span class="field-label">Deck</span>
            <select
              value={deckId}
              onChange={(e) => {
                setDeckId(e.currentTarget.value);
              }}
            >
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div class="row spread mt">
          <a href={href(`/cards/${card.id}`)} class="small">
            Open full editor (auto-fill, audio)
          </a>
          <div class="row">
            <button type="button" onClick={onCancel}>
              Cancel <span class="kbd">Esc</span>
            </button>
            <button type="submit" class="primary">
              <Icon name="check" /> Save <span class="kbd">Enter</span>
            </button>
          </div>
        </div>
      </form>
    </li>
  );
}
