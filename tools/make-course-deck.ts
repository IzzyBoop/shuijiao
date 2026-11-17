// Turns one of your backups into the course cards that students can look through and
// import from the Study page.
//
//   npm run course -- ~/Downloads/shuijiao-backup-2026-11-17.json
//
// Only decks and cards that aren't deleted are kept. Study progress, review history,
// links, and card types are left out, so nothing about your own studying is published.
// tests/unit/course-deck.test.ts then checks the result against the backup schema.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const OUT = 'public/course/course-deck.json';

interface Row {
  id: string;
  deleted: 0 | 1;
}
interface Deck extends Row {
  name: string;
}
interface Card extends Row {
  deckId: string;
  kind: string;
  traditional: string;
  notes: string;
}
interface BackupFile {
  format: string;
  version: number;
  exportedAt: number;
  decks: Deck[];
  cards: Card[];
}

const path = process.argv[2];
if (!path) {
  console.error('Usage: npm run course -- <backup file>');
  process.exit(1);
}

const backup = JSON.parse(await readFile(path, 'utf8')) as BackupFile;
if (backup.format !== 'shuijiao-backup' || backup.version !== 1) {
  console.error(`${path} is not a 水餃 backup file.`);
  process.exit(1);
}

const cards = backup.cards.filter((c) => c.deleted === 0);
const used = new Set(cards.map((c) => c.deckId));
const decks = backup.decks.filter((d) => d.deleted === 0 && used.has(d.id));
if (cards.length === 0) {
  console.error('That backup has no cards.');
  process.exit(1);
}

const course = {
  format: backup.format,
  version: backup.version,
  // When the backup was made: shown to students as "last updated".
  exportedAt: backup.exportedAt,
  decks,
  cards,
  templates: [],
  reviewStates: [],
  reviewLogs: [],
  links: [],
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(course) + '\n');

console.log(
  `Wrote ${OUT}: ${cards.length} cards in ${decks.length} decks, updated ${new Date(backup.exportedAt).toLocaleString()}.`,
);
for (const d of decks) console.log(`  ${d.name}: ${cards.filter((c) => c.deckId === d.id).length}`);
const loose = cards.filter((c) => !decks.some((d) => d.id === c.deckId)).length;
if (loose > 0) console.log(`  (no deck, imported into "My cards"): ${loose}`);
const withNotes = cards.filter((c) => c.notes.trim() !== '');
if (withNotes.length > 0) {
  console.log(
    `\nThese cards have notes, which are published too: ${withNotes.map((c) => c.traditional).join(', ')}`,
  );
}
console.log('\nEverything in this file is public once pushed. Next: npm test, then commit.');
