import type { Card, CardField } from '../../core/db/model';
import { AudioButton, Pinyin, Simp, Trad } from '../../core/ui/chinese';
import { CardBreakdown, useWarmBreakdown } from './CardBreakdown';
import type { WordGloss } from '../../core/lang/autofill';

/** Sentences (and very long words) use a smaller size that wraps, so they fit on the card. */
const isLong = (card: Card) => card.kind === 'sentence' || [...card.traditional].length > 6;

/** `visible`: every field currently on screen (this side plus the front, once revealed). */
function FieldView({
  field,
  card,
  visible,
}: {
  field: CardField;
  card: Card;
  visible: readonly CardField[];
}) {
  switch (field) {
    case 'traditional':
      return <Trad text={card.traditional} class={`face-traditional${isLong(card) ? ' long' : ''}`} />;
    case 'simplified': {
      const withTrad = visible.includes('traditional');
      if (withTrad && card.simplified === card.traditional) return null;
      return (
        <div>
          {withTrad && <div class="face-label">Simplified</div>}
          <Simp
            text={card.simplified}
            class={`face-simplified${withTrad ? '' : ' primary'}${!withTrad && isLong(card) ? ' long' : ''}`}
          />
        </div>
      );
    }
    case 'pinyin':
      return <Pinyin text={card.pinyin} class="face-pinyin" />;
    case 'meaning':
      return <div class="face-meaning">{card.meaning}</div>;
    case 'audio':
      return <AudioButton text={card.simplified} />;
  }
}

/**
 * Renders one side of a flashcard with the given fields, in a fixed, readable order.
 * `alsoShown` lists fields already visible elsewhere on the card (the front, when
 * showing the back), so simplified characters only take the big size when the
 * traditional ones aren't on screen.
 */
export function CardSide({
  card,
  fields,
  alsoShown = [],
}: {
  card: Card;
  fields: readonly CardField[];
  alsoShown?: readonly CardField[];
}) {
  const visible = [...fields, ...alsoShown];
  const order: CardField[] = ['traditional', 'simplified', 'pinyin', 'audio', 'meaning'];
  return (
    <>
      {order
        .filter((f) => fields.includes(f))
        .map((f) => (
          <FieldView key={f} field={f} card={card} visible={visible} />
        ))}
    </>
  );
}

/**
 * A flashcard's contents: the front, and once turned over, the back with its notes and
 * the word-by-word meanings. Screen readers announce the front when a new card comes up
 * and the answer when it is shown, but not the word-by-word table, which would make
 * every answer very long to listen to; it can still be read like the rest of the page.
 * Both regions are always on the page, because a region that appears together with its
 * text is often not announced.
 */
export function CardFaces({
  card,
  front,
  back,
  shown,
  onAdd,
  refresh,
}: {
  card: Card;
  front: readonly CardField[];
  back: readonly CardField[];
  shown: boolean;
  /** "+ Add" on the word-by-word meanings (see CardBreakdown). */
  onAdd?: (part: WordGloss) => void;
  refresh?: number;
}) {
  useWarmBreakdown();
  return (
    <>
      <div class="card-region" aria-live="polite">
        <CardSide card={card} fields={front} />
      </div>
      <div class="card-region card-answer" aria-live="polite">
        {shown && (
          <>
            <hr />
            <CardSide card={card} fields={back} alsoShown={front} />
            {card.notes && <div class="muted small">{card.notes}</div>}
          </>
        )}
      </div>
      {shown && <CardBreakdown card={card} onAdd={onAdd} refresh={refresh} />}
    </>
  );
}
