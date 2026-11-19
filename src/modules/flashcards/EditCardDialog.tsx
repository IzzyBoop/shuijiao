import { store } from '../../core/db/store';
import { newId, type Card } from '../../core/db/model';
import type { WordGloss } from '../../core/lang/autofill';
import { Dialog } from '../../core/ui/Dialog';
import { useAsync } from '../../core/ui/useAsync';
import { CardEditForm } from './CardEditForm';

/** Edits a card in a popup over a study or flip-through session, without leaving it. */
export function EditCardDialog({
  card,
  onClose,
  onSaved,
}: {
  /** The card to edit; null when the dialog is closed. */
  card: Card | null;
  onClose: () => void;
  onSaved: (card: Card) => void;
}) {
  const decks = useAsync(() => store.listDecks(), []);
  return (
    <Dialog open={card !== null} title="Edit card" onClose={onClose} wide>
      {card && decks.data && (
        <CardEditForm
          key={card.id}
          card={card}
          decks={decks.data}
          onCancel={onClose}
          onSaved={(updated) => {
            onSaved(updated);
            onClose();
          }}
        />
      )}
    </Dialog>
  );
}

/**
 * Adds a word from the word-by-word meanings as a new card, in a popup over the session.
 * It starts filled in from the dictionary, in the same deck as the card it came from,
 * with a note saying where it came from.
 */
export function AddCardDialog({
  part,
  from,
  onClose,
  onSaved,
}: {
  /** The word to add; null when the dialog is closed. */
  part: WordGloss | null;
  /** The card being studied, which the word came from. */
  from: Card;
  onClose: () => void;
  onSaved: (card: Card) => void;
}) {
  const decks = useAsync(() => store.listDecks(), []);
  const now = Date.now();
  const card: Card | null = part && {
    id: newId(),
    deckId: from.deckId,
    kind: 'word',
    traditional: part.traditional,
    simplified: part.simplified,
    pinyin: part.pinyin,
    meaning: part.gloss,
    notes: from.traditional === part.traditional ? '' : `From: ${from.traditional}`,
    tags: [],
    createdAt: now,
    updatedAt: now,
    deleted: 0,
  };
  return (
    <Dialog open={part !== null} title="Add a card" onClose={onClose} wide>
      {card && decks.data && (
        <CardEditForm
          key={`${card.traditional}\t${card.pinyin}`}
          card={card}
          decks={decks.data}
          onCancel={onClose}
          onSaved={(saved) => {
            onSaved(saved);
            onClose();
          }}
        />
      )}
    </Dialog>
  );
}
