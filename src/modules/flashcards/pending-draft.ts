import type { CardKind } from '../../core/db/model';

/**
 * A new card handed over from a quick "Add a card" popup to the full editor (Add page),
 * so the student can keep going there with auto-fill, audio and the field checks.
 * Kept only in memory and taken once: reloading the Add page starts empty.
 */
export interface PendingDraft {
  kind: CardKind;
  deckId: string;
  traditional: string;
  simplified: string;
  pinyin: string;
  meaning: string;
  notes: string;
  tags: readonly string[];
}

let pending: PendingDraft | null = null;

export function setPendingDraft(draft: PendingDraft): void {
  pending = draft;
}

/** The handed-over card, if any (only once). */
export function takePendingDraft(): PendingDraft | null {
  const draft = pending;
  pending = null;
  return draft;
}
