import { useMemo, useState } from 'preact/hooks';
import {
  store,
  type DuplicateChoice,
  type ImportDeckMode,
  type ImportDuplicate,
  type ImportOptions,
  type ImportPreview,
} from '../../core/db/store';
import type { Card } from '../../core/db/model';
import { andList } from '../../core/format';
import { href } from '../../core/router';
import { Pinyin, Simp, Trad } from '../../core/ui/chinese';
import { Icon } from '../../core/ui/Icon';
import { errorMessage, useAsync } from '../../core/ui/useAsync';
import { clearPendingImport, getPendingImport, type PendingImport } from './pending-import';

const PAGE_SIZE = 20;
type DuplicateMode = DuplicateChoice | 'choose';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function ImportPage() {
  const pending = getPendingImport();
  const [done, setDone] = useState<ImportPreview | null>(null);

  if (done) return <ImportDone result={done} />;
  if (!pending) {
    return (
      <section class="panel stack">
        <h1>Import a backup</h1>
        <p>There's no backup waiting to be imported.</p>
        <p>
          <a class="button primary" href={href('/settings')}>
            Choose a backup file in Settings
          </a>
        </p>
      </section>
    );
  }
  return <ImportFlow pending={pending} onDone={setDone} />;
}

function ImportDone({ result }: { result: ImportPreview }) {
  const parts = [plural(result.cards.added, 'new card'), `${result.cards.updated} updated`];
  if (result.duplicatesReplaced > 0) parts.push(`${result.duplicatesReplaced} replaced`);
  if (result.duplicatesKeptOld > 0) parts.push(`${plural(result.duplicatesKeptOld, 'duplicate')} skipped`);
  return (
    <section class="panel stack">
      <h1>Import complete</h1>
      <div class="notice ok" role="status">
        <Icon name="check" /> Imported: {andList(parts)}.
      </div>
      <div class="row">
        <a class="button primary" href={href('/cards')}>
          Go to your cards
        </a>
        <a class="button" href={href('/settings')}>
          Back to Settings
        </a>
      </div>
    </section>
  );
}

function ImportFlow({ pending, onDone }: { pending: PendingImport; onDone: (r: ImportPreview) => void }) {
  const { backup, fileName } = pending;
  const [deckMode, setDeckMode] = useState<ImportDeckMode>('keep');
  const [dupMode, setDupMode] = useState<DuplicateMode>('old');
  const [choices, setChoices] = useState<Record<string, DuplicateChoice>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const duplicates = useAsync(() => store.findImportDuplicates(backup), [backup]);
  const decks = useAsync(() => store.listDecks(), []);
  const dups = duplicates.data ?? [];

  const options: ImportOptions = useMemo(
    () => ({
      deckMode,
      duplicates: dupMode === 'choose' ? { default: 'old', choices } : { default: dupMode },
    }),
    [deckMode, dupMode, choices],
  );
  const preview = useAsync(() => store.previewImport(backup, options), [backup, options]);

  const localDeckName = (id: string) => decks.data?.find((d) => d.id === id)?.name ?? 'Unknown deck';
  const fileDeckNames = useMemo(() => new Map(backup.decks.map((d) => [d.id, d.name])), [backup]);
  const incomingDeckName = (card: Card) =>
    deckMode === 'my-cards' ? 'My cards' : (fileDeckNames.get(card.deckId) ?? 'My cards');

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await store.applyImport(backup, options);
      clearPendingImport();
      onDone(result);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const cancel = () => {
    clearPendingImport();
    window.location.hash = '#/settings';
  };

  const p = preview.data;

  return (
    <>
      <div class="page-head">
        <h1>Import a backup</h1>
        <span class="badge truncate">{fileName}</span>
      </div>

      {error && (
        <div class="notice error" role="alert">
          {error}
        </div>
      )}

      <section class="panel stack">
        <h2>1. Which decks should the cards go into?</h2>
        <fieldset class="choice-group">
          <legend class="sr-only">Decks for imported cards</legend>
          <label class="check">
            <input
              type="radio"
              name="import-decks"
              checked={deckMode === 'keep'}
              onChange={() => {
                setDeckMode('keep');
              }}
            />
            <span>
              The decks they were in <span class="muted small">(missing decks are created)</span>
            </span>
          </label>
          <label class="check">
            <input
              type="radio"
              name="import-decks"
              checked={deckMode === 'my-cards'}
              onChange={() => {
                setDeckMode('my-cards');
              }}
            />
            <span>
              All into “My cards” <span class="muted small">(created if you don’t have it)</span>
            </span>
          </label>
        </fieldset>
        {p && (
          <p class="small">
            {p.decksCreated.length > 0
              ? `This creates ${p.decksCreated.length === 1 ? 'a deck' : 'decks'}: ${andList(p.decksCreated.map((n) => `“${n}”`))}.`
              : 'No new decks are created.'}
          </p>
        )}
      </section>

      {dups.length > 0 && (
        <section class="panel stack">
          <h2>2. Cards you already have</h2>
          <p>
            {dups.length === 1 ? '1 card in this backup has' : `${dups.length} cards in this backup have`} the
            same characters as {dups.length === 1 ? 'a card' : 'cards'} you already have. What should happen?
          </p>
          <fieldset class="choice-group">
            <legend class="sr-only">Duplicate cards</legend>
            <label class="check">
              <input
                type="radio"
                name="import-dups"
                checked={dupMode === 'old'}
                onChange={() => {
                  setDupMode('old');
                }}
              />
              <span>
                Keep old <span class="muted small">(keep your cards; skip these from the backup)</span>
              </span>
            </label>
            <label class="check">
              <input
                type="radio"
                name="import-dups"
                checked={dupMode === 'new'}
                onChange={() => {
                  setDupMode('new');
                }}
              />
              <span>
                Keep new <span class="muted small">(replace your cards with the ones from the backup)</span>
              </span>
            </label>
            <label class="check">
              <input
                type="radio"
                name="import-dups"
                checked={dupMode === 'choose'}
                onChange={() => {
                  setDupMode('choose');
                }}
              />
              <span>Choose for each card</span>
            </label>
          </fieldset>
          {dupMode === 'new' && (
            <p class="small muted">Replaced cards are deleted along with their study history.</p>
          )}
          {dupMode === 'choose' && (
            <DuplicateChooser
              duplicates={dups}
              choices={choices}
              onChange={setChoices}
              localDeckName={localDeckName}
              incomingDeckName={incomingDeckName}
            />
          )}
        </section>
      )}

      <section class="panel stack">
        <h2>{dups.length > 0 ? '3. Import' : '2. Import'}</h2>
        {p ? <ImportSummary preview={p} /> : <p class="muted">Working out what will change…</p>}
        <p class="small muted">Where the same card changed in both places, the newer copy is kept.</p>
        <div class="row">
          <button type="button" class="primary" disabled={busy || !p} onClick={() => void run()}>
            Import
          </button>
          <button type="button" onClick={cancel}>
            Cancel
          </button>
        </div>
      </section>
    </>
  );
}

function ImportSummary({ preview }: { preview: ImportPreview }) {
  const rows: [
    string,
    keyof Pick<ImportPreview, 'decks' | 'cards' | 'templates' | 'reviewStates' | 'reviewLogs' | 'links'>,
  ][] = [
    ['Decks', 'decks'],
    ['Cards', 'cards'],
    ['Card types', 'templates'],
    ['Study progress', 'reviewStates'],
    ['Review history', 'reviewLogs'],
    ['My links', 'links'],
  ];
  return (
    <>
      <table class="gloss-table">
        <thead>
          <tr>
            <td />
            <td>New</td>
            <td>Updated</td>
            <td>Unchanged</td>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, key]) => (
            <tr key={key}>
              <td>{label}</td>
              <td>{preview[key].added}</td>
              <td>{preview[key].updated}</td>
              <td>{preview[key].skipped}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(preview.duplicatesKeptOld > 0 || preview.duplicatesReplaced > 0) && (
        <p class="small">
          Duplicates: {preview.duplicatesKeptOld} kept as you have them, {preview.duplicatesReplaced} replaced
          by the backup’s version.
        </p>
      )}
      {preview.orphans > 0 && (
        <p class="small muted">{preview.orphans} records refer to missing cards and will be skipped.</p>
      )}
    </>
  );
}

function CardSummary({ card, deck }: { card: Card; deck: string }) {
  return (
    <div class="stack-tight">
      <div class="row">
        <Trad text={card.traditional} class="card-row-hanzi" />
        {card.simplified !== card.traditional && <Simp text={card.simplified} class="muted" />}
        <Pinyin text={card.pinyin} />
      </div>
      <div class="small">{card.meaning}</div>
      {card.notes && <div class="small muted">{card.notes}</div>}
      <div class="row small muted">
        <span class="badge">{deck}</span>
        <span>Changed {new Date(card.updatedAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

/** Old and new cards side by side, a page at a time, each with Keep old / Keep new. */
function DuplicateChooser({
  duplicates,
  choices,
  onChange,
  localDeckName,
  incomingDeckName,
}: {
  duplicates: readonly ImportDuplicate[];
  choices: Readonly<Record<string, DuplicateChoice>>;
  onChange: (next: Record<string, DuplicateChoice>) => void;
  localDeckName: (id: string) => string;
  incomingDeckName: (card: Card) => string;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(duplicates.length / PAGE_SIZE));
  const shown = duplicates.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const choiceOf = (id: string): DuplicateChoice => choices[id] ?? 'old';
  const newCount = duplicates.filter((d) => choiceOf(d.incoming.id) === 'new').length;

  const setAll = (choice: DuplicateChoice) => {
    onChange(Object.fromEntries(duplicates.map((d) => [d.incoming.id, choice])));
  };
  const set = (id: string, choice: DuplicateChoice) => {
    onChange({ ...choices, [id]: choice });
  };

  const pager = pages > 1 && (
    <nav class="row spread" aria-label="Duplicate pages">
      <button
        type="button"
        disabled={page === 0}
        onClick={() => {
          setPage(page - 1);
        }}
      >
        ← Previous
      </button>
      <span class="small muted">
        Page {page + 1} of {pages}
      </span>
      <button
        type="button"
        disabled={page >= pages - 1}
        onClick={() => {
          setPage(page + 1);
        }}
      >
        Next →
      </button>
    </nav>
  );

  return (
    <div class="stack">
      <div class="row spread">
        <span class="small">
          Keeping {duplicates.length - newCount} old · {newCount} new
        </span>
        <span class="row">
          <button
            type="button"
            onClick={() => {
              setAll('old');
            }}
          >
            Keep old for all
          </button>
          <button
            type="button"
            onClick={() => {
              setAll('new');
            }}
          >
            Keep new for all
          </button>
        </span>
      </div>
      {pager}
      <ul class="dup-pairs">
        {shown.map(({ incoming, existing }) => {
          const choice = choiceOf(incoming.id);
          return (
            <li key={incoming.id} class="dup-pair" aria-label={`Duplicate: ${incoming.traditional}`}>
              <div class={`dup-card${choice === 'old' ? ' chosen' : ''}`}>
                <div class="dup-label">You have</div>
                {existing.map((card) => (
                  <CardSummary key={card.id} card={card} deck={localDeckName(card.deckId)} />
                ))}
                <button
                  type="button"
                  aria-pressed={choice === 'old'}
                  onClick={() => {
                    set(incoming.id, 'old');
                  }}
                >
                  {choice === 'old' && <Icon name="check" />} Keep old
                </button>
              </div>
              <div class={`dup-card${choice === 'new' ? ' chosen' : ''}`}>
                <div class="dup-label">In the backup</div>
                <CardSummary card={incoming} deck={incomingDeckName(incoming)} />
                <button
                  type="button"
                  aria-pressed={choice === 'new'}
                  onClick={() => {
                    set(incoming.id, 'new');
                  }}
                >
                  {choice === 'new' && <Icon name="check" />} Keep new
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {pager}
    </div>
  );
}
