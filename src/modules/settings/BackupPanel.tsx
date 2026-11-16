import { useState } from 'preact/hooks';
import { parseBackup, type Backup } from '../../core/db/backup-schema';
import { LIMITS } from '../../core/db/model';
import { store, type ImportDeckMode, type ImportPreview } from '../../core/db/store';
import { andList } from '../../core/format';
import { Icon } from '../../core/ui/Icon';
import { errorMessage, useAsync } from '../../core/ui/useAsync';

function downloadJson(data: unknown, fileName: string): void {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

function PreviewTable({ preview }: { preview: ImportPreview }) {
  const rows: [string, keyof Omit<ImportPreview, 'orphans' | 'decksCreated'>][] = [
    ['Decks', 'decks'],
    ['Cards', 'cards'],
    ['Card types', 'templates'],
    ['Study progress', 'reviewStates'],
    ['Review history', 'reviewLogs'],
    ['My links', 'links'],
  ];
  return (
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
  );
}

export function BackupPanel() {
  const lastBackup = useAsync(() => store.getMeta('lastBackupAt'), []);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, setPending] = useState<{
    backup: Backup;
    preview: ImportPreview;
    name: string;
    deckMode: ImportDeckMode;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const exportNow = async () => {
    setBusy(true);
    try {
      const backup = await store.exportBackup();
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(backup, `shuijiao-backup-${date}.json`);
      await store.setMeta('lastBackupAt', Date.now());
      lastBackup.reload();
      setStatus({
        kind: 'ok',
        text: `Backup downloaded (${backup.cards.filter((c) => !c.deleted).length} cards).`,
      });
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const chooseFile = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = '';
    setPending(null);
    setStatus(null);
    if (!file) return;
    if (file.size > LIMITS.importBytes) {
      setStatus({
        kind: 'error',
        text: 'That file is larger than 10 MB, so it is not a backup from this portal.',
      });
      return;
    }
    setBusy(true);
    try {
      const result = parseBackup(await file.text());
      if (!result.ok) {
        setStatus({ kind: 'error', text: `This file can't be imported. ${result.errors.join(' ')}` });
        return;
      }
      const preview = await store.previewImport(result.backup, { deckMode: 'keep' });
      setPending({ backup: result.backup, preview, name: file.name.slice(0, 100), deckMode: 'keep' });
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const chooseDeckMode = async (deckMode: ImportDeckMode) => {
    if (!pending) return;
    try {
      const preview = await store.previewImport(pending.backup, { deckMode });
      setPending({ ...pending, deckMode, preview });
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err) });
    }
  };

  const applyImport = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const result = await store.applyImport(pending.backup, { deckMode: pending.deckMode });
      setPending(null);
      setStatus({
        kind: 'ok',
        text: `Imported: ${result.cards.added} new cards, ${result.cards.updated} updated.`,
      });
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const last = typeof lastBackup.data === 'number' ? new Date(lastBackup.data).toLocaleDateString() : null;

  return (
    <section class="panel stack" id="backup">
      <h2>Backup</h2>
      <p class="muted">
        Your cards live only in this browser. Download a backup now and then, and use it to move your cards to
        another device. {last ? `Last backup: ${last}.` : 'You have not made a backup yet.'}
      </p>
      {status && (
        <div class={`notice ${status.kind}`} role="status">
          {status.text}
        </div>
      )}
      <div class="row">
        <button type="button" class="primary" disabled={busy} onClick={() => void exportNow()}>
          <Icon name="download" /> Download backup
        </button>
        <label class="button">
          <Icon name="upload" /> Import a backup…
          <input
            type="file"
            accept=".json,application/json"
            class="sr-only"
            disabled={busy}
            onChange={(e) => void chooseFile(e.currentTarget)}
          />
        </label>
      </div>
      {pending && (
        <div class="notice">
          <div class="stack full">
            <strong>Import “{pending.name}”?</strong>
            <fieldset class="choice-group">
              <legend class="field-label">Which decks should the cards go into?</legend>
              <label class="check">
                <input
                  type="radio"
                  name="import-decks"
                  checked={pending.deckMode === 'keep'}
                  onChange={() => void chooseDeckMode('keep')}
                />
                <span>
                  The decks they were in <span class="muted small">(missing decks are created)</span>
                </span>
              </label>
              <label class="check">
                <input
                  type="radio"
                  name="import-decks"
                  checked={pending.deckMode === 'my-cards'}
                  onChange={() => void chooseDeckMode('my-cards')}
                />
                <span>
                  All into “My cards” <span class="muted small">(created if you don’t have it)</span>
                </span>
              </label>
            </fieldset>
            <p class="small">
              {pending.preview.decksCreated.length > 0
                ? `This creates ${pending.preview.decksCreated.length === 1 ? 'a deck' : 'decks'}: ${andList(pending.preview.decksCreated.map((n) => `“${n}”`))}.`
                : 'No new decks are created.'}
            </p>
            <PreviewTable preview={pending.preview} />
            {pending.preview.orphans > 0 && (
              <p class="small muted">
                {pending.preview.orphans} records refer to missing cards and will be skipped.
              </p>
            )}
            <p class="small muted">Nothing is deleted. Where both copies changed, the newer one is kept.</p>
            <div class="row">
              <button type="button" class="primary" disabled={busy} onClick={() => void applyImport()}>
                Import
              </button>
              <button
                type="button"
                onClick={() => {
                  setPending(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
