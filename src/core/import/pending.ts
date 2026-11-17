import type { Backup } from '../db/backup-schema';

/**
 * Cards waiting on the Import page: a backup file the student picked, or the course
 * cards. Kept only in memory: reloading the page drops it, and nothing is written
 * until "Import".
 */
export interface PendingImport {
  backup: Backup;
  /** A student's own backup file, or the course cards published on the site. */
  source: 'backup' | 'course';
  /** Shown beside the page title: the file name, or when the course cards were updated. */
  label: string;
  /** Where Cancel and the "Back to" link on the Import page go. */
  back: { path: string; label: string };
}

let pending: PendingImport | null = null;

export function setPendingImport(value: PendingImport): void {
  pending = value;
}

export function getPendingImport(): PendingImport | null {
  return pending;
}

export function clearPendingImport(): void {
  pending = null;
}
