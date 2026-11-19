# Security

## Reporting a vulnerability

Please use GitHub's **private vulnerability reporting** (Security tab → "Report a vulnerability").
Do not open a public issue for security problems.

## Design

The portal is a fully static site. There is no server, no account system, no database, and no API key.

- **Student data** (cards, review history, settings) lives only in the student's own browser
  (IndexedDB and localStorage). It is never sent anywhere. Backups are files the student downloads.
- **No third-party requests.** No CDNs, web fonts, analytics, or trackers. Every file is served from
  the portal's own origin.
- **Content Security Policy** (delivered as `<meta>`, because GitHub Pages cannot set headers):
  `default-src 'none'`, scripts/styles/images only from `'self'`, no inline script or style,
  `base-uri 'none'`, `form-action 'none'`, and **Trusted Types enforced**
  (`require-trusted-types-for 'script'`). The only Trusted Types policy is `sw-url`, which accepts
  nothing but the service worker's fixed URL.
- **No HTML rendering of data.** All text is rendered through Preact as text nodes. ESLint bans
  `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`,
  and `new Function`; Trusted Types blocks them in the browser as a second layer.
- **Imported backup files** are size-limited and validated against a strict schema (allowed keys
  only, per-field length limits, record-count limits) before anything is written. Compressed
  backups are decompressed as a stream that stops as soon as the text passes the size limit, so a
  small "zip bomb" file can't fill memory.
- **External links** must be `https:` (checked at build time and again at render time) and open with
  `rel="noopener noreferrer"`.
- **Supply chain:** few runtime dependencies, exact version pins, lockfile, `ignore-scripts=true`,
  `npm audit` and `npm audit signatures` in CI, Dependabot, and GitHub Actions pinned to commit SHAs with
  least-privilege permissions.

## Known limitations (accepted risks)

These come from GitHub Pages not allowing custom HTTP headers:

| Missing header                                                 | Mitigation                                                                                                                                                                        |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy: frame-ancestors` / `X-Frame-Options` | `theme-init.js` detects framing and hides the whole UI; the app has no one-click sensitive actions.                                                                               |
| `Strict-Transport-Security`                                    | GitHub Pages "Enforce HTTPS" redirect, plus the `.dev` top-level domain is on every major browser's HSTS preload list, so browsers never connect to shuijiao.dev over plain HTTP. |
| `Permissions-Policy`, `Cross-Origin-Opener-Policy`             | No powerful features are used; no cross-origin windows are opened with an opener.                                                                                                 |

## Service worker kill switch

If a bad service worker is ever deployed (for example, one that keeps serving a broken version),
replace it with [`tools/sw-kill-switch.js`](tools/sw-kill-switch.js), which deletes the portal's
caches and unregisters itself. Study data in IndexedDB is not touched.

1. On GitHub: **Actions → CI and deploy → Run workflow**, tick **Emergency: replace the service
   worker…**, and run it on `main`. It builds and tests the site as usual, then deploys it with
   the kill switch as `sw.js`.
2. Students pick it up on their next visit (browsers always check `sw.js` for changes). Open tabs
   show "The portal was updated in another tab. Reload this tab to keep going."
3. Once a fixed version is ready, release it as usual; it brings the service worker back.

`tests/unit/sw.test.ts` checks that the kill switch does exactly this and never reloads pages
(the portal registers `sw.js` on every visit, so that would loop).
