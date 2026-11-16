// Moves CHANGELOG.md's Unreleased entries under a new version heading.
//   node tools/stamp-changelog.ts <version> <YYYY-MM-DD>
import { readFile, writeFile } from 'node:fs/promises';
import { stampRelease } from './changelog.ts';

const [version, date] = process.argv.slice(2);
if (!version || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error('usage: node tools/stamp-changelog.ts <version> <YYYY-MM-DD>');
  process.exit(2);
}
const md = await readFile('CHANGELOG.md', 'utf8');
await writeFile('CHANGELOG.md', stampRelease(md, version, date));
console.log(`CHANGELOG.md: Unreleased → ${version} (${date})`);
