/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { parseChangelog } from './tools/changelog.ts';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

/**
 * Content Security Policy for production builds. GitHub Pages cannot send
 * HTTP headers, so this is delivered as a <meta> tag. `frame-ancestors`
 * cannot be set this way; framing is handled in public/theme-init.js.
 *
 * Trusted Types: only one policy (`sw-url`) may exist. It is used to register
 * the service worker and accepts nothing but the fixed worker URL.
 */
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "require-trusted-types-for 'script'",
  'trusted-types sw-url',
  'upgrade-insecure-requests',
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'portal:csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`;
        return html.replace('<!-- CSP -->', meta);
      },
    },
  };
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)).split(sep).join('/'));
}

/**
 * Writes dist/sw.js from tools/sw-template.js with the list of app-shell
 * files to precache and a version derived from their contents.
 */
function serviceWorkerPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'portal:service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    async closeBundle() {
      const files = (await listFiles(outDir))
        // Big files are left out: the dictionary is cached on first use, videos are never cached.
        .filter(
          (f) =>
            f !== 'sw.js' &&
            !f.startsWith('dict/') &&
            !f.startsWith('media/') &&
            // Stroke order (9,500 small files): each cached when first viewed.
            !f.startsWith('strokes/') &&
            // Fonts (墨 Ink's, and Chinese ones for phones): cached when first used.
            !f.endsWith('.woff2') &&
            !f.startsWith('fonts/cjk/') &&
            f !== 'CNAME' &&
            f !== '.nojekyll',
        )
        .sort();
      const hash = createHash('sha256');
      for (const f of files) hash.update(f).update(await readFile(join(outDir, f)));
      const version = hash.digest('hex').slice(0, 16);
      const precache = ['./', ...files.map((f) => `./${f}`)];
      const template = await readFile('tools/sw-template.js', 'utf8');
      const sw = template
        .replace('__VERSION__', JSON.stringify(version))
        .replace('__PRECACHE__', JSON.stringify(precache, null, 2));
      await writeFile(join(outDir, 'sw.js'), sw);
    },
  };
}

/**
 * Stroke order data (hanzi-writer-data, Arphic Public License) served as
 * strokes/<code point in hex>.json, e.g. strokes/6211.json for 我: plain ASCII names, so
 * no Chinese file names reach the host or the offline cache. Copied from the pinned npm
 * package at build time (nothing is committed); the dev server serves it straight from
 * the package. Students fetch each character's file when they first view it.
 */
const STROKES_SRC = 'node_modules/hanzi-writer-data';
function strokesPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'portal:strokes',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    configureServer(server) {
      server.middlewares.use('/strokes/', (req, res, next) => {
        const match = /^\/([0-9a-f]{4,5})\.json$/.exec(req.url ?? '');
        if (!match?.[1]) {
          next();
          return;
        }
        const char = String.fromCodePoint(parseInt(match[1], 16));
        readFile(join(STROKES_SRC, `${char}.json`)).then(
          (body) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(body);
          },
          () => {
            res.statusCode = 404;
            res.end();
          },
        );
      });
    },
    async closeBundle() {
      const dir = join(outDir, 'strokes');
      await mkdir(dir, { recursive: true });
      for (const file of await readdir(STROKES_SRC)) {
        const chars = [...file.replace(/\.json$/, '')];
        if (!file.endsWith('.json') || chars.length !== 1) continue;
        const code = chars[0]?.codePointAt(0)?.toString(16);
        if (code) await copyFile(join(STROKES_SRC, file), join(dir, `${code}.json`));
      }
      await copyFile(join(STROKES_SRC, 'ARPHICPL.TXT'), join(dir, 'LICENSE-ArphicPL.txt'));
    },
  };
}

/**
 * Chinese fonts for the Serif and Handwriting character styles, for devices without one
 * (phones have neither). Each font comes split into ~100 pieces by Unicode range; they go
 * to fonts/cjk/<package>-<version>/, with one stylesheet per style. The app adds a
 * stylesheet only when its style is chosen (src/core/theme/cjk-fonts.ts), and each font is
 * listed after the device's own fonts, so the browser fetches a piece only when no
 * installed font has the character, and only the pieces for characters it shows. The
 * service worker keeps them for offline use. All SIL Open Font License.
 */
const CJK_FONTS = [
  { sheet: 'serif', family: 'Shuijiao Serif TC', pkg: 'noto-serif-tc', weight: 500 },
  { sheet: 'serif', family: 'Shuijiao Serif SC', pkg: 'noto-serif-sc', weight: 500 },
  { sheet: 'kai', family: 'Shuijiao Kai', pkg: 'lxgw-wenkai-tc', weight: 400 },
] as const;

function buildCjkFonts() {
  const css = new Map<string, string[]>();
  const copies: { from: string; to: string }[] = [];
  for (const font of CJK_FONTS) {
    const dir = `node_modules/@fontsource/${font.pkg}`;
    const { version } = JSON.parse(readFileSync(`${dir}/package.json`, 'utf8')) as { version: string };
    const sub = `${font.pkg}-${version}`;
    const rules = css.get(font.sheet) ?? [];
    for (const [, body = ''] of readFileSync(`${dir}/${font.weight}.css`, 'utf8').matchAll(
      /@font-face\s*{([^}]*)}/g,
    )) {
      // Only the numbered pieces (Chinese); Latin and others come from the page's own fonts.
      const file = /url\(\.\/files\/([\w-]+-\d+-\d+-normal\.woff2)\)/.exec(body)?.[1];
      const range = /unicode-range:\s*([^;}]+)/.exec(body)?.[1]?.trim();
      if (!file || !range) continue;
      rules.push(
        `@font-face{font-family:'${font.family}';font-style:normal;font-display:swap;font-weight:100 900;` +
          `src:url(./${sub}/${file}) format('woff2');unicode-range:${range}}`,
      );
      copies.push({ from: join(dir, 'files', file), to: `${sub}/${file}` });
    }
    copies.push({ from: join(dir, 'LICENSE'), to: `${sub}/LICENSE.txt` });
    css.set(font.sheet, rules);
  }
  const sheets: Record<string, string> = {};
  const files = new Map<string, string>();
  for (const [sheet, rules] of css) {
    const text = `/* Generated by vite.config.ts from @fontsource packages (SIL Open Font License). */\n${rules.join('\n')}\n`;
    const name = `${sheet}-${createHash('sha256').update(text).digest('hex').slice(0, 10)}.css`;
    sheets[sheet] = `fonts/cjk/${name}`;
    files.set(name, text);
  }
  return { sheets, files, copies };
}
const CJK = buildCjkFonts();

function cjkFontsPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'portal:cjk-fonts',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    configureServer(server) {
      server.middlewares.use('/fonts/cjk/', (req, res, next) => {
        const path = decodeURIComponent((req.url ?? '').split('?')[0] ?? '').replace(/^\//, '');
        const sheet = CJK.files.get(path);
        if (sheet !== undefined) {
          res.setHeader('Content-Type', 'text/css');
          res.end(sheet);
          return;
        }
        const copy = CJK.copies.find((c) => c.to === path);
        if (!copy) {
          next();
          return;
        }
        readFile(copy.from).then(
          (body) => {
            res.setHeader('Content-Type', 'font/woff2');
            res.end(body);
          },
          () => {
            res.statusCode = 404;
            res.end();
          },
        );
      });
    },
    async closeBundle() {
      const dir = join(outDir, 'fonts', 'cjk');
      for (const { from, to } of CJK.copies) {
        await mkdir(join(dir, to, '..'), { recursive: true });
        await copyFile(from, join(dir, to));
      }
      for (const [name, text] of CJK.files) await writeFile(join(dir, name), text);
    },
  };
}

/**
 * Exposes CHANGELOG.md to the app as `virtual:changelog` (released versions only,
 * as plain text). A production build fails if package.json's version has no
 * changelog entry, so every shipped version is documented.
 */
function changelogPlugin(): Plugin {
  const id = 'virtual:changelog';
  const resolved = '\0' + id;
  let isBuild = false;
  return {
    name: 'portal:changelog',
    configResolved(config) {
      isBuild = config.command === 'build';
    },
    resolveId(source) {
      return source === id ? resolved : null;
    },
    load(source) {
      if (source !== resolved) return null;
      // Absolute path: in dev, a relative one is mistaken for an import of the virtual module.
      const file = resolve('CHANGELOG.md');
      this.addWatchFile(file);
      const releases = parseChangelog(readFileSync(file, 'utf8')).filter((r) => r.version !== 'Unreleased');
      if (isBuild && !releases.some((r) => r.version === pkg.version)) {
        this.error(`CHANGELOG.md has no entry for version ${pkg.version}. Use tools/release.sh to release.`);
      }
      return `export default ${JSON.stringify(releases)};`;
    },
  };
}

/**
 * The version shown in the app comes from package.json, which is read when the dev
 * server starts. Restart the dev server when package.json changes (for example after
 * tools/release.sh), so it never shows an old version.
 */
function restartOnPackageChange(): Plugin {
  return {
    name: 'portal:restart-on-package-change',
    apply: 'serve',
    configureServer(server) {
      const file = resolve('package.json');
      server.watcher.add(file);
      server.watcher.on('change', (changed) => {
        if (resolve(changed) === file) void server.restart();
      });
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __CJK_FONT_SHEETS__: JSON.stringify(CJK.sheets),
  },
  base: './',
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'preact' },
  },
  plugins: [
    cspPlugin(),
    strokesPlugin(),
    cjkFontsPlugin(),
    serviceWorkerPlugin(),
    changelogPlugin(),
    restartOnPackageChange(),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    reportCompressedSize: false,
    // The lazily loaded language tools (OpenCC tables + pinyin data) are ~1.5 MB by design.
    chunkSizeWarningLimit: 1600,
  },
  server: {
    host: '127.0.0.1',
  },
  preview: {
    host: '127.0.0.1',
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
