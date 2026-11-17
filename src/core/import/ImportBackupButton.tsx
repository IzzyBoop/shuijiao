import { useState } from 'preact/hooks';
import { parseBackup } from '../db/backup-schema';
import { LIMITS } from '../db/model';
import { navigate } from '../router';
import { Icon } from '../ui/Icon';
import { errorMessage } from '../ui/useAsync';
import { setPendingImport } from './pending';

/**
 * "Import a backup…": picks a backup file, checks it, and opens the Import page, where
 * the student chooses decks and what to do with duplicates. Problems with the file go
 * to `onError` (null clears the last one).
 */
export function ImportBackupButton({
  back,
  primary = false,
  onError,
}: {
  /** Where the Import page's Cancel and "Back to" link go. */
  back: { path: string; label: string };
  primary?: boolean;
  onError: (message: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);

  const chooseFile = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = '';
    onError(null);
    if (!file) return;
    if (file.size > LIMITS.importBytes) {
      onError('That file is larger than 10 MB, so it is not a backup from this portal.');
      return;
    }
    setBusy(true);
    try {
      const result = parseBackup(await file.text());
      if (!result.ok) {
        onError(`This file can't be imported. ${result.errors.join(' ')}`);
        return;
      }
      setPendingImport({ backup: result.backup, source: 'backup', label: file.name.slice(0, 100), back });
      navigate('/import');
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <label class={primary ? 'button primary' : 'button'}>
      <Icon name="upload" /> Import a backup…
      <input
        type="file"
        accept=".json,application/json"
        class="sr-only"
        disabled={busy}
        onChange={(e) => void chooseFile(e.currentTarget)}
      />
    </label>
  );
}
