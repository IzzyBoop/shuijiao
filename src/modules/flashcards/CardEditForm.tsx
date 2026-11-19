import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { store } from '../../core/db/store';
import { deckNameKey, LIMITS, newId, type Card, type CardKind, type Deck } from '../../core/db/model';
import { cleanTags, cleanText } from '../../core/safe/text';
import { Icon } from '../../core/ui/Icon';
import { errorMessage } from '../../core/ui/useAsync';

const EDIT_FIELDS = [
  { key: 'traditional', label: 'Traditional', max: LIMITS.hanzi, lang: 'zh-Hant' },
  { key: 'simplified', label: 'Simplified', max: LIMITS.hanzi, lang: 'zh-Hans' },
  { key: 'pinyin', label: 'Pinyin', max: LIMITS.pinyin, lang: undefined },
  { key: 'meaning', label: 'Meaning', max: LIMITS.meaning, lang: undefined },
] as const;

type EditKey = (typeof EDIT_FIELDS)[number]['key'];

/** The deck dropdown's last option, which opens a name box instead of choosing a deck. */
const NEW_DECK = ':new-deck'; // deck ids never contain ":" (ID_PATTERN)

/**
 * The quick card editor shared by the Cards list, Study, and Flip through.
 * Enter saves, Escape cancels. `onSaved` receives the card as saved.
 */
export function CardEditForm({
  card,
  decks,
  onCancel,
  onSaved,
  footer,
  onOpenFullEditor,
}: {
  card: Card;
  decks: readonly Deck[];
  onCancel: () => void;
  onSaved: (card: Card) => void;
  /** Shown at the start of the button row (e.g. a link to the full editor). */
  footer?: ComponentChildren;
  /** Offers "Open full editor", handing over the card as it is in the form (not saved). */
  onOpenFullEditor?: (draft: Card) => void;
}) {
  // Decks made here are added straight away, before the caller's list catches up.
  const [created, setCreated] = useState<Deck[]>([]);
  const deckList = [...decks, ...created.filter((c) => !decks.some((d) => d.id === c.id))].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  /** The name being typed for a new deck; null when the deck dropdown is showing. */
  const [newDeck, setNewDeck] = useState<string | null>(null);
  const newDeckInput = useRef<HTMLInputElement>(null);
  const newDeckId = useId();
  useEffect(() => {
    if (newDeck !== null) newDeckInput.current?.focus();
  }, [newDeck === null]);

  /** Creates the deck and picks it (or picks an existing deck with that name). */
  const createDeck = async () => {
    const name = cleanText(newDeck ?? '', LIMITS.deckName);
    if (!name) return;
    const same = deckList.find((d) => deckNameKey(d.name) === deckNameKey(name));
    if (same) {
      setDeckId(same.id);
      setNewDeck(null);
      return;
    }
    const now = Date.now();
    const deck: Deck = { id: newId(), name, createdAt: now, updatedAt: now, deleted: 0 };
    try {
      await store.saveDeck(deck);
      setCreated((c) => [...c, deck]);
      setDeckId(deck.id);
      setNewDeck(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const [values, setValues] = useState<Record<EditKey, string>>({
    traditional: card.traditional,
    simplified: card.simplified,
    pinyin: card.pinyin,
    meaning: card.meaning,
  });
  const [notes, setNotes] = useState(card.notes);
  const [tags, setTags] = useState(card.tags.join(', '));
  const [deckId, setDeckId] = useState(card.deckId);
  const [kind, setKind] = useState<CardKind>(card.kind);
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
    const updated: Card = {
      ...card,
      ...cleaned,
      notes: cleanText(notes, LIMITS.notes, true),
      tags: cleanTags(tags),
      deckId,
      kind,
      updatedAt: Date.now(),
    };
    try {
      await store.saveCard(updated);
      onSaved(updated);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
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
          <span class="field-label">Word or sentence</span>
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.currentTarget.value === 'sentence' ? 'sentence' : 'word');
            }}
          >
            <option value="word">Word</option>
            <option value="sentence">Sentence</option>
          </select>
        </label>
        {newDeck === null ? (
          <label class="field">
            <span class="field-label">Deck</span>
            <select
              value={deckId}
              onChange={(e) => {
                const value = e.currentTarget.value;
                if (value === NEW_DECK) {
                  e.currentTarget.value = deckId; // stay on the current deck until one is created
                  setNewDeck('');
                } else {
                  setDeckId(value);
                }
              }}
            >
              {deckList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
              <option value={NEW_DECK}>＋ New deck…</option>
            </select>
          </label>
        ) : (
          <div class="field">
            <label class="field-label" for={newDeckId}>
              New deck
            </label>
            <div class="row">
              <input
                id={newDeckId}
                type="text"
                class="grow"
                placeholder="e.g. Lesson 4"
                maxLength={LIMITS.deckName}
                value={newDeck}
                ref={newDeckInput}
                onInput={(e) => {
                  setNewDeck(e.currentTarget.value);
                }}
                onKeyDown={(e) => {
                  // Enter creates the deck (not the card); Escape closes just this.
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void createDeck();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    setNewDeck(null);
                  }
                }}
              />
              <button type="button" disabled={!newDeck.trim()} onClick={() => void createDeck()}>
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewDeck(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      <div class="row spread mt">
        <span class="row">
          {footer}
          {onOpenFullEditor && (
            <button
              type="button"
              class="ghost"
              onClick={() => {
                onOpenFullEditor({
                  ...card,
                  ...values,
                  notes,
                  tags: cleanTags(tags),
                  deckId,
                  kind,
                });
              }}
            >
              Open full editor
            </button>
          )}
        </span>
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
  );
}
