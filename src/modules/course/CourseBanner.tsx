import { useState } from 'preact/hooks';
import { store } from '../../core/db/store';
import { andList } from '../../core/format';
import { href } from '../../core/router';
import { Icon } from '../../core/ui/Icon';
import { useAsync } from '../../core/ui/useAsync';
import {
  COURSE_MISSING_KEY,
  COURSE_SEEN_KEY,
  loadCourseDeck,
  markCourseSeen,
  summarizeCourse,
} from './course-deck';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * On the Study page, about the course cards, when they include cards the student doesn't
 * have (or has with other details) and either
 * - they were updated since the student last looked, or
 * - the student is missing more of them than when they last looked (they restored an
 *   older backup, or deleted some by mistake).
 * Opening the Course cards page, or closing this, marks what they saw. It loads on its
 * own, and shows nothing if the site can't be reached.
 */
export function CourseBanner() {
  const [closed, setClosed] = useState(false);
  const news = useAsync(async () => {
    const load = await loadCourseDeck();
    if (load.kind !== 'ok') return null;
    const updatedAt = load.backup.exportedAt;
    const [seen, seenMissing, mine, duplicates] = await Promise.all([
      store.getMeta(COURSE_SEEN_KEY),
      store.getMeta(COURSE_MISSING_KEY),
      store.listCards(),
      store.findImportDuplicates(load.backup),
    ]);
    const { counts } = summarizeCourse(load.backup, mine, duplicates);
    if (counts.new + counts.changed === 0) {
      await markCourseSeen(store, updatedAt, 0); // nothing in it for them
      return null;
    }
    const updated = typeof seen !== 'number' || seen < updatedAt;
    const missingMore = counts.new > (typeof seenMissing === 'number' ? seenMissing : 0);
    if (!updated && !missingMore) return null;
    // "Updated on <date>" only when it really was updated since they looked.
    return { updatedAt, counts, firstLook: typeof seen !== 'number' || !updated };
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
          void markCourseSeen(store, n.updatedAt, n.counts.new)
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
