import { useState } from 'preact/hooks';
import { encodeBackupFile, formatSize } from '../../core/db/backup-file';
import { parseBackup } from '../../core/db/backup-schema';
import { store } from '../../core/db/store';
import { localDateStamp } from '../../core/format';
import { ImportBackupButton } from '../../core/import/ImportBackupButton';
import { reportProblemUrl } from '../../core/report';
import { ExternalLink } from '../../core/ui/ExternalLink';
import { Icon } from '../../core/ui/Icon';
import { errorMessage, useAsync } from '../../core/ui/useAsync';

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

export function BackupPanel() {
  const lastBackup = useAsync(() => store.getMeta('lastBackupAt'), []);
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
      lastBackup.reload();
      setStatus({
        kind: 'ok',
        text: `Backup downloaded (${cards} cards, ${formatSize(file.blob.size)}).`,
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
    </section>
  );
}
