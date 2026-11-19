import { DefaultScheduler, type Grade } from 'ts-fsrs';
import { newId, stateKey, type ReviewLog, type ReviewState } from '../db/model';

/**
 * The longest gap between reviews: 50 years, far more than anyone needs, and short enough
 * that a due date always stays inside what a backup accepts (before the year 2100).
 */
export const MAX_INTERVAL_DAYS = 18_250;

/** FSRS-7 with learning steps (1m, 10m) and fuzzed intervals, targeting 90% recall. */
const OPTIONS = {
  version: 'FSRS-7',
  desiredRetention: 0.9,
  enableShortTerm: true,
  learningSteps: ['1m', '10m'],
  relearningSteps: ['10m'],
  enableFuzz: true,
  maximumInterval: MAX_INTERVAL_DAYS,
} as const;

type Scheduler = Awaited<ReturnType<typeof DefaultScheduler<'FSRS-7'>>>;
type SchedulerCard = ReturnType<Scheduler['newCard']>;

let scheduler: Scheduler | null = null;
let pending: Promise<Scheduler> | null = null;

/** Must be awaited once before previewDue/applyReview (the review page does this while loading). */
export async function initScheduler(): Promise<void> {
  pending ??= DefaultScheduler(OPTIONS);
  scheduler = await pending;
}

function get(): Scheduler {
  if (!scheduler) throw new Error('Scheduler not initialised');
  return scheduler;
}

export const GRADES: readonly { grade: Grade; label: string; key: string }[] = [
  { grade: 1, label: 'Again', key: '1' },
  { grade: 2, label: 'Hard', key: '2' },
  { grade: 3, label: 'Good', key: '3' },
  { grade: 4, label: 'Easy', key: '4' },
];

export function emptyState(cardId: string, templateId: string, now: number): ReviewState {
  return {
    key: stateKey(cardId, templateId),
    cardId,
    templateId,
    due: now,
    stability: 0,
    stabilityFast: 0,
    difficulty: 0,
    scheduledDays: 0,
    learningStep: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    scheduleStatus: 'new',
    lastReview: null,
    updatedAt: now,
  };
}

function toCard(s: ReviewState): SchedulerCard {
  return {
    cardId: s.key,
    dueAt: new Date(s.due),
    lastReviewAt: s.lastReview === null ? null : new Date(s.lastReview),
    stability: s.stability,
    stabilityFast: s.stabilityFast,
    difficulty: s.difficulty,
    scheduledDays: s.scheduledDays,
    learningStep: s.learningStep,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state,
    scheduleStatus: s.scheduleStatus,
  };
}

/** When the card would next be due for each possible answer. */
export function previewDue(s: ReviewState, now: number): Record<Grade, number> {
  const out = { 1: now, 2: now, 3: now, 4: now } as Record<Grade, number>;
  for (const item of get().preview({ card: toCard(s), now: new Date(now) })) {
    out[item.grade] = item.card.dueAt.getTime();
  }
  return out;
}

export function applyReview(
  s: ReviewState,
  grade: Grade,
  now: number,
): { state: ReviewState; log: ReviewLog } {
  const { card, revlog } = get().review({ card: toCard(s), grade, now: new Date(now) });
  const state: ReviewState = {
    ...s,
    due: card.dueAt.getTime(),
    stability: card.stability,
    stabilityFast: card.stabilityFast,
    difficulty: card.difficulty,
    scheduledDays: card.scheduledDays,
    learningStep: card.learningStep,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    scheduleStatus: card.scheduleStatus,
    lastReview: card.lastReviewAt?.getTime() ?? now,
    updatedAt: now,
  };
  return {
    state,
    log: {
      id: newId(),
      cardId: s.cardId,
      templateId: s.templateId,
      rating: grade,
      state: s.state,
      due: revlog.dueAt.getTime(),
      stability: revlog.stability,
      stabilityFast: revlog.stabilityFast,
      difficulty: revlog.difficulty,
      scheduledDays: revlog.scheduledDays,
      learningStep: revlog.learningStep,
      review: now,
    },
  };
}

export function formatInterval(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min}m`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days}d`;
  const months = Math.round(days / 30.4);
  if (months < 12) return `${months}mo`;
  return `${(days / 365).toFixed(1)}y`;
}
