import { useState } from 'preact/hooks';
import { store } from '../../core/db/store';
import { localDateStamp } from '../../core/format';
import { ImportBackupButton } from '../../core/import/ImportBackupButton';
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

export function BackupPanel() {
  const lastBackup = useAsync(() => store.getMeta('lastBackupAt'), []);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const exportNow = async () => {
    setBusy(true);
    try {
      const backup = await store.exportBackup();
      // Named with the local date; the exportedAt timestamp inside stays time-zone neutral.
      const date = localDateStamp();
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
