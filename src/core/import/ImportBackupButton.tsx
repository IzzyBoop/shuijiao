import { useState } from 'preact/hooks';
import { readBackupFile } from '../db/backup-file';
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
    setBusy(true);
    try {
      const result = await readBackupFile(file);
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
        accept=".json,.gz,application/json,application/gzip,application/x-gzip"
        class="sr-only"
        disabled={busy}
        onChange={(e) => void chooseFile(e.currentTarget)}
      />
    </label>
  );
}
