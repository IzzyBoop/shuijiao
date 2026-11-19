import { useEffect, useRef, useState } from 'preact/hooks';
import type { RouteProps } from '../../core/modules';
import { store } from '../../core/db/store';
import { href } from '../../core/router';
import { Icon } from '../../core/ui/Icon';
import { useAsync } from '../../core/ui/useAsync';
import type { Card } from '../../core/db/model';
import { useKeydown } from '../../core/ui/useKeydown';
import { CardFaces } from './CardFace';
import { hasTagSlug, tagForSlug } from '../../core/tags';
import { AddCardDialog, EditCardDialog } from './EditCardDialog';
import type { WordGloss } from '../../core/lang/autofill';
import { LoadError } from '../../core/ui/LoadError';

function shuffled<T>(list: readonly T[]): T[] {
  // Sort by random keys: simple, unbiased enough for flashcards, no index juggling.
  const keys = crypto.getRandomValues(new Uint32Array(list.length));
  return list
    .map((item, i) => ({ item, key: keys[i] ?? 0 }))
    .sort((x, y) => x.key - y.key)
    .map((x) => x.item);
}

/** Free flip-through of a deck. Does not affect scheduling. */
export function BrowsePage({ params }: RouteProps) {
  const deckId = params.deckId;
  const tagSlug = params.tag;
  const data = useAsync(async () => {
    const all = await store.listCards(deckId);
    return {
      cards: tagSlug ? all.filter((c) => hasTagSlug(c.tags, tagSlug)) : all,
      templates: await store.listTemplates(),
      deck: deckId ? (await store.listDecks()).find((d) => d.id === deckId) : undefined,
      tag: tagSlug ? tagForSlug(all, tagSlug) : undefined,
    };
  }, [deckId, tagSlug]);
  const [order, setOrder] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState<WordGloss | null>(null);
  const [added, setAdded] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const [templateId, setTemplateId] = useState('tpl-reading');

  useEffect(() => {
    if (data.data) setOrder(data.data.cards);
  }, [data.data]);

  const card = order[index];
  const template = data.data?.templates.find((t) => t.id === templateId) ?? data.data?.templates[0];

  const go = (delta: number) => {
    if (order.length === 0) return;
    setIndex((i) => (i + delta + order.length) % order.length);
    setFlipped(false);
  };

  // Keep focus on the card so Space flips once (a focused Flip button would also be
  // "clicked" by the key-up and flip it straight back).
  useEffect(() => {
    if (!editing && !adding) cardRef.current?.focus({ preventScroll: true });
  }, [index, flipped, editing, adding]);

  useKeydown((e) => {
    // While the edit popup is open, keys belong to it.
    if (editing || adding) return;
    if (
      e.target instanceof HTMLSelectElement ||
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }
    if (e.key === 'e' && !e.metaKey && !e.ctrlKey && !e.altKey && card) {
      e.preventDefault();
      setEditing(true);
      return;
    }
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setFlipped((f) => !f);
    }
  });

  if (data.error) return <LoadError error={data.error} retry={data.reload} />;
  if (!data.data || !template) return <p class="muted">Loading…</p>;

  return (
    <>
      <div class="page-head">
        <h1>
          Flip through
          {data.data.deck ? `: ${data.data.deck.name}` : data.data.tag ? `: #${data.data.tag}` : ''}
        </h1>
        <div class="row">
          <select
            aria-label="Card type"
            value={template.id}
            onChange={(e) => {
              setTemplateId(e.currentTarget.value);
              setFlipped(false);
            }}
          >
            {data.data.templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setOrder(shuffled(order));
              setIndex(0);
              setFlipped(false);
            }}
          >
            <Icon name="shuffle" /> Shuffle
          </button>
          {card && (
            <button
              type="button"
              onClick={() => {
                setEditing(true);
              }}
            >
              <Icon name="edit" /> Edit card <span class="kbd">E</span>
            </button>
          )}
        </div>
      </div>
      {!card ? (
        <div class="panel">
          No cards yet. <a href={href('/add')}>Add some</a>.
        </div>
      ) : (
        <>
          <div class="flashcard" tabIndex={-1} ref={cardRef}>
            {/* Like study mode: the front stays put and the back appears underneath. */}
            <CardFaces
              card={card}
              front={template.front}
              back={template.back}
              shown={flipped}
              onAdd={setAdding}
              refresh={added}
            />
          </div>
          <div class="flip-controls mt">
            <button
              type="button"
              aria-label="Previous card"
              onClick={() => {
                go(-1);
              }}
            >
              ← <span class="flip-label">Previous</span>
            </button>
            <button
              type="button"
              class="primary"
              onClick={() => {
                setFlipped((f) => !f);
              }}
            >
              {flipped ? 'Hide answer' : 'Show answer'} <span class="kbd">Space</span>
            </button>
            <button
              type="button"
              aria-label="Next card"
              onClick={() => {
                go(1);
              }}
            >
              <span class="flip-label">Next</span> →
            </button>
          </div>
          <p class="muted small center mt">
            Card {index + 1} of {order.length} · ← → to move · E to edit
          </p>
        </>
      )}
      {card && (
        <AddCardDialog
          part={adding}
          from={card}
          onClose={() => {
            setAdding(null);
          }}
          onSaved={() => {
            setAdded((n) => n + 1);
          }}
        />
      )}
      <EditCardDialog
        card={editing && card ? card : null}
        onClose={() => {
          setEditing(false);
        }}
        onSaved={(updated) => {
          setOrder((o) => o.map((c) => (c.id === updated.id ? updated : c)));
        }}
      />
    </>
  );
}
