import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { RouteProps } from '../../core/modules';
import { store } from '../../core/db/store';
import { DEFAULT_DECK_ID } from '../../core/db/defaults';
import { LIMITS, newId, type Card, type CardKind } from '../../core/db/model';
import { href, navigate } from '../../core/router';
import { cleanTags, cleanText } from '../../core/safe/text';
import { AudioButton, Pinyin, Simp, Trad } from '../../core/ui/chinese';
import { Icon } from '../../core/ui/Icon';
import { errorMessage, useAsync } from '../../core/ui/useAsync';
import type { AutoFill } from '../../core/lang/autofill';
import { requestPersistentStorage } from '../../core/db/persist';
import { Dialog } from '../../core/ui/Dialog';
import { cardListPath } from './return-path';

type CheckedField = 'traditional' | 'simplified' | 'pinyin' | 'meaning';
const CHECKED: readonly CheckedField[] = ['traditional', 'simplified', 'pinyin', 'meaning'];
type Origin = 'auto' | 'edited' | 'saved';

interface Draft {
  kind: CardKind;
  deckId: string;
  traditional: string;
  simplified: string;
  pinyin: string;
  meaning: string;
  notes: string;
  tags: string;
}

const EMPTY: Draft = {
  kind: 'word',
  deckId: DEFAULT_DECK_ID,
  traditional: '',
  simplified: '',
  pinyin: '',
  meaning: '',
  notes: '',
  tags: '',
};

const MAX: Record<CheckedField, number> = {
  traditional: LIMITS.hanzi,
  simplified: LIMITS.hanzi,
  pinyin: LIMITS.pinyin,
  meaning: LIMITS.meaning,
};

// The language tools (OpenCC tables, pinyin data, dictionary) are large, so they load only here.
const loadAutofill = () => import('../../core/lang/autofill');

interface ConfirmFieldProps {
  id: CheckedField;
  label: string;
  value: string;
  origin: Origin | undefined;
  confirmed: boolean;
  multiline?: boolean | undefined;
  lang?: string | undefined;
  options?: readonly string[] | undefined;
  hint?: ComponentChildren | undefined;
  onChange: (value: string, origin: Origin) => void;
  onConfirm: (ok: boolean) => void;
}

function ConfirmField(p: ConfirmFieldProps) {
  const inputId = `field-${p.id}`;
  const common = {
    id: inputId,
    value: p.value,
    maxLength: MAX[p.id],
    lang: p.lang,
    autocomplete: 'off',
    spellcheck: false,
    onInput: (e: Event) => {
      p.onChange((e.currentTarget as HTMLInputElement | HTMLTextAreaElement).value, 'edited');
    },
  };
  return (
    <div class={`confirm-field${p.confirmed ? ' confirmed' : ''}`}>
      <div class="row spread">
        <label class="field-label" for={inputId}>
          {p.label}
          {p.origin === 'auto' && <span class="badge auto">auto-filled</span>}
          {p.origin === 'edited' && <span class="badge">edited</span>}
        </label>
        <label class="check small">
          <input
            type="checkbox"
            checked={p.confirmed}
            disabled={!p.value.trim()}
            onChange={(e) => {
              p.onConfirm(e.currentTarget.checked);
            }}
          />
          Looks right
        </label>
      </div>
      {p.multiline ? <textarea {...common} rows={2} /> : <input type="text" {...common} />}
      {p.options && p.options.length > 0 && (
        <div class="chips mt">
          <span class="small muted">Other options:</span>
          {p.options.map((o) => (
            <button
              key={o}
              type="button"
              class="chip"
              onClick={() => {
                p.onChange(o, 'edited');
              }}
            >
              {o}
            </button>
          ))}
        </div>
      )}
      {p.hint}
    </div>
  );
}

export function CardEditor({ params }: RouteProps) {
  const editingId = params.id;
  const presetDeck = params.deckId;
  const decks = useAsync(() => store.listDecks(), []);
  const deckName = (id: string) => decks.data?.find((d) => d.id === id)?.name ?? 'Unknown deck';
  const [input, setInput] = useState('');
  const [draft, setDraft] = useState<Draft>(presetDeck ? { ...EMPTY, deckId: presetDeck } : EMPTY);
  const [fill, setFill] = useState<AutoFill | null>(null);
  const [origin, setOrigin] = useState<Partial<Record<CheckedField, Origin>>>({});
  const [confirmed, setConfirmed] = useState<Set<CheckedField>>(new Set());
  const [phase, setPhase] = useState<'input' | 'loading' | 'review'>(editingId ? 'loading' : 'input');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<Card[]>([]);
  /** The card waiting on "You already have this card" (null when the dialog is closed). */
  const [pendingDuplicate, setPendingDuplicate] = useState<{ card: Card; matches: Card[] } | null>(null);
  const [existing, setExisting] = useState<Card | null>(null);

  // Edit mode: load the card; its fields count as already confirmed.
  useEffect(() => {
    if (!editingId) return;
    void store.getCard(editingId).then((card) => {
      if (!card) {
        setError('That card no longer exists.');
        setPhase('input');
        return;
      }
      setExisting(card);
      setDraft({
        kind: card.kind,
        deckId: card.deckId,
        traditional: card.traditional,
        simplified: card.simplified,
        pinyin: card.pinyin,
        meaning: card.meaning,
        notes: card.notes,
        tags: card.tags.join(', '),
      });
      setOrigin({ traditional: 'saved', simplified: 'saved', pinyin: 'saved', meaning: 'saved' });
      setConfirmed(new Set(CHECKED));
      setPhase('review');
    });
  }, [editingId]);

  // New cards start in "My cards" (or the deck you came from). If that deck no longer
  // exists, switch to one that does, so a card can never be saved into a deleted deck.
  useEffect(() => {
    const list = decks.data;
    const first = list?.[0];
    if (!list || !first || list.some((d) => d.id === draft.deckId)) return;
    setDraft((d) => ({ ...d, deckId: first.id }));
  }, [decks.data, draft.deckId]);

  // Warn about duplicates as soon as the characters are known (ignoring the card being edited).
  useEffect(() => {
    if (!draft.simplified.trim() && !draft.traditional.trim()) {
      setDuplicates([]);
      return;
    }
    let alive = true;
    void store.findDuplicates(draft.traditional, draft.simplified, editingId).then((found) => {
      if (alive) setDuplicates(found);
    });
    return () => {
      alive = false;
    };
  }, [draft.traditional, draft.simplified, editingId]);

  const lookUp = async () => {
    const text = cleanText(input, LIMITS.hanzi);
    setError(null);
    setSaved(null);
    if (!/\p{Script=Han}/u.test(text)) {
      setError('Type a word or sentence in Chinese characters.');
      return;
    }
    setPhase('loading');
    try {
      const { autofill } = await loadAutofill();
      const result = await autofill(text);
      setFill(result);
      setDraft((d) => ({
        ...d,
        kind: result.kind,
        traditional: result.traditional,
        simplified: result.simplified,
        pinyin: result.pinyin,
        meaning: result.meaning,
        notes: result.notes,
      }));
      setOrigin({
        traditional: 'auto',
        simplified: 'auto',
        pinyin: 'auto',
        ...(result.meaning ? { meaning: 'auto' } : {}),
      });
      setConfirmed(new Set());
      setPhase('review');
    } catch (err) {
      setError(`Auto-fill failed: ${errorMessage(err)} You can still fill in the fields yourself.`);
      setDraft((d) => ({ ...d, traditional: text, simplified: text }));
      setPhase('review');
    }
  };

  const setField = (f: CheckedField) => (value: string, o: Origin) => {
    setDraft((d) => ({ ...d, [f]: value }));
    setOrigin((prev) => ({ ...prev, [f]: o }));
    // Typing a value yourself counts as checking it; clearing it un-confirms.
    setConfirmed((prev) => {
      const next = new Set(prev);
      if (value.trim()) next.add(f);
      else next.delete(f);
      return next;
    });
  };
  const confirm = (f: CheckedField) => (ok: boolean) => {
    setConfirmed((prev) => {
      const next = new Set(prev);
      if (ok) next.add(f);
      else next.delete(f);
      return next;
    });
  };

  const allConfirmed = CHECKED.every((f) => confirmed.has(f) && draft[f].trim());

  const save = async (allowDuplicate = false) => {
    if (!allConfirmed) return;
    const now = Date.now();
    const card: Card = {
      id: existing?.id ?? newId(),
      deckId: draft.deckId,
      kind: draft.kind,
      traditional: cleanText(draft.traditional, LIMITS.hanzi),
      simplified: cleanText(draft.simplified, LIMITS.hanzi),
      pinyin: cleanText(draft.pinyin, LIMITS.pinyin),
      meaning: cleanText(draft.meaning, LIMITS.meaning, true),
      notes: cleanText(draft.notes, LIMITS.notes, true),
      tags: cleanTags(draft.tags),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      deleted: 0,
    };
    try {
      // Check again at save time, so the question is based on what is stored right now.
      const matches = allowDuplicate
        ? []
        : await store.findDuplicates(card.traditional, card.simplified, existing?.id);
      if (matches.length > 0) {
        setPendingDuplicate({ card, matches });
        return;
      }
      setPendingDuplicate(null);
      await store.saveCard(card);
      void requestPersistentStorage();
      if (existing) {
        navigate(cardListPath());
        return;
      }
      setSaved(card.traditional);
      setInput('');
      setFill(null);
      setDraft((d) => ({ ...EMPTY, deckId: d.deckId }));
      setOrigin({});
      setConfirmed(new Set());
      setPhase('input');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async () => {
    if (!existing || !window.confirm('Delete this card and its study history?')) return;
    await store.deleteCard(existing.id);
    navigate(cardListPath());
  };

  const deckSelect = (
    <label class="field">
      <span class="field-label">Deck</span>
      <select
        value={draft.deckId}
        onChange={(e) => {
          const deckId = e.currentTarget.value;
          setDraft((d) => ({ ...d, deckId }));
        }}
      >
        {(decks.data ?? []).map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      <div class="page-head">
        <h1>{editingId ? 'Edit card' : 'Add a card'}</h1>
        <a href={href(cardListPath())}>{editingId ? 'Back to cards' : 'All cards'}</a>
      </div>

      {saved && (
        <div class="notice ok" role="status">
          <Icon name="check" /> Saved <Trad text={saved} />. Add another below.
        </div>
      )}
      {error && (
        <div class="notice error" role="alert">
          {error}
        </div>
      )}

      {!editingId && (
        <form
          class="panel stack"
          onSubmit={(e) => {
            e.preventDefault();
            void lookUp();
          }}
        >
          <label class="field">
            <span class="field-label">Word or sentence in Chinese</span>
            <input
              type="text"
              class="big-input"
              lang="zh"
              value={input}
              maxLength={LIMITS.hanzi}
              placeholder="e.g. 銀行 or 我们去银行。"
              autocomplete="off"
              onInput={(e) => {
                setInput(e.currentTarget.value);
              }}
            />
          </label>
          <div class="row">
            <button type="submit" class="primary" disabled={!input.trim() || phase === 'loading'}>
              {phase === 'loading' ? 'Looking up…' : 'Fill in details'}
            </button>
            <span class="small muted">Traditional or simplified both work.</span>
          </div>
          {phase === 'loading' && (
            <p class="small muted">
              The first time, this downloads the dictionary (about 4 MB). After that it works offline.
            </p>
          )}
        </form>
      )}

      {phase === 'review' && (
        <section class="panel stack">
          <div class="row spread">
            <h2>Check each field</h2>
            <div class="segmented" role="group" aria-label="Card kind">
              {(['word', 'sentence'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={draft.kind === k}
                  onClick={() => {
                    setDraft((d) => ({ ...d, kind: k }));
                  }}
                >
                  {k === 'word' ? 'Word' : 'Sentence'}
                </button>
              ))}
            </div>
          </div>
          {duplicates.length > 0 && (
            <div class="notice warn" role="status">
              <Icon name="alert" />
              <span>
                <strong>
                  You already have {duplicates.length === 1 ? 'a card' : `${duplicates.length} cards`} for{' '}
                  <Trad text={draft.traditional || draft.simplified} />.
                </strong>{' '}
                {duplicates.length === 1 ? (
                  <a href={href(`/cards/${duplicates[0]?.id ?? ''}`)}>Open it</a>
                ) : (
                  <a href={href(`/cards`)}>See your cards</a>
                )}
                {editingId ? '' : ' instead, or continue if you want a second copy.'}
              </span>
            </div>
          )}
          {fill && !fill.inDictionary && fill.kind === 'word' && (
            <div class="notice warn">
              This exact word isn't in the dictionary, so please check every field carefully.
            </div>
          )}

          <ConfirmField
            id="traditional"
            label="Traditional"
            lang="zh-Hant"
            value={draft.traditional}
            origin={origin.traditional}
            confirmed={confirmed.has('traditional')}
            onChange={setField('traditional')}
            onConfirm={confirm('traditional')}
            hint={
              fill && fill.ambiguous.length > 0 ? (
                <AmbiguityHints fill={fill} draft={draft} onPick={setField('traditional')} />
              ) : undefined
            }
          />
          <ConfirmField
            id="simplified"
            label="Simplified"
            lang="zh-Hans"
            value={draft.simplified}
            origin={origin.simplified}
            confirmed={confirmed.has('simplified')}
            onChange={setField('simplified')}
            onConfirm={confirm('simplified')}
          />
          <ConfirmField
            id="pinyin"
            label="Pinyin"
            value={draft.pinyin}
            origin={origin.pinyin}
            confirmed={confirmed.has('pinyin')}
            options={fill?.pinyinOptions}
            onChange={setField('pinyin')}
            onConfirm={confirm('pinyin')}
            hint={
              <div class="row mt">
                <Pinyin text={draft.pinyin} />
                <AudioButton text={draft.simplified} label="Listen to check the pronunciation" />
              </div>
            }
          />
          <ConfirmField
            id="meaning"
            label="Meaning"
            multiline
            value={draft.meaning}
            origin={origin.meaning}
            confirmed={confirmed.has('meaning')}
            options={fill?.meaningOptions}
            onChange={setField('meaning')}
            onConfirm={confirm('meaning')}
            hint={fill && fill.wordGlosses.length > 0 ? <GlossHints fill={fill} /> : undefined}
          />

          <label class="field">
            <span class="field-label">
              Notes <span class="badge">optional</span>
            </span>
            <textarea
              value={draft.notes}
              maxLength={LIMITS.notes}
              rows={2}
              onInput={(e) => {
                const notes = e.currentTarget.value;
                setDraft((d) => ({ ...d, notes }));
              }}
            />
          </label>
          <div class="grid">
            {deckSelect}
            <label class="field">
              <span class="field-label">
                Tags <span class="badge">optional</span>
              </span>
              <input
                type="text"
                value={draft.tags}
                placeholder="lesson-3, food"
                maxLength={LIMITS.tag * LIMITS.tags}
                onInput={(e) => {
                  const tags = e.currentTarget.value;
                  setDraft((d) => ({ ...d, tags }));
                }}
              />
            </label>
          </div>

          <div class="row spread">
            <span class="small muted">
              {allConfirmed
                ? 'All fields checked.'
                : `Tick “Looks right” on each field (${confirmed.size}/4).`}
            </span>
            <div class="row">
              {existing && (
                <button type="button" class="danger" onClick={() => void remove()}>
                  <Icon name="trash" /> Delete
                </button>
              )}
              <button type="button" class="primary" disabled={!allConfirmed} onClick={() => void save()}>
                <Icon name="check" /> {existing ? 'Save changes' : 'Save card'}
              </button>
            </div>
          </div>
        </section>
      )}

      <Dialog
        open={pendingDuplicate !== null}
        title={existing ? 'Another card has these characters' : 'You already have this card'}
        onClose={() => {
          setPendingDuplicate(null);
        }}
        actions={
          <>
            <button
              type="button"
              class="primary"
              autofocus
              onClick={() => {
                setPendingDuplicate(null);
              }}
            >
              {existing ? 'Keep editing' : 'Don’t add'}
            </button>
            <button
              type="button"
              onClick={() => {
                const first = pendingDuplicate?.matches[0];
                setPendingDuplicate(null);
                if (first) navigate(`/cards/${first.id}`);
              }}
            >
              Open existing card
            </button>
            <button type="button" class="danger" onClick={() => void save(true)}>
              {existing ? 'Save anyway' : 'Add anyway'}
            </button>
          </>
        }
      >
        <p>
          {pendingDuplicate && pendingDuplicate.matches.length > 1
            ? `You already have ${pendingDuplicate.matches.length} cards with these characters:`
            : 'You already have a card with these characters:'}
        </p>
        <ul class="duplicate-list">
          {pendingDuplicate?.matches.map((c) => (
            <li key={c.id}>
              <Trad text={c.traditional} class="card-row-hanzi" />
              {c.simplified !== c.traditional && <Simp text={c.simplified} class="muted" />}
              <Pinyin text={c.pinyin} />
              <span class="badge">{deckName(c.deckId)}</span>
              <span class="small muted full truncate">{c.meaning}</span>
            </li>
          ))}
        </ul>
        <p class="small muted">
          {existing
            ? 'Saving anyway leaves you with two cards for the same characters, studied separately.'
            : 'Adding it anyway gives you a second card that is studied separately.'}
        </p>
      </Dialog>
    </>
  );
}

function AmbiguityHints({
  fill,
  draft,
  onPick,
}: {
  fill: AutoFill;
  draft: Draft;
  onPick: (value: string, origin: Origin) => void;
}) {
  const [tools, setTools] = useState<typeof import('../../core/lang/autofill') | null>(null);
  useEffect(() => {
    void loadAutofill().then(setTools);
  }, []);
  return (
    <div class="notice warn mt">
      <div class="stack full">
        <span class="small">
          Some simplified characters have more than one traditional form. Check these:
        </span>
        {fill.ambiguous.map((a) => (
          <div key={a.index} class="chips">
            <Simp text={a.simplified} /> →
            {a.options.map((o) => {
              const current = [...draft.traditional]
                .slice(a.index, a.index + [...a.simplified].length)
                .join('');
              return (
                <button
                  key={o.traditional}
                  type="button"
                  class="chip"
                  aria-pressed={current === o.traditional}
                  disabled={!tools}
                  onClick={() => {
                    if (tools) {
                      onPick(
                        tools.replaceSegment(
                          draft.traditional,
                          a.index,
                          [...a.simplified].length,
                          o.traditional,
                        ),
                        'edited',
                      );
                    }
                  }}
                >
                  <Trad text={o.traditional} /> <span class="muted">{o.gloss}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function GlossHints({ fill }: { fill: AutoFill }) {
  return (
    <details class="mt" open={fill.kind === 'sentence'}>
      <summary class="small">Word-by-word dictionary hints</summary>
      <table class="gloss-table">
        <tbody>
          {fill.wordGlosses.map((g, i) => (
            <tr key={i}>
              <td>
                <Trad text={g.traditional} />
              </td>
              <td>
                <Pinyin text={g.pinyin} />
              </td>
              <td>{g.gloss}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {fill.kind === 'sentence' && (
        <p class="small muted">Write the sentence's meaning in your own words above.</p>
      )}
    </details>
  );
}
