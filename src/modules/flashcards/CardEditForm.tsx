import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { store } from '../../core/db/store';
import { LIMITS, type Card, type CardKind, type Deck } from '../../core/db/model';
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
}: {
  card: Card;
  decks: readonly Deck[];
  onCancel: () => void;
  onSaved: (card: Card) => void;
  /** Shown at the start of the button row (e.g. a link to the full editor). */
  footer?: ComponentChildren;
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
        <span>{footer}</span>
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
