import type { Backup } from '../../core/db/backup-schema';

/**
 * The backup a student picked in Settings, waiting on the Import page. Kept only in
 * memory: reloading the page drops it, and nothing is written until "Import".
 */
export interface PendingImport {
  backup: Backup;
  fileName: string;
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
