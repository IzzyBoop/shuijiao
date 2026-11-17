/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
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
  },
  base: './',
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'preact' },
  },
  plugins: [cspPlugin(), serviceWorkerPlugin(), changelogPlugin(), restartOnPackageChange()],
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
