import type { Deck } from '../../core/db/model';
import { store } from '../../core/db/store';
import { href } from '../../core/router';
import { Pinyin, Trad } from '../../core/ui/chinese';
import { useAsync } from '../../core/ui/useAsync';
import {
  accuracyByDeck,
  accuracySince,
  forecast,
  heatmap,
  streaks,
  troubleCards,
  type Forecast,
  type HeatDay,
} from './progress-stats';
import { activeTemplates } from './session-data';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const shortDate = (time: number) =>
  new Date(time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
/**
 * A share (0–1) in steps of 5%, for the bar classes .w-N / .h-N in app.css: inline
 * styles aren't used (see the Content Security Policy in SECURITY.md).
 */
const step = (share: number) => Math.round(Math.min(1, Math.max(0, share)) * 20) * 5;
const weekdayName = (time: number) => new Date(time).toLocaleDateString(undefined, { weekday: 'short' });

/**
 * The Progress part of the Study page: streaks, a calendar of study days, the reviews
 * coming up, how well each deck is remembered, and the cards forgotten most often. It
 * loads on its own, after the rest of the page, so studying never waits for it.
 */
export function ProgressSection({ decks }: { decks: readonly Deck[] }) {
  const data = useAsync(async () => {
    const now = Date.now();
    const [times, logs, cards, templates, active] = await Promise.all([
      store.listReviewTimes(),
      store.listReviewLogsSince(accuracySince(now)),
      store.listCards(),
      store.listTemplates(),
      activeTemplates(),
    ]);
    const live = new Set(cards.map((c) => c.id));
    const states = (await store.listReviewStates(templates.map((t) => t.id))).filter((s) =>
      live.has(s.cardId),
    );
    const activeIds = new Set(active.map((t) => t.id));
    return {
      reviewed: times.length > 0,
      streak: streaks(times, now),
      weeks: heatmap(times, now),
      coming: forecast(
        states.filter((s) => activeIds.has(s.templateId)),
        now,
      ),
      answers30: logs.length,
      accuracy: accuracyByDeck(logs, cards, decks),
      trouble: troubleCards(states, cards),
    };
  }, [decks]);

  const p = data.data;
  if (!p) return null; // loading, or it failed: the rest of the page matters more
  return (
    <section class="panel stack progress" aria-labelledby="progress-heading">
      <h2 id="progress-heading">Progress</h2>
      {!p.reviewed ? (
        <p class="muted">Your progress shows up here once you've studied a few cards.</p>
      ) : (
        <>
          <div class="stat-tiles">
            <div class="stat-tile">
              <div class="stat-tile-value">{p.streak.current}</div>
              <div class="stat-tile-label">{p.streak.current === 1 ? 'day' : 'days'} in a row</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile-value">{p.streak.longest}</div>
              <div class="stat-tile-label">longest streak (days)</div>
            </div>
            <div class="stat-tile">
              <div class="stat-tile-value">{p.answers30}</div>
              <div class="stat-tile-label">answers in the last 30 days</div>
            </div>
          </div>

          <h3>Study days</h3>
          <Heatmap weeks={p.weeks} />

          <h3>Coming up</h3>
          <ForecastBars coming={p.coming} />

          {p.accuracy.length > 0 && (
            <>
              <h3>Remembered in the last 30 days</h3>
              <ul class="accuracy-list">
                {p.accuracy.map(({ deck, answers, share }) => (
                  <li key={deck.id}>
                    <div class="accuracy-head">
                      <span>{deck.name}</span>
                      <strong>{Math.round(share * 100)}%</strong>
                    </div>
                    <span class="bar-track" aria-hidden="true">
                      <span class={`bar-fill w-${step(share)}`} />
                    </span>
                    <span class="small muted">Good or Easy, of {plural(answers, 'answer')}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h3>Cards you keep forgetting</h3>
          {p.trouble.length === 0 ? (
            <p class="muted small">None so far: once you've learned a card, you haven't forgotten it.</p>
          ) : (
            <>
              <p class="muted small">
                Forgotten after you'd learned them. A note or an example sentence on the card can help it
                stick.
              </p>
              <ul class="list trouble-list">
                {p.trouble.map(({ card, lapses }) => (
                  <li key={card.id}>
                    <div class="grow">
                      <Trad text={card.traditional} /> <Pinyin text={card.pinyin} />
                      <div class="muted small truncate">{card.meaning}</div>
                    </div>
                    <span class="small muted">forgotten {lapses === 1 ? 'once' : `${lapses} times`}</span>
                    <a
                      class="button"
                      href={href(`/cards/${card.id}`)}
                      aria-label={`Edit ${card.traditional}`}
                    >
                      Edit
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}

function Heatmap({ weeks }: { weeks: HeatDay[][] }) {
  const days = weeks.flat().filter((d) => !d.future);
  const studied = days.filter((d) => d.count > 0).length;
  // A month's name over the week it starts in (and over the first week, unless the next
  // month starts too soon after it to leave room for both names).
  const monthOf = (i: number) => new Date(weeks[i]?.[0]?.time ?? 0).getMonth();
  const starts = weeks.map((_, i) => i > 0 && monthOf(i) !== monthOf(i - 1));
  const firstChange = starts.indexOf(true);
  const month = (column: HeatDay[], i: number) => {
    const first = column[0];
    const show = starts[i] === true || (i === 0 && (firstChange === -1 || firstChange >= 3));
    return first && show ? new Date(first.time).toLocaleDateString(undefined, { month: 'short' }) : '';
  };
  return (
    <div
      class="heatmap"
      role="img"
      aria-label={`Reviews per day over the last ${weeks.length} weeks: you studied on ${plural(studied, 'day')}.`}
    >
      <div class="heat-months" aria-hidden="true">
        {weeks.map((column, i) => (
          <span key={i}>{month(column, i)}</span>
        ))}
      </div>
      <div class="heat-body" aria-hidden="true">
        <div class="heat-weekdays">
          <span>Mon</span>
          <span />
          <span>Wed</span>
          <span />
          <span>Fri</span>
          <span />
          <span />
        </div>
        <div class="heat-grid">
          {weeks.flat().map((d) => (
            <span
              key={d.key}
              class={`heat-cell heat-${d.level}${d.future ? ' heat-future' : ''}`}
              title={d.future ? undefined : `${shortDate(d.time)}: ${plural(d.count, 'answer')}`}
            />
          ))}
        </div>
      </div>
      <div class="heat-legend small muted" aria-hidden="true">
        Less
        {([0, 1, 2, 3, 4] as const).map((l) => (
          <span key={l} class={`heat-cell heat-${l}`} />
        ))}
        More
      </div>
    </div>
  );
}

function ForecastBars({ coming }: { coming: Forecast }) {
  const max = Math.max(1, ...coming.days.map((d) => d.count));
  const label = (time: number, i: number) => (i === 0 ? 'Today' : weekdayName(time));
  return (
    <>
      <div
        class="forecast"
        role="img"
        aria-label={`Cards due: ${coming.days.map((d, i) => `${label(d.time, i)} ${d.count}`).join(', ')}.`}
      >
        {coming.days.map((d, i) => (
          <div key={d.time} class="forecast-day" title={`${shortDate(d.time)}: ${plural(d.count, 'card')}`}>
            <span class="forecast-count small">{d.count}</span>
            <span class="forecast-plot">
              <span
                class={`bar-fill forecast-bar h-${d.count === 0 ? 0 : Math.max(5, step(d.count / max))}`}
              />
            </span>
            <span class="forecast-label small muted">{label(d.time, i)}</span>
          </div>
        ))}
      </div>
      <p class="small muted">{plural(coming.next30, 'review')} due in the next 30 days.</p>
    </>
  );
}
