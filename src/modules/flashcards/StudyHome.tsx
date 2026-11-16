import { store } from '../../core/db/store';
import { andList } from '../../core/format';
import { href } from '../../core/router';
import { countQueue } from '../../core/srs/queue';
import { Icon } from '../../core/ui/Icon';
import { useAsync } from '../../core/ui/useAsync';
import { loadSession } from './session-data';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function StudyHome() {
  const data = useAsync(async () => {
    const decks = await store.listDecks();
    const all = await loadSession(undefined);
    const perDeck = await Promise.all(
      decks.map(async (d) => ({ deck: d, session: await loadSession(d.id) })),
    );
    const lastBackup = await store.getMeta('lastBackupAt');
    return { all, perDeck, lastBackup };
  }, []);

  if (data.error) return <div class="notice error">{data.error}</div>;
  if (!data.data) return <p class="muted">Loading…</p>;

  const { all, perDeck, lastBackup } = data.data;
  const counts = countQueue(all.queue);
  const backupOld =
    all.totalCards >= 10 && (typeof lastBackup !== 'number' || Date.now() - lastBackup > 14 * 86_400_000);

  return (
    <>
      <div class="page-head">
        <h1>Study</h1>
        <a class="button" href={href('/add')}>
          <Icon name="plus" /> Add card
        </a>
      </div>

      {backupOld && (
        <div class="notice warn">
          <Icon name="alert" />
          <span>
            Your cards are stored only in this browser. <a href={href('/settings')}>Download a backup</a> so
            you don't lose them.
          </span>
        </div>
      )}

      {all.totalCards === 0 ? (
        <section class="panel stack">
          <h2>Welcome! 歡迎!</h2>
          <p>
            Start by adding words or sentences from class. Type them in Chinese, in traditional or simplified,
            and the portal fills in the other script, pinyin, and meaning for you to check.
          </p>
          <p>
            <a class="button primary" href={href('/add')}>
              <Icon name="plus" /> Add your first card
            </a>
          </p>
        </section>
      ) : (
        <section class="panel">
          <div class="row spread">
            {counts.due + counts.fresh > 0 ? (
              <div>
                <div class="stat">
                  {counts.due + counts.fresh} <span class="stat-label">to study</span>
                </div>
                <div class="muted">
                  {counts.due} due · {counts.fresh} new · {plural(all.totalCards, 'card')} total
                </div>
              </div>
            ) : (
              <div>
                <div class="stat-done">
                  <Icon name="check" /> All done for today
                </div>
                <div class="muted">Nothing is due · {plural(all.totalCards, 'card')} total</div>
              </div>
            )}
            <div class="row">
              <a class="button" href={href('/browse')}>
                <Icon name="cards" /> Flip through
              </a>
              {counts.due + counts.fresh > 0 ? (
                <a class="button primary" href={href('/review')}>
                  <Icon name="study" /> Study now
                </a>
              ) : (
                <a class="button" href={href('/study-ahead')}>
                  <Icon name="study" /> Study anyway
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {perDeck.length > 1 && (
        <section class="panel">
          <h2>Decks</h2>
          <ul class="list">
            {perDeck.map(({ deck, session }) => {
              const c = countQueue(session.queue);
              return (
                <li key={deck.id} class="deck-row">
                  <div class="grow">
                    <div class="truncate">{deck.name}</div>
                    <div class="muted small">
                      {c.due} due · {c.fresh} new · {plural(session.totalCards, 'card')}
                    </div>
                  </div>
                  <div class="row">
                    <a class="button" href={href(`/cards/deck/${deck.id}`)}>
                      Cards
                    </a>
                    <a class="button" href={href(`/browse/${deck.id}`)}>
                      Flip
                    </a>
                    {/* With nothing due, the session page offers to study ahead. */}
                    <a class="button" href={href(`/review/${deck.id}`)}>
                      Study
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p class="small muted">
        Studying: {andList(all.templates.map((t) => t.name))} ·{' '}
        <a href={href('/templates')}>Change card types</a>
      </p>
    </>
  );
}
