import { useEffect, useState } from 'preact/hooks';
import type { Grade } from 'ts-fsrs';
import type { RouteProps } from '../../core/modules';
import { store } from '../../core/db/store';
import { href } from '../../core/router';
import { applyReview, emptyState, formatInterval, GRADES, previewDue } from '../../core/srs/scheduler';
import type { QueueItem } from '../../core/srs/queue';
import { speak, stopSpeaking } from '../../core/lang/tts';
import { getStudyPrefs } from '../../core/study-prefs';
import { errorMessage, useAsync } from '../../core/ui/useAsync';
import { CardSide } from './CardFace';
import { loadSession } from './session-data';

/** Cards due again within this window come back in the same session. */
const RELEARN_WINDOW = 20 * 60_000;

function say(text: string) {
  const p = getStudyPrefs();
  void speak(text, { voiceUri: p.voiceUri, rate: p.speechRate });
}

export function ReviewPage({ params }: RouteProps) {
  const deckId = params.deckId;
  const session = useAsync(() => loadSession(deckId), [deckId]);
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (session.data) setQueue(session.data.queue);
  }, [session.data]);

  const item = queue?.[0];

  // Auto-play on the front for listening cards; on the back if the preference is on.
  useEffect(() => {
    if (!item) return;
    if (!shown && item.template.front.includes('audio')) say(item.card.simplified);
    if (shown && getStudyPrefs().autoPlay && item.template.back.includes('audio')) say(item.card.simplified);
  }, [item, shown]);

  useEffect(
    () => () => {
      stopSpeaking();
    },
    [],
  );

  const grade = async (g: Grade) => {
    if (!item) return;
    const now = Date.now();
    const before = item.state ?? emptyState(item.card.id, item.template.id, now);
    const { state, log } = applyReview(before, g, now);
    try {
      await store.recordReview(state, log);
    } catch (err) {
      setSaveError(errorMessage(err));
      return;
    }
    const rest = queue.slice(1);
    if (state.due - now < RELEARN_WINDOW) {
      const again: QueueItem = { ...item, state };
      const at = rest.findIndex((q) => (q.state?.due ?? Infinity) > state.due);
      rest.splice(at === -1 ? rest.length : at, 0, again);
    }
    stopSpeaking();
    setQueue(rest);
    setShown(false);
    setDone((d) => d + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!item) return;
      if (!shown && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setShown(true);
      } else if (shown && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        void grade(Number(e.key) as Grade);
      } else if (e.key === 'r') {
        say(item.card.simplified);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  });

  if (session.error) return <div class="notice error">{session.error}</div>;
  if (!queue) return <p class="muted">Loading…</p>;

  if (!item) {
    return (
      <section class="panel stack">
        <h1>{done > 0 ? 'Session complete 🎉' : 'Nothing to study right now'}</h1>
        <p class="muted">
          {done > 0
            ? `You reviewed ${done} card${done === 1 ? '' : 's'}.`
            : 'No cards are due. Add new cards or come back later.'}
        </p>
        <div class="row">
          <a class="button primary" href={href('/')}>
            Back to Study
          </a>
          <a class="button" href={href('/add')}>
            Add cards
          </a>
        </div>
      </section>
    );
  }

  const now = Date.now();
  const intervals = previewDue(item.state ?? emptyState(item.card.id, item.template.id, now), now);

  return (
    <>
      <div class="page-head">
        <span class="muted small">
          {queue.length} left · {item.template.name}
        </span>
        <a href={href('/')} class="small">
          End session
        </a>
      </div>
      {saveError && <div class="notice error">Could not save your answer: {saveError}</div>}
      <div class="flashcard" aria-live="polite">
        <CardSide card={item.card} fields={item.template.front} />
        {shown && (
          <>
            <hr />
            <CardSide card={item.card} fields={item.template.back} />
            {item.card.notes && <div class="muted small">{item.card.notes}</div>}
          </>
        )}
      </div>
      {!shown ? (
        <div class="grade-bar">
          <button
            type="button"
            class="primary span-all"
            onClick={() => {
              setShown(true);
            }}
          >
            Show answer <span class="kbd">Space</span>
          </button>
        </div>
      ) : (
        <div class="grade-bar" role="group" aria-label="How well did you remember?">
          {GRADES.map(({ grade: g, label, key }) => (
            <button key={g} type="button" class={`grade-${g}`} onClick={() => void grade(g)}>
              <span>{label}</span>
              <span class="interval">
                {formatInterval(intervals[g] - now)} · <span class="kbd">{key}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
