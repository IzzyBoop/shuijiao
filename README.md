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
src/modules/    one folder per feature (flashcards, course, resources, settings, about)
src/content/    resources.json: the curated external links shown under "Resources"
public/         static files copied as-is (theme-init.js, icons, manifest, dictionary index,
                course/course-deck.json: the course cards)
tools/          build scripts (dictionary builder, service worker template, output checks)
tests/          unit tests (Vitest) and end-to-end tests (Playwright)
```

### Adding a feature module

1. Create `src/modules/<name>/index.tsx` exporting a `PortalModule` (see `src/core/modules.ts`).
2. Add it to the list in `src/core/registry.ts`.

The navigation bar and routes are built from that list.

### Editing the Resources links

Edit `src/content/resources.json`. Every link must be `https://`; `npm run build` fails otherwise.

### Updating the course cards

Students see these under **Course cards** on the Study page. To publish a new set, download a
backup in Settings, then:

```sh
npm run course -- ~/Downloads/shuijiao-backup-YYYY-MM-DD.json.gz
npm test
```

This writes `public/course/course-deck.json` with only the live decks and cards (study progress,
review history, links, and card types are left out) and lists any card notes, since those are
published too. Everything in that file is public once it's pushed.

## Versions and releases

Versions follow [Semantic Versioning](https://semver.org/): `0.1.0-beta.1`, `0.1.0-beta.2`, … then
`0.1.0`. The current version is shown in the app's footer and on the About page, together with
"What's new", which is built from [CHANGELOG.md](CHANGELOG.md).

1. As you make changes, add a line for each under `## [Unreleased]` in `CHANGELOG.md`
   (sections: Added, Changed, Fixed, Removed, Security, Known issues).
2. To release, with everything committed, run:

   ```sh
   tools/release.sh 0.1.0-beta.2
   ```

   It stamps the version and today's date (UTC) into `package.json` and the changelog, runs
   every check, build, and end-to-end test, then creates a `chore(release)` commit and an
   annotated tag `v0.1.0-beta.2`. If anything fails, it puts the files back. It never pushes.

3. Publish with `git push --follow-tags`.

A production build fails if the version in `package.json` has no changelog entry.

## Commit rules

- Commits use the GitHub no-reply address and UTC times. Run commits as `TZ=UTC git commit ...`.
  The pre-commit hook refuses anything else and runs gitleaks.
- Messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat(flashcards): ...`).

See [SECURITY.md](SECURITY.md) for the security design.

## Licenses

Code: MIT. Dictionary data: [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict),
CC BY-SA 4.0.
