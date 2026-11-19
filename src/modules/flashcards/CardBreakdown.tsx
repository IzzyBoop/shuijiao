import { useEffect, useState } from 'preact/hooks';
import type { Card } from '../../core/db/model';
import type { Breakdown } from '../../core/lang/breakdown';
import type { WordGloss } from '../../core/lang/autofill';
import { samePinyin, store } from '../../core/db/store';
import { Icon } from '../../core/ui/Icon';
import { useStudyPrefs } from '../../core/study-prefs';
import { Pinyin, Trad } from '../../core/ui/chinese';

// Loaded on first use, with pinyin-pro and the dictionary reader, so they stay out of
// the main bundle that every page load needs (tools/check-dist.mjs checks this).
const loadBreakdown = () => import('../../core/lang/breakdown');

let warmed = false;

/**
 * While a study session or Flip through is open, load the word-by-word code and the
 * dictionary (several MB, and a moment to read) when the browser has nothing else to
 * do, instead of when the first answer is shown. Only once per visit, and only if the
 * word-by-word meanings are turned on.
 */
export function useWarmBreakdown(): void {
  const { showBreakdown } = useStudyPrefs();
  useEffect(() => {
    if (!showBreakdown || warmed) return;
    const run = () => {
      warmed = true;
      loadBreakdown()
        .then((m) => m.warmUp())
        .catch(() => {
          warmed = false; // offline: try again next time
        });
    };
    // Safari has no requestIdleCallback.
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(run, { timeout: 5_000 });
      return () => {
        window.cancelIdleCallback(handle);
      };
    }
    const handle = window.setTimeout(run, 1_500);
    return () => {
      window.clearTimeout(handle);
    };
  }, [showBreakdown]);
}

/**
 * The meaning of each word (in a sentence) or each character (in a word), shown under
 * the answer. Appears once the dictionary has loaded; if it can't load, nothing shows.
 */
export function CardBreakdown({
  card,
  onAdd,
  refresh = 0,
}: {
  card: Card;
  /** Offers "+ Add" on each word the student doesn't have as a card yet. */
  onAdd?: ((part: WordGloss) => void) | undefined;
  /** Change it after a card is added, to look again at which words are theirs. */
  refresh?: number | undefined;
}) {
  const { showBreakdown } = useStudyPrefs();
  const [result, setResult] = useState<Breakdown | null>(null);
  const [owned, setOwned] = useState<ReadonlySet<number>>(new Set());

  // Which words already have a card of their own (same characters and reading).
  useEffect(() => {
    if (!result || !onAdd) return;
    let alive = true;
    void Promise.all(
      result.parts.map(async (p) => {
        const cards = await store.findDuplicates(p.traditional, p.simplified);
        return cards.some((c) => samePinyin(c.pinyin, p.pinyin));
      }),
    ).then((has) => {
      if (alive) setOwned(new Set(has.flatMap((yes, i) => (yes ? [i] : []))));
    });
    return () => {
      alive = false;
    };
  }, [result, refresh, Boolean(onAdd)]);

  useEffect(() => {
    setResult(null);
    if (!showBreakdown) return;
    let alive = true;
    loadBreakdown()
      .then((m) => m.breakdown(card))
      .then((r) => {
        if (alive) setResult(r);
      })
      .catch(() => {
        // Offline before the dictionary (or this code) was ever downloaded: just leave it out.
      });
    return () => {
      alive = false;
    };
  }, [card.traditional, card.simplified, showBreakdown]);

  if (!showBreakdown || !result || result.parts.length === 0) return null;
  return (
    <section class="breakdown" aria-label={result.by === 'word' ? 'Word by word' : 'Character by character'}>
      <div class="breakdown-title small muted">
        {result.by === 'word' ? 'Word by word' : 'Character by character'}
      </div>
      <table class="gloss-table">
        <tbody>
          {result.parts.map((p, i) => (
            <tr key={i}>
              <td>
                <Trad text={p.traditional} />
              </td>
              <td>
                <Pinyin text={p.pinyin} />
              </td>
              <td>{p.gloss}</td>
              {onAdd && (
                <td class="breakdown-add">
                  {owned.has(i) ? (
                    <span class="breakdown-yours" title="You have this card">
                      <Icon name="check" label={`You have ${p.traditional} as a card`} />
                    </span>
                  ) : (
                    <button
                      type="button"
                      class="ghost icon-only"
                      aria-label={`Add ${p.traditional} as a card`}
                      title="Add as a card"
                      onClick={() => {
                        onAdd(p);
                      }}
                    >
                      <Icon name="plus" />
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
