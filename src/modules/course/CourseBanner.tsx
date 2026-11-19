import { useState } from 'preact/hooks';
import { store } from '../../core/db/store';
import { andList } from '../../core/format';
import { href } from '../../core/router';
import { Icon } from '../../core/ui/Icon';
import { useAsync } from '../../core/ui/useAsync';
import { COURSE_SEEN_KEY, loadCourseDeck, summarizeCourse } from './course-deck';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * On the Study page: "the course cards were updated", when they have changed since the
 * student last looked and include cards they don't have (or have with other details).
 * Opening the Course cards page, or closing this, marks that version as seen. It loads
 * on its own, and shows nothing if the site can't be reached.
 */
export function CourseBanner() {
  const [closed, setClosed] = useState(false);
  const news = useAsync(async () => {
    const load = await loadCourseDeck();
    if (load.kind !== 'ok') return null;
    const updatedAt = load.backup.exportedAt;
    const seen = await store.getMeta(COURSE_SEEN_KEY);
    if (typeof seen === 'number' && seen >= updatedAt) return null;
    const [mine, duplicates] = await Promise.all([
      store.listCards(),
      store.findImportDuplicates(load.backup),
    ]);
    const { counts } = summarizeCourse(load.backup, mine, duplicates);
    if (counts.new + counts.changed === 0) {
      await store.setMeta(COURSE_SEEN_KEY, updatedAt); // nothing in it for them
      return null;
    }
    return { updatedAt, counts, firstLook: typeof seen !== 'number' };
  }, []);

  const n = news.data;
  if (!n || closed) return null;
  const parts = [
    n.counts.new > 0 && `${plural(n.counts.new, 'card')} you don't have yet`,
    n.counts.changed > 0 && `${n.counts.changed} with different details from yours`,
  ].filter((s): s is string => typeof s === 'string');
  const date = new Date(n.updatedAt).toLocaleDateString(undefined, { dateStyle: 'medium' });
  return (
    <div class="notice" role="status">
      <Icon name="book" />
      <span class="grow">
        {n.firstLook ? 'The course cards have ' : `The course cards were updated on ${date}: `}
        {andList(parts)}. <a href={href('/course')}>See the course cards</a>
      </span>
      <button
        type="button"
        class="icon-only ghost notice-close"
        aria-label="Hide until the course cards change again"
        title="Hide until they change again"
        onClick={() => {
          // Hidden once it's saved, so a reload straight after can't bring it back.
          void store
            .setMeta(COURSE_SEEN_KEY, n.updatedAt)
            .catch(() => undefined)
            .then(() => {
              setClosed(true);
            });
        }}
      >
        <Icon name="x" />
      </button>
    </div>
  );
}
