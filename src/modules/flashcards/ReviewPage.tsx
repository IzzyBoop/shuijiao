import { useEffect, useRef, useState } from 'preact/hooks';
import type { Grade } from 'ts-fsrs';
import type { RouteProps } from '../../core/modules';
import { store } from '../../core/db/store';
import { href } from '../../core/router';
import { Icon } from '../../core/ui/Icon';
import { applyReview, emptyState, formatInterval, GRADES, previewDue } from '../../core/srs/scheduler';
import { requeue, type QueueItem } from '../../core/srs/queue';
import { speak, stopSpeaking } from '../../core/lang/tts';
import { getStudyPrefs } from '../../core/study-prefs';
import { errorMessage, useAsync } from '../../core/ui/useAsync';
import { useKeydown } from '../../core/ui/useKeydown';
import { CardFaces } from './CardFace';
import { EditCardDialog } from './EditCardDialog';
import { loadSession } from './session-data';
import { LoadError } from '../../core/ui/LoadError';

/** Cards due again within this window come back in the same session. */
const RELEARN_WINDOW = 20 * 60_000;

function say(text: string) {
  const p = getStudyPrefs();
  void speak(text, { voiceUri: p.voiceUri, rate: p.speechRate });
}

/** The ordinary session: what is due, and today's new cards. */
export function ReviewPage({ params }: RouteProps) {
  return <ReviewSession deckId={params.deckId} ahead={false} />;
}

/** A session the student asked for although nothing is due: cards come up ahead of schedule. */
export function StudyAheadPage({ params }: RouteProps) {
  return <ReviewSession deckId={params.deckId} ahead />;
}

function ReviewSession({ deckId, ahead }: { deckId: string | undefined; ahead: boolean }) {
  const session = useAsync(() => loadSession(deckId, { ahead }), [deckId, ahead]);
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  // The card whose rating is being saved. A second press before the next card shows up
  // (a double tap, a quick second key) must not rate the same card again.
  const grading = useRef<QueueItem | null>(null);

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

  // Keep keyboard focus on the card, not on a button. Otherwise the button you just
  // clicked keeps focus, and the key-up of Space would "click" whatever button is in
  // that spot next (e.g. rate a card Again that you only meant to reveal).
  useEffect(() => {
    if (!editing) cardRef.current?.focus({ preventScroll: true });
  }, [item, shown, editing]);

  const grade = async (g: Grade) => {
    if (!item || grading.current === item) return;
    grading.current = item;
    const now = Date.now();
    const before = item.state ?? emptyState(item.card.id, item.template.id, now);
    const { state, log } = applyReview(before, g, now);
    try {
      await store.recordReview(state, log);
    } catch (err) {
      grading.current = null; // not saved: rating it again is allowed
      setSaveError(errorMessage(err));
      return;
    }
    let rest = queue.slice(1);
    if (state.due - now < RELEARN_WINDOW) {
      // Due again within the session: bring it back after a gap, never straight away.
      rest = requeue(rest, { ...item, state }, now);
    }
    stopSpeaking();
    setQueue(rest);
    setShown(false);
    setDone((d) => d + 1);
  };

  useKeydown((e) => {
    // While the edit popup is open, keys belong to it (no accidental ratings).
    if (editing) return;
    // A held-down key repeats; only the first press counts (no rating by holding "3").
    if (e.repeat) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (!item) return;
    if (e.key === 'e' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      setEditing(true);
    } else if (!shown && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      setShown(true);
    } else if (shown && ['1', '2', '3', '4'].includes(e.key)) {
      e.preventDefault();
      void grade(Number(e.key) as Grade);
    } else if (e.key === 'r') {
      say(item.card.simplified);
    }
  });

  if (session.error) return <LoadError error={session.error} retry={session.reload} />;
  if (!queue) return <p class="muted">Loading…</p>;

  if (!item) {
    const aheadPath = deckId ? `/study-ahead/${deckId}` : '/study-ahead';
    const hasCards = (session.data?.totalCards ?? 0) > 0;
    return (
      <section class="panel stack">
        <h1>{done > 0 ? 'Session complete 🎉' : 'Nothing to study right now'}</h1>
        <p class="muted">
          {done > 0
            ? `You reviewed ${done} card${done === 1 ? '' : 's'}.`
            : hasCards
              ? 'No cards are due.'
              : 'There are no cards here yet. Add some to start studying.'}
        </p>
        {hasCards && !ahead && (
          <p class="muted">
            Want to study ahead? Your cards come up before they're due, the ones due soonest first, and your
            answers count as usual. Nothing is reset.
          </p>
        )}
        <div class="row">
          {hasCards && !ahead && (
            <a class="button primary" href={href(aheadPath)}>
              Study ahead
            </a>
          )}
          <a class={hasCards && !ahead ? 'button' : 'button primary'} href={href('/')}>
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
          {ahead && 'Studying ahead · '}
          {queue.length} left · {item.template.name}
        </span>
        <span class="row">
          <button
            type="button"
            class="ghost"
            onClick={() => {
              setEditing(true);
            }}
          >
            <Icon name="edit" /> Edit card <span class="kbd">E</span>
          </button>
          <a href={href('/')} class="small">
            End session
          </a>
        </span>
      </div>
      {saveError && <div class="notice error">Could not save your answer: {saveError}</div>}
      <div class="flashcard" tabIndex={-1} ref={cardRef}>
        <CardFaces card={item.card} front={item.template.front} back={item.template.back} shown={shown} />
      </div>
      {!shown ? (
        <div class="grade-bar" key="show">
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
        <div class="grade-bar" key="rate" role="group" aria-label="How well did you remember?">
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
      <EditCardDialog
        card={editing ? item.card : null}
        onClose={() => {
          setEditing(false);
        }}
        onSaved={(updated) => {
          // Update every queued copy of this card (one per card type) in place.
          setQueue((q) => (q ?? []).map((it) => (it.card.id === updated.id ? { ...it, card: updated } : it)));
        }}
      />
    </>
  );
}
