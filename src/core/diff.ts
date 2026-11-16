/**
 * A small text diff for showing what changed between two versions of a card.
 * Chinese is compared character by character; other text word by word (spaces and
 * punctuation are their own tokens), which keeps highlights readable.
 */

export interface DiffSegment {
  text: string;
  /** True if this text is only in this version. */
  changed: boolean;
}

const TOKEN = /\p{Script=Han}|[\p{L}\p{N}\p{M}'’]+|\s+|[^\s]/gu;
/** Above this many token comparisons, mark the whole text as changed instead. */
const MAX_CELLS = 250_000;

export function tokenize(text: string): string[] {
  return text.match(TOKEN) ?? [];
}

function merge(tokens: readonly { text: string; changed: boolean }[]): DiffSegment[] {
  const out: DiffSegment[] = [];
  for (const t of tokens) {
    const last = out.at(-1);
    if (last?.changed === t.changed) last.text += t.text;
    else out.push({ text: t.text, changed: t.changed });
  }
  return out;
}

/** Splits `before` and `after` into segments, marking the text unique to each. */
export function diffText(before: string, after: string): { before: DiffSegment[]; after: DiffSegment[] } {
  if (before === after) {
    const same = before ? [{ text: before, changed: false }] : [];
    return { before: same, after: same };
  }
  const a = tokenize(before);
  const b = tokenize(after);
  if (a.length * b.length > MAX_CELLS) {
    return {
      before: before ? [{ text: before, changed: true }] : [],
      after: after ? [{ text: after, changed: true }] : [],
    };
  }
  // Longest common subsequence table, filled from the end.
  const w = b.length + 1;
  const lcs = new Uint32Array((a.length + 1) * w);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i * w + j] =
        a[i] === b[j]
          ? (lcs[(i + 1) * w + j + 1] ?? 0) + 1
          : Math.max(lcs[(i + 1) * w + j] ?? 0, lcs[i * w + j + 1] ?? 0);
    }
  }
  const outA: { text: string; changed: boolean }[] = [];
  const outB: { text: string; changed: boolean }[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const ta = a[i] ?? '';
    const tb = b[j] ?? '';
    if (ta === tb) {
      outA.push({ text: ta, changed: false });
      outB.push({ text: tb, changed: false });
      i++;
      j++;
    } else if ((lcs[(i + 1) * w + j] ?? 0) >= (lcs[i * w + j + 1] ?? 0)) {
      outA.push({ text: ta, changed: true });
      i++;
    } else {
      outB.push({ text: tb, changed: true });
      j++;
    }
  }
  for (; i < a.length; i++) outA.push({ text: a[i] ?? '', changed: true });
  for (; j < b.length; j++) outB.push({ text: b[j] ?? '', changed: true });
  return { before: merge(outA), after: merge(outB) };
}
