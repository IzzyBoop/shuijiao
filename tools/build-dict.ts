// Builds the compact dictionary index used for auto-fill.
//
//   npm run dict            download the latest CC-CEDICT and rebuild
//   npm run dict -- FILE    rebuild from a local cedict_ts.u8 (or .gz) file
//
// Output:
//   public/dict/cedict.<hash>.txt   one entry per line: trad \t simp ("=" if same) \t pinyin \t glosses
//   src/core/lang/dict-meta.json    file name, entry count, source date and SHA-256
//
// CC-CEDICT is licensed CC BY-SA 4.0 (see LICENSE).
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const SOURCE_URL = 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz';
const CACHE_DIR = 'tools/.cache';
const OUT_DIR = 'public/dict';
const META_FILE = 'src/core/lang/dict-meta.json';
const MAX_BYTES = 64 * 1024 * 1024;

async function loadSource(): Promise<Buffer> {
  const local = process.argv[2];
  if (local) return readFile(local);
  console.log(`Downloading ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL, { redirect: 'error' });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error('Download unexpectedly large');
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(`${CACHE_DIR}/cedict.txt.gz`, buf);
  return buf;
}

const VARIANT_ONLY = /^(old|archaic|Japanese|obscure|ancient|erroneous)? ?variant of /i;
const LINE = /^(\S+) (\S+) \[([^\]]*)\] \/(.*)\/\s*$/;

const raw = await loadSource();
const isGzip = raw[0] === 0x1f && raw[1] === 0x8b;
const text = (isGzip ? gunzipSync(raw, { maxOutputLength: MAX_BYTES }) : raw).toString('utf8');
const sourceSha256 = createHash('sha256').update(text).digest('hex');
const sourceDate = /^#! date=(\S+)/m.exec(text)?.[1] ?? 'unknown';

const out: string[] = [];
for (const line of text.split('\n')) {
  if (line.startsWith('#') || line.trim() === '') continue;
  const m = LINE.exec(line);
  if (!m) continue;
  const [, trad = '', simp = '', pinyin = '', defs = ''] = m;
  const glosses = defs.split('/').filter((g) => g.trim() !== '');
  if (glosses.length === 0 || glosses.every((g) => VARIANT_ONLY.test(g))) continue;
  const clean = (s: string) => s.replace(/[\t\r\n]/g, ' ');
  out.push(
    [clean(trad), simp === trad ? '=' : clean(simp), clean(pinyin), glosses.map(clean).join('/')].join('\t'),
  );
}

if (out.length < 50_000) throw new Error(`Only ${out.length} entries parsed; refusing to write.`);

const body = out.join('\n') + '\n';
const hash = createHash('sha256').update(body).digest('hex').slice(0, 12);
const fileName = `cedict.${hash}.txt`;

await mkdir(OUT_DIR, { recursive: true });
for (const f of await readdir(OUT_DIR)) {
  if (/^cedict\..*\.txt$/.test(f) && f !== fileName) await rm(`${OUT_DIR}/${f}`);
}
await writeFile(`${OUT_DIR}/${fileName}`, body);
await writeFile(
  META_FILE,
  JSON.stringify({ file: `dict/${fileName}`, entries: out.length, sourceDate, sourceSha256 }, null, 2) + '\n',
);
console.log(
  `Wrote ${OUT_DIR}/${fileName}: ${out.length} entries (${(body.length / 1e6).toFixed(1)} MB), source ${sourceDate}`,
);
