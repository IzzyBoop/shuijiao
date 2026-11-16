# 水餃 (Shuǐjiǎo)

A Mandarin flashcard portal for our course, hosted at **https://shuijiao.dev**. It shows traditional characters first, with simplified
characters, pinyin, a meaning, and spoken pronunciation. Students add their own cards, choose
which fields go on the front and back of each card, and review them with spaced repetition (FSRS).

**Everything stays in the student's browser.** There are no accounts and no server. Students can
download a backup file and import it on another device. The portal also works offline and can be
installed to a phone's home screen.

## Development

Requires Node 24+ and [gitleaks](https://github.com/gitleaks/gitleaks) for the commit hook.

```sh
npm ci             # install exact locked versions (install scripts are disabled)
npm run dev        # local dev server at http://127.0.0.1:5173
npm run check      # lint + typecheck + format check + unit tests
npm run build      # production build into dist/, then scans it for leaked paths/emails
npm run preview    # serve dist/ at http://127.0.0.1:4173
npx playwright install chromium   # once, for end-to-end tests
npm run e2e        # end-to-end tests against the production build
```

## Project layout

```
src/core/       app shell: module registry, router, theme, database, language services, safety helpers
src/modules/    one folder per feature (flashcards, resources, settings, about)
src/content/    resources.json: the curated external links shown under "Resources"
public/         static files copied as-is (theme-init.js, icons, manifest, dictionary index)
tools/          build scripts (dictionary builder, service worker template, output checks)
tests/          unit tests (Vitest) and end-to-end tests (Playwright)
```

### Adding a feature module

1. Create `src/modules/<name>/index.tsx` exporting a `PortalModule` (see `src/core/modules.ts`).
2. Add it to the list in `src/core/registry.ts`.

The navigation bar and routes are built from that list.

### Editing the Resources links

Edit `src/content/resources.json`. Every link must be `https://`; `npm run build` fails otherwise.

## Commit rules

- Commits use the GitHub no-reply address and UTC times. Run commits as `TZ=UTC git commit ...`.
  The pre-commit hook refuses anything else and runs gitleaks.
- Messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat(flashcards): ...`).

See [SECURITY.md](SECURITY.md) for the security design.

## Licenses

Code: MIT. Dictionary data: [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict),
CC BY-SA 4.0.
