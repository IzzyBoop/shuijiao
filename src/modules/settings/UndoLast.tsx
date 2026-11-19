import { useState } from 'preact/hooks';
import { store } from '../../core/db/store';
import { Dialog } from '../../core/ui/Dialog';
import { errorMessage, useAsync } from '../../core/ui/useAsync';

const when = (time: number) =>
  new Date(time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/**
 * "Undo the last import / erase": shown in Settings while a copy from just before it is
 * kept. Pass a new `refresh` value to look again (e.g. after erasing).
 */
export function UndoLast({ refresh, onUndone }: { refresh: number; onUndone: () => void }) {
  const undo = useAsync(() => store.getUndo(), [refresh]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const run = async () => {
    setBusy(true);
    try {
      await store.undoLast();
      setMessage({ kind: 'ok', text: 'Done. Everything is back as it was before.' });
      onUndone();
    } catch (err) {
      setMessage({ kind: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
      setConfirming(false);
      undo.reload();
    }
  };

  const discard = async () => {
    try {
      await store.discardUndo();
      setMessage(null);
    } catch (err) {
      setMessage({ kind: 'error', text: errorMessage(err) });
    }
    undo.reload();
  };

  const u = undo.data;
  const what = u?.kind === 'erase' ? 'erase' : 'import';

  return (
    <>
      {message && (
        <div class={`notice ${message.kind}`} role="status">
          {message.text}
        </div>
      )}
      {u && (
        <div class="stack">
          <p class="small">
            {u.kind === 'erase' ? 'You erased all study data' : `You imported ${u.label}`} on{' '}
            {when(u.takenAt)}. A copy of everything from just before is kept in this browser, so you can undo
            it.
          </p>
          <div class="row">
            <button
              type="button"
              onClick={() => {
                setConfirming(true);
              }}
            >
              Undo the last {what}…
            </button>
            <button type="button" onClick={() => void discard()}>
              Delete the copy
            </button>
          </div>
          <Dialog
            open={confirming}
            title={`Undo the last ${what}?`}
            onClose={() => {
              setConfirming(false);
            }}
            actions={
              <>
                <button
                  type="button"
                  class="primary"
                  autofocus
                  onClick={() => {
                    setConfirming(false);
                  }}
                >
                  Cancel
                </button>
                <button type="button" class="danger" disabled={busy} onClick={() => void run()}>
                  Undo the {what}
                </button>
              </>
            }
          >
            <p>Your cards, decks, and study progress go back to how they were on {when(u.takenAt)}.</p>
            <p>
              {u.reviewsSince > 0
                ? `Anything you've changed since then is lost, including the ${u.reviewsSince} answer${u.reviewsSince === 1 ? '' : 's'} you've given.`
                : "Anything you've changed since then (such as cards you added) is lost."}
            </p>
          </Dialog>
        </div>
      )}
    </>
  );
}
