import { store } from '../../core/db/store';
import type { Card } from '../../core/db/model';
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
