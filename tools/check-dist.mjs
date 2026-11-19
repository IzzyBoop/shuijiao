// Scans the production build for leaked personal data, CSP regressions, and a startup
// bundle that has grown too big.
// Fails the build (exit 1) on any finding.
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { homedir } from 'node:os';
import { gzipSync } from 'node:zlib';

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

// The code every page load needs (the entry script and what it preloads) stays small:
// the heavy language libraries load only when a feature needs them (auto-fill, the
// word-by-word meanings). v1.1.0 accidentally pulled pinyin-pro back in.
const ENTRY_BUDGET_GZIP = 120 * 1024;
const HEAVY_LIBRARIES = [
  { name: 'pinyin-pro', markers: ['numToSymbol', 'toneType'] },
  { name: 'opencc-js', markers: ['normalizationChain'] },
];
const startup = [
  ...[...html.matchAll(/<script\b[^>]*\btype="module"[^>]*\bsrc="\.\/([^"]+)"/gi)].map((m) => m[1]),
  ...[...html.matchAll(/<link\b[^>]*\brel="modulepreload"[^>]*\bhref="\.\/([^"]+)"/gi)].map((m) => m[1]),
];
if (startup.length === 0) problems.push('index.html: no module entry script found');
let startupGzip = 0;
for (const rel of startup) {
  const code = await readFile(join(DIST, rel));
  startupGzip += gzipSync(code).length;
  const text = code.toString('utf8');
  for (const { name, markers } of HEAVY_LIBRARIES) {
    if (markers.some((m) => text.includes(m)))
      problems.push(`${rel}: ${name} is in the startup bundle; import it lazily`);
  }
}
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
if (startupGzip > ENTRY_BUDGET_GZIP) {
  problems.push(`startup bundle is ${kb(startupGzip)} gzipped, over the ${kb(ENTRY_BUDGET_GZIP)} budget`);
}

if (problems.length) {
  console.error('check-dist: the build output failed its checks:');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log(`check-dist: ${files.length} files clean; startup bundle ${kb(startupGzip)} gzipped.`);
