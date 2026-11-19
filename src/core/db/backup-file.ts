import { parseBackup, type ParseResult } from './backup-schema';
import { LIMITS } from './model';

/**
 * Backup files on disk. New backups are gzip-compressed (`.json.gz`, about a tenth of the
 * size); plain `.json` backups, from older versions or unpacked by the browser, still
 * import. Whichever it is, the text inside is limited to LIMITS.importBytes, and
 * decompression stops as soon as it goes past that (so a tiny "zip bomb" can't fill
 * memory).
 */

export const MB = 1024 * 1024;

/** Whole megabytes, for messages: "200 MB". */
export const formatLimit = (bytes: number): string => `${Math.round(bytes / MB)} MB`;

/** File sizes for messages: "0.4 MB", "12 MB". */
export function formatSize(bytes: number): string {
  const mb = bytes / MB;
  return mb < 10 ? `${Math.max(mb, 0.1).toFixed(1)} MB` : `${Math.round(mb)} MB`;
}

function isGzip(head: Uint8Array): boolean {
  return head.length >= 2 && head[0] === 0x1f && head[1] === 0x8b;
}

export const canCompress = (): boolean => typeof CompressionStream === 'function';

/** Compresses backup text for download. Falls back to plain JSON where gzip isn't available. */
export async function encodeBackupFile(
  text: string,
): Promise<{ blob: Blob; extension: '.json.gz' | '.json' }> {
  const json = new Blob([text], { type: 'application/json' });
  if (!canCompress()) return { blob: json, extension: '.json' };
  const gz = await new Response(json.stream().pipeThrough(new CompressionStream('gzip'))).blob();
  return { blob: new Blob([gz], { type: 'application/gzip' }), extension: '.json.gz' };
}

const tooLarge = (max: number): ParseResult => ({
  ok: false,
  errors: [`It is larger than ${formatLimit(max)}, which is more than a backup from this portal can hold.`],
});

/** Reads at most `max` bytes of decompressed text; null if there is more. */
async function gunzipText(file: Blob, max: number): Promise<string | null> {
  const reader = file.stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** Reads and checks a backup file (gzip or plain JSON). Never throws. */
export async function readBackupFile(file: Blob, max: number = LIMITS.importBytes): Promise<ParseResult> {
  if (file.size > max) return tooLarge(max);
  try {
    const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
    if (!isGzip(head)) return parseBackup(await file.text(), max);
    if (typeof DecompressionStream !== 'function') {
      return {
        ok: false,
        errors: ['This browser cannot open compressed backups. Update it, or try another browser.'],
      };
    }
    const text = await gunzipText(file, max);
    return text === null ? tooLarge(max) : parseBackup(text, max);
  } catch {
    return { ok: false, errors: ['The file is damaged or is not a backup.'] };
  }
}
