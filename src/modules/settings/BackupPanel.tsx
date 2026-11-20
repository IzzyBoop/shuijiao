import { useState } from 'preact/hooks';
import { encodeBackupFile, formatSize, readBackupFile } from '../../core/db/backup-file';
import { parseBackup } from '../../core/db/backup-schema';
import { store } from '../../core/db/store';
import { localDateStamp } from '../../core/format';
import { ImportBackupButton } from '../../core/import/ImportBackupButton';
import { reportProblemUrl } from '../../core/report';
import { ExternalLink } from '../../core/ui/ExternalLink';
import { Icon } from '../../core/ui/Icon';
import { useAsync } from '../../core/ui/useAsync';
import { problemFrom } from '../../core/ui/problem';

function downloadBlob(blob: Blob, fileName: string): void {
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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function daysAgo(time: number, now = Date.now()): string {
  const days = Math.floor((now - time) / 86_400_000);
  if (days <= 0) return 'today';
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export function BackupPanel() {
  const lastBackup = useAsync(async () => {
    const [at, bytes] = await Promise.all([store.getMeta('lastBackupAt'), store.getMeta('lastBackupBytes')]);
    return { at: typeof at === 'number' ? at : null, bytes: typeof bytes === 'number' ? bytes : null };
  }, []);
  // `report`: details for a "Report the problem" link, shown after the text.
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string; report?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const exportNow = async () => {
    setBusy(true);
    try {
      const backup = await store.exportBackup();
      const text = JSON.stringify(backup);
      // Check the file the same way Import will, so a backup that can't be restored is
      // noticed now, not when it's the only copy left.
      const check = parseBackup(text);
      const file = await encodeBackupFile(text);
      // Named with the local date; the exportedAt timestamp inside stays time-zone neutral.
      downloadBlob(file.blob, `shuijiao-backup-${localDateStamp()}${file.extension}`);
      const cards = backup.cards.filter((c) => !c.deleted).length;
      if (!check.ok) {
        const problem = check.errors.join(' ');
        setStatus({
          kind: 'error',
          text: `Your backup was downloaded, but this portal may not be able to import it: ${problem} Keep the file safe, and please`,
          report: `A backup failed its own check when it was downloaded.\n${problem}`,
        });
        return;
      }
      await store.setMeta('lastBackupAt', Date.now());
      await store.setMeta('lastBackupBytes', file.blob.size);
      lastBackup.reload();
      setStatus({
        kind: 'ok',
        text: `Backup downloaded (${plural(cards, 'card')}, ${formatSize(file.blob.size)}).`,
      });
    } catch (err) {
      const problem = problemFrom(err, 'Downloading a backup');
      setStatus({ kind: 'error', text: problem.text, ...(problem.report ? { report: problem.report } : {}) });
    } finally {
      setBusy(false);
    }
  };

  const checkFile = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const result = await readBackupFile(file);
      if (!result.ok) {
        setStatus({ kind: 'error', text: `${file.name} can't be imported. ${result.errors.join(' ')}` });
        return;
      }
      const b = result.backup;
      const live = (rows: readonly { deleted: 0 | 1 }[]) => rows.filter((r) => r.deleted === 0).length;
      const made = new Date(b.exportedAt).toLocaleDateString();
      setStatus({
        kind: 'ok',
        text:
          `${file.name} is a good backup from ${made}: ${plural(live(b.cards), 'card')} in ` +
          `${plural(live(b.decks), 'deck')}, with ${plural(b.reviewLogs.length, 'answer')}. ` +
          'It can be imported. Nothing was changed.',
      });
    } finally {
      setBusy(false);
    }
  };

  const last = lastBackup.data?.at ?? null;
  const lastText =
    last === null
      ? 'You have not made a backup yet.'
      : `Last backup: ${new Date(last).toLocaleDateString()} (${daysAgo(last)})${
          lastBackup.data?.bytes ? `, ${formatSize(lastBackup.data.bytes)}` : ''
        }.`;

  return (
    <section class="panel stack" id="backup">
      <h2>Backup</h2>
      <p class="muted">
        Your cards live only in this browser. Download a backup now and then, and use it to move your cards to
        another device. {lastText}
      </p>
      {status && (
        <div class={`notice ${status.kind}`} role="status">
          {status.text}
          {status.report !== undefined && (
            <>
              {' '}
              <ExternalLink url={reportProblemUrl(status.report)}>report the problem</ExternalLink>.
            </>
          )}
        </div>
      )}
      <div class="row">
        <button type="button" class="primary" disabled={busy} onClick={() => void exportNow()}>
          <Icon name="download" /> Download backup
        </button>
        <ImportBackupButton
          back={{ path: '/settings', label: 'Settings' }}
          onError={(text) => {
            setStatus(text === null ? null : { kind: 'error', text });
          }}
        />
      </div>
      <div class="stack-tight">
        <label class="button">
          <Icon name="check" /> Check a backup file…
          <input
            type="file"
            accept=".json,.gz,application/json,application/gzip,application/x-gzip"
            class="sr-only"
            disabled={busy}
            onChange={(e) => void checkFile(e.currentTarget)}
          />
        </label>
        <p class="small muted">Makes sure a backup file can be imported, without importing it.</p>
      </div>
    </section>
  );
}
