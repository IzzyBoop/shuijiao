import { store } from '../../core/db/store';
import { href } from '../../core/router';
import { countQueue } from '../../core/srs/queue';
import { Icon } from '../../core/ui/Icon';
import { useAsync } from '../../core/ui/useAsync';
import { loadSession } from './session-data';

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
            and the portal fills in the other script, pinyin and meaning for you to check.
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
            <div>
              <div class="stat">{counts.due + counts.fresh}</div>
              <div class="muted">
                {counts.due} due · {counts.fresh} new · {all.totalCards} cards total
              </div>
            </div>
            <div class="row">
              <a class="button" href={href('/browse')}>
                <Icon name="cards" /> Browse
              </a>
              {counts.due + counts.fresh > 0 ? (
                <a class="button primary" href={href('/review')}>
                  <Icon name="study" /> Study now
                </a>
              ) : (
                <span class="badge ok">All done for today</span>
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
                <li key={deck.id}>
                  <div class="grow">
                    <div class="truncate">{deck.name}</div>
                    <div class="muted small">
                      {c.due} due · {c.fresh} new · {session.totalCards} cards
                    </div>
                  </div>
                  <a class="button" href={href(`/browse/${deck.id}`)}>
                    Browse
                  </a>
                  <a class="button" href={href(`/review/${deck.id}`)} aria-disabled={c.due + c.fresh === 0}>
                    Study
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p class="small muted">
        Studying: {all.templates.map((t) => t.name).join(', ')} ·{' '}
        <a href={href('/templates')}>Change card types</a>
      </p>
    </>
  );
}
