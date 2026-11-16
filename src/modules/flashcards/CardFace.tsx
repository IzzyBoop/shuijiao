import type { Card, CardField } from '../../core/db/model';
import { AudioButton, Pinyin, Simp, Trad } from '../../core/ui/chinese';

function FieldView({ field, card, fields }: { field: CardField; card: Card; fields: readonly CardField[] }) {
  switch (field) {
    case 'traditional':
      return (
        <Trad
          text={card.traditional}
          class={`face-traditional${[...card.traditional].length > 6 ? ' long' : ''}`}
        />
      );
    case 'simplified': {
      const withTrad = fields.includes('traditional');
      if (withTrad && card.simplified === card.traditional) return null;
      return (
        <div>
          {withTrad && <div class="face-label">Simplified</div>}
          <Simp text={card.simplified} class={`face-simplified${withTrad ? '' : ' primary'}`} />
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

/** Renders one side of a flashcard with the given fields, in a fixed, readable order. */
export function CardSide({ card, fields }: { card: Card; fields: readonly CardField[] }) {
  const order: CardField[] = ['traditional', 'simplified', 'pinyin', 'audio', 'meaning'];
  return (
    <>
      {order
        .filter((f) => fields.includes(f))
        .map((f) => (
          <FieldView key={f} field={f} card={card} fields={fields} />
        ))}
    </>
  );
}
