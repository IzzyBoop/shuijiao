import { useState } from 'preact/hooks';
import { store } from '../../core/db/store';
import { andList } from '../../core/format';
import { CARD_FIELDS, FIELD_LABELS, LIMITS, newId, type CardField, type Template } from '../../core/db/model';
import { cleanText } from '../../core/safe/text';
import { updateStudyPrefs, useStudyPrefs } from '../../core/study-prefs';
import { Icon } from '../../core/ui/Icon';
import { errorMessage, useAsync } from '../../core/ui/useAsync';

/** The column headings, also read out for each choice by screen readers. */
const SIDE_LABELS = { front: 'Front', back: 'Back', none: 'Hidden' } as const;

const describe = (fields: readonly CardField[]) => andList(fields.map((f) => FIELD_LABELS[f]));

function TemplateBuilder({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState('');
  const [side, setSide] = useState<Record<CardField, 'front' | 'back' | 'none'>>({
    traditional: 'front',
    simplified: 'back',
    pinyin: 'back',
    meaning: 'back',
    audio: 'back',
  });
  const [error, setError] = useState<string | null>(null);
  const front = CARD_FIELDS.filter((f) => side[f] === 'front');
  const back = CARD_FIELDS.filter((f) => side[f] === 'back');
  const valid = cleanText(name, LIMITS.templateName) !== '' && front.length > 0 && back.length > 0;

  const save = async () => {
    const now = Date.now();
    const t: Template = {
      id: newId(),
      name: cleanText(name, LIMITS.templateName),
      front,
      back,
      builtin: false,
      createdAt: now,
      updatedAt: now,
      deleted: 0,
    };
    try {
      await store.saveTemplate(t);
      setName('');
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <section class="panel stack">
      <h2>Make your own card type</h2>
      {error && <div class="notice error">{error}</div>}
      <label class="field">
        <span class="field-label">Name</span>
        <input
          type="text"
          value={name}
          maxLength={LIMITS.templateName}
          placeholder="e.g. Hear it, write it"
          onInput={(e) => {
            setName(e.currentTarget.value);
          }}
        />
      </label>
      <table class="gloss-table">
        <thead>
          <tr>
            <td />
            <td>Front (question)</td>
            <td>Back (answer)</td>
            <td>Hidden</td>
          </tr>
        </thead>
        <tbody>
          {CARD_FIELDS.map((f) => (
            <tr key={f}>
              <td>{FIELD_LABELS[f]}</td>
              {(['front', 'back', 'none'] as const).map((s) => (
                <td key={s}>
                  <input
                    type="radio"
                    name={`side-${f}`}
                    aria-label={`${FIELD_LABELS[f]}: ${SIDE_LABELS[s]}`}
                    checked={side[f] === s}
                    onChange={() => {
                      setSide((prev) => ({ ...prev, [f]: s }));
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <button type="button" class="primary" disabled={!valid} onClick={() => void save()}>
          <Icon name="plus" /> Create card type
        </button>
      </div>
    </section>
  );
}

export function TemplatesPage() {
  const prefs = useStudyPrefs();
  const data = useAsync(() => store.listTemplates(), []);
  const active = new Set(prefs.activeTemplates);

  const toggle = (id: string, on: boolean) => {
    const next = new Set(active);
    if (on) next.add(id);
    else next.delete(id);
    if (next.size === 0) return;
    updateStudyPrefs({ activeTemplates: [...next] });
  };

  const remove = async (t: Template) => {
    if (!window.confirm(`Delete the card type “${t.name}”?`)) return;
    await store.deleteTemplate(t.id);
    toggle(t.id, false);
    data.reload();
  };

  return (
    <>
      <div class="page-head">
        <h1>Card types</h1>
      </div>
      <p class="muted">
        A card type decides what is on the front (what you're asked) and the back (the answer). Each type you
        switch on is studied separately for every card, so turning on two types doubles your reviews.
      </p>
      <section class="panel">
        <ul class="list">
          {(data.data ?? []).map((t) => (
            <li key={t.id}>
              <label class="check grow">
                <input
                  type="checkbox"
                  checked={active.has(t.id)}
                  disabled={active.has(t.id) && active.size === 1}
                  onChange={(e) => {
                    toggle(t.id, e.currentTarget.checked);
                  }}
                />
                <span>
                  <strong>{t.name}</strong>
                  <span class="small muted">
                    {' '}
                    · Front: {describe(t.front)} · Back: {describe(t.back)}
                  </span>
                </span>
              </label>
              {!t.builtin && (
                <button
                  type="button"
                  class="icon-only ghost danger"
                  aria-label={`Delete ${t.name}`}
                  onClick={() => void remove(t)}
                >
                  <Icon name="trash" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
      <TemplateBuilder onSaved={data.reload} />
    </>
  );
}
