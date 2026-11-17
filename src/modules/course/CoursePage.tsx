import { store } from '../../core/db/store';
import { andList } from '../../core/format';
import { setPendingImport } from '../../core/import/pending';
import { href, navigate } from '../../core/router';
import { Pinyin, Trad } from '../../core/ui/chinese';
import { Icon } from '../../core/ui/Icon';
import { useAsync } from '../../core/ui/useAsync';
import { loadCourseDeck, summarizeCourse, type CourseCardStatus } from './course-deck';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const STATUS_BADGE: Record<CourseCardStatus, { label: string; class: string }> = {
  new: { label: 'New to you', class: 'badge auto' },
  have: { label: 'You have it', class: 'badge ok' },
  changed: { label: 'Yours is different', class: 'badge warn' },
};

export function CoursePage() {
  const data = useAsync(async () => {
    const load = await loadCourseDeck();
    if (load.kind !== 'ok') return { load, summary: null, myCount: 0 };
    const [mine, duplicates] = await Promise.all([
      store.listCards(),
      store.findImportDuplicates(load.backup),
    ]);
    return { load, summary: summarizeCourse(load.backup, mine, duplicates), myCount: mine.length };
  }, []);

  const head = (canImport: (() => void) | null) => (
    <div class="page-head">
      <h1>Course cards</h1>
      {canImport && (
        <button type="button" class="primary" onClick={canImport}>
          <Icon name="download" /> Import these cards
        </button>
      )}
    </div>
  );

  if (data.error) return <div class="notice error">{data.error}</div>;
  if (!data.data) {
    return (
      <>
        {head(null)}
        <p class="muted">Loading…</p>
      </>
    );
  }

  const { load, summary, myCount } = data.data;
  if (load.kind === 'none' || (load.kind === 'ok' && summary?.total === 0)) {
    return (
      <>
        {head(null)}
        <section class="panel stack">
          <p>There are no course cards yet. Check back after the next class.</p>
          <p>
            <a class="button" href={href('/')}>
              Back to Study
            </a>
          </p>
        </section>
      </>
    );
  }
  if (load.kind === 'error' || !summary) {
    return (
      <>
        {head(null)}
        <div class="notice error" role="alert">
          <Icon name="alert" />
          <span class="grow">{load.kind === 'error' ? load.message : 'Something went wrong.'}</span>
          <button type="button" onClick={data.reload}>
            Try again
          </button>
        </div>
      </>
    );
  }

  const updated = new Date(summary.updatedAt).toLocaleDateString(undefined, { dateStyle: 'long' });
  const importNow = () => {
    setPendingImport({
      backup: load.backup,
      source: 'course',
      label: `Updated ${updated}`,
      back: { path: '/course', label: 'Course cards' },
    });
    navigate('/import');
  };
  const { counts } = summary;
  const compare = myCount > 0;
  const kinds = [plural(summary.words, 'word'), plural(summary.sentences, 'sentence')].filter(
    (s) => !s.startsWith('0 '),
  );

  return (
    <>
      {head(importNow)}

      <section class="panel stack">
        <p>
          The cards for our course, ready to add to your own. They're updated as the course goes on, so check
          back after new lessons.
        </p>
        <div class="course-stats">
          <div>
            <div class="stat">{summary.total}</div>
            <div class="muted small">{andList(kinds)}</div>
          </div>
          <div>
            <div class="stat">{summary.decks.length}</div>
            <div class="muted small">{summary.decks.length === 1 ? 'deck' : 'decks'}</div>
          </div>
          <div>
            <div class="stat-text">{updated}</div>
            <div class="muted small">last updated</div>
          </div>
        </div>
        {compare &&
          (counts.new === 0 && counts.changed === 0 ? (
            <div class="notice ok" role="status">
              <Icon name="check" /> You already have all of these cards.
            </div>
          ) : (
            <p>
              Compared with your cards:{' '}
              {andList(
                [
                  counts.new > 0 && `${counts.new} new to you`,
                  counts.have > 0 && `${counts.have} you already have`,
                  counts.changed > 0 &&
                    `${counts.changed} you have, but with different details (you choose which to keep)`,
                ].filter((s): s is string => typeof s === 'string'),
              )}
              .
            </p>
          ))}
        <p class="small muted">
          Importing lets you choose which decks the cards go into and what to do with cards you already have.
          Nothing changes until you confirm. Your study progress is kept.
        </p>
      </section>

      {summary.decks.map((deck) => {
        const fresh = deck.cards.filter((c) => c.status === 'new').length;
        return (
          <details class="panel course-deck" key={deck.id || 'other'}>
            <summary>
              <span class="course-deck-name">{deck.name}</span>{' '}
              <span class="muted small">
                {plural(deck.cards.length, 'card')}
                {compare && fresh > 0 ? ` · ${fresh} new to you` : ''}
              </span>
            </summary>
            <ul class="list card-list">
              {deck.cards.map(({ card, status }) => (
                <li key={card.id}>
                  <div class="grow">
                    <div class="row">
                      <Trad text={card.traditional} class="card-row-hanzi" />
                      <Pinyin text={card.pinyin} />
                      {compare && (
                        <span class={STATUS_BADGE[status].class}>{STATUS_BADGE[status].label}</span>
                      )}
                    </div>
                    <div class="muted small truncate">{card.meaning}</div>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </>
  );
}
