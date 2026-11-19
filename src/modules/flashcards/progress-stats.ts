import type { Card, Deck, ReviewLog, ReviewState } from '../../core/db/model';
import { startOfStudyDay } from '../../core/srs/queue';

/**
 * The numbers behind the Progress section of the Study page. Days are study days,
 * which start at 4 am (like the daily limit of new cards), in the student's time zone.
 */

const DAY = 86_400_000;

/** "2026-11-19" for the study day containing `time`. */
export function dayKey(time: number): string {
  const d = new Date(startOfStudyDay(time));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The study day `n` days after the one containing `time` (safe across clock changes). */
function addDays(time: number, n: number): number {
  const d = new Date(startOfStudyDay(time));
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export interface Streaks {
  /** Days in a row with at least one review, up to today (or yesterday, if today has none yet). */
  current: number;
  longest: number;
}

export function streaks(reviewTimes: readonly number[], now: number): Streaks {
  const days = new Set(reviewTimes.map(dayKey));
  let current = 0;
  let day = days.has(dayKey(now)) ? now : addDays(now, -1);
  while (days.has(dayKey(day))) {
    current++;
    day = addDays(day, -1);
  }
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const key of [...days].sort()) {
    const [y, m, d] = key.split('-').map(Number) as [number, number, number];
    const before = dayKey(addDays(new Date(y, m - 1, d, 12).getTime(), -1));
    run = previous === before ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = key;
  }
  return { current, longest };
}

export interface HeatDay {
  key: string;
  /** Noon of that day, for showing its date. */
  time: number;
  count: number;
  /** 0 (none) to 4 (the busiest days). */
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
}

/**
 * Reviews per day for the last `weeks` weeks, as columns of Monday-to-Sunday weeks
 * ending with the current one.
 */
export function heatmap(reviewTimes: readonly number[], now: number, weeks = 17): HeatDay[][] {
  const counts = new Map<string, number>();
  for (const t of reviewTimes) counts.set(dayKey(t), (counts.get(dayKey(t)) ?? 0) + 1);
  const today = startOfStudyDay(now);
  const weekday = (new Date(today).getDay() + 6) % 7; // Monday = 0
  const firstMonday = addDays(today, -weekday - 7 * (weeks - 1));
  const columns: HeatDay[][] = [];
  let max = 0;
  for (let w = 0; w < weeks; w++) {
    const column: HeatDay[] = [];
    for (let d = 0; d < 7; d++) {
      const time = addDays(firstMonday, w * 7 + d) + 12 * 3_600_000;
      const key = dayKey(time);
      const future = time > now && key !== dayKey(now);
      const count = future ? 0 : (counts.get(key) ?? 0);
      max = Math.max(max, count);
      column.push({ key, time, count, level: 0, future });
    }
    columns.push(column);
  }
  for (const column of columns) {
    for (const day of column) {
      if (day.count > 0)
        day.level = Math.min(4, Math.max(1, Math.ceil((4 * day.count) / max))) as HeatDay['level'];
    }
  }
  return columns;
}

export interface Forecast {
  /** Cards due on each of the next 7 study days; today includes overdue ones. */
  days: { time: number; count: number }[];
  next30: number;
}

/** Reviews coming up (cards already being learned; new cards aren't counted). */
export function forecast(states: readonly ReviewState[], now: number): Forecast {
  const days = Array.from({ length: 7 }, (_, i) => ({ time: addDays(now, i), count: 0 }));
  const end30 = addDays(now, 30);
  let next30 = 0;
  for (const s of states) {
    if (s.state === 0) continue;
    if (s.due < end30) next30++;
    const i = days.findIndex((_, n) => s.due < (days[n + 1]?.time ?? addDays(now, 7)));
    const day = days[i];
    if (day) day.count++;
  }
  return { days, next30 };
}

export interface DeckAccuracy {
  deck: Deck;
  answers: number;
  /** Answers rated Good or Easy, 0–1. */
  share: number;
}

export function accuracyByDeck(
  logs: readonly ReviewLog[],
  cards: readonly Card[],
  decks: readonly Deck[],
): DeckAccuracy[] {
  const deckOf = new Map(cards.map((c) => [c.id, c.deckId]));
  const totals = new Map<string, { answers: number; good: number }>();
  for (const log of logs) {
    const deckId = deckOf.get(log.cardId);
    if (!deckId) continue;
    const t = totals.get(deckId) ?? { answers: 0, good: 0 };
    t.answers++;
    if (log.rating >= 3) t.good++;
    totals.set(deckId, t);
  }
  return decks.flatMap((deck) => {
    const t = totals.get(deck.id);
    return t ? [{ deck, answers: t.answers, share: t.good / t.answers }] : [];
  });
}

export interface TroubleCard {
  card: Card;
  /** Times it was forgotten after being learned, over all its card types. */
  lapses: number;
}

export function troubleCards(
  states: readonly ReviewState[],
  cards: readonly Card[],
  limit = 8,
): TroubleCard[] {
  const lapses = new Map<string, number>();
  for (const s of states) if (s.lapses > 0) lapses.set(s.cardId, (lapses.get(s.cardId) ?? 0) + s.lapses);
  return cards
    .flatMap((card) => {
      const n = lapses.get(card.id);
      return n ? [{ card, lapses: n }] : [];
    })
    .sort((a, b) => b.lapses - a.lapses || a.card.createdAt - b.card.createdAt)
    .slice(0, limit);
}

export const DAYS_FOR_ACCURACY = 30;
export const accuracySince = (now: number) => now - DAYS_FOR_ACCURACY * DAY;
