import { useEffect, useState } from 'preact/hooks';
import { isPageSize, PAGE_SIZES, updateStudyPrefs, useStudyPrefs } from '../study-prefs';

export interface Paging<T> {
  /** The items on the current page. */
  shown: T[];
  page: number;
  pages: number;
  total: number;
  /** Index of the first item on the page. */
  start: number;
  setPage: (page: number) => void;
}

/**
 * Splits a list into pages of the student's chosen size (shared by every card list).
 * Goes back to the first page whenever one of `resetOn` changes, e.g. a new search.
 */
export function usePaging<T>(items: readonly T[], resetOn: readonly unknown[]): Paging<T> {
  const { pageSize } = useStudyPrefs();
  const [page, setPage] = useState(0);
  useEffect(() => {
    setPage(0);
  }, [...resetOn, pageSize]);

  const size = pageSize === 0 ? Math.max(1, items.length) : pageSize;
  const pages = Math.max(1, Math.ceil(items.length / size));
  // After deleting cards the page may no longer exist: show the last one instead.
  const current = Math.min(page, pages - 1);
  const start = current * size;
  return {
    shown: items.slice(start, start + size),
    page: current,
    pages,
    total: items.length,
    start,
    setPage,
  };
}

/**
 * "Show [50] per page · 1–50 of 93 · ← Previous  Page 1 of 2  Next →".
 * The copy below a list (`bottom`) leaves out the size picker and, on a page change,
 * scrolls back up to the element with id `topId`.
 */
export function Pager<T>({
  paging,
  label,
  bottom = false,
  topId,
}: {
  paging: Paging<T>;
  /** Names the pager for screen readers, e.g. "Card pages". */
  label: string;
  bottom?: boolean;
  topId?: string;
}) {
  const { pageSize } = useStudyPrefs();
  const { page, pages, total, start, shown, setPage } = paging;
  // Short lists don't need paging at all.
  if (total <= (PAGE_SIZES[0] as number)) return null;
  if (bottom && pages <= 1) return null;

  const go = (next: number) => {
    setPage(next);
    if (bottom && topId) document.getElementById(topId)?.scrollIntoView({ block: 'start' });
  };

  return (
    <nav class="pager" aria-label={bottom ? `${label}, bottom` : label}>
      {!bottom && (
        <label class="pager-size small">
          Show
          <select
            value={String(pageSize)}
            onChange={(e) => {
              const v = Number(e.currentTarget.value);
              if (isPageSize(v)) updateStudyPrefs({ pageSize: v });
            }}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={String(n)}>
                {n === 0 ? 'All' : n}
              </option>
            ))}
          </select>
          per page
        </label>
      )}
      <span class="small muted">
        {start + 1}–{start + shown.length} of {total}
      </span>
      {pages > 1 && (
        <span class="pager-nav">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => {
              go(page - 1);
            }}
          >
            ← Previous
          </button>
          <span class="small">
            Page {page + 1} of {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages - 1}
            onClick={() => {
              go(page + 1);
            }}
          >
            Next →
          </button>
        </span>
      )}
    </nav>
  );
}
