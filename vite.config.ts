/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

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
        .filter((f) => f !== 'sw.js' && !f.startsWith('dict/') && f !== 'CNAME' && f !== '.nojekyll')
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

export default defineConfig({
  base: './',
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'preact' },
  },
  plugins: [cspPlugin(), serviceWorkerPlugin()],
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
