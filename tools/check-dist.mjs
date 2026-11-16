// Scans the production build for leaked personal data and CSP regressions.
// Fails the build (exit 1) on any finding.
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { homedir } from 'node:os';

const DIST = 'dist';
const problems = [];

const entries = await readdir(DIST, { withFileTypes: true, recursive: true });
const files = entries.filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));

const forbidden = [
  { re: /\/Users\/[A-Za-z]/, why: 'macOS home-directory path' },
  { re: /\/home\/[a-z][a-z0-9_-]*\//, why: 'Linux home-directory path' },
  { re: /[A-Za-z]:\\Users\\/, why: 'Windows home-directory path' },
  { re: /file:\/\//, why: 'file:// URL' },
  { re: /@gmail\.com|@icloud\.com|@outlook\.com|@hotmail\.com|@yahoo\.com/i, why: 'personal email address' },
];
const home = homedir();

for (const file of files) {
  const rel = relative(DIST, file);
  if (rel.endsWith('.map')) problems.push(`${rel}: source map in production build`);
  if (!/\.(html|js|mjs|css|json|webmanifest|txt|svg)$/.test(rel)) continue;
  const text = await readFile(file, 'utf8');
  if (home.length > 1 && text.includes(home)) problems.push(`${rel}: contains the build machine's home path`);
  for (const { re, why } of forbidden) {
    if (re.test(text)) problems.push(`${rel}: ${why}`);
  }
}

const html = await readFile(join(DIST, 'index.html'), 'utf8');
if (!html.includes('http-equiv="Content-Security-Policy"')) problems.push('index.html: CSP meta tag missing');
if (!html.includes("require-trusted-types-for 'script'"))
  problems.push('index.html: Trusted Types not enforced');
// Case-insensitive: HTML tag and attribute names are, so <SCRIPT> must be caught too.
for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
  if (!/\bsrc\s*=/i.test(m[1] ?? '')) problems.push('index.html: inline <script> (blocked by CSP)');
}
if (/<style\b/i.test(html) || /\sstyle\s*=/i.test(html))
  problems.push('index.html: inline style (blocked by CSP)');

if (problems.length) {
  console.error('check-dist: build output failed the leak/CSP check:');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log(`check-dist: ${files.length} files clean.`);
