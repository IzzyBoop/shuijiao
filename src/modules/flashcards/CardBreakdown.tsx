import { useEffect, useState } from 'preact/hooks';
import type { Card } from '../../core/db/model';
import type { Breakdown } from '../../core/lang/breakdown';
import { useStudyPrefs } from '../../core/study-prefs';
import { Pinyin, Trad } from '../../core/ui/chinese';

// Loaded on first use, with pinyin-pro and the dictionary reader, so they stay out of
// the main bundle that every page load needs (tools/check-dist.mjs checks this).
const loadBreakdown = () => import('../../core/lang/breakdown');

/**
 * The meaning of each word (in a sentence) or each character (in a word), shown under
 * the answer. Appears once the dictionary has loaded; if it can't load, nothing shows.
 */
export function CardBreakdown({ card }: { card: Card }) {
  const { showBreakdown } = useStudyPrefs();
  const [result, setResult] = useState<Breakdown | null>(null);

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
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
