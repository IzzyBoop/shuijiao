# Repository and hosting security checklist

Settings that live on GitHub or at the domain registrar, not in code. Work through this
once when the repository is created, and re-check it before any pentest.

## GitHub account

- [ ] Two-factor authentication is on (a passkey or security key is best).
- [ ] Settings → Emails → "Keep my email addresses private" and "Block command line pushes that
      expose my email" are both on.

## Repository settings

- [ ] **Settings → General:** turn off Wikis and Projects if unused. Allow only squash or rebase merges.
- [ ] **Settings → Rules → Rulesets → New branch ruleset** for `main`:
      block force pushes, block deletions, require linear history, require the `verify` status check.
      (While you are the only contributor, you can allow yourself to bypass pull requests.)
- [ ] **Settings → Actions → General:**
  - "Allow select actions": only GitHub-owned actions (everything in the workflows is GitHub-owned).
  - Workflow permissions: **Read repository contents** (the default token is read-only; jobs ask for more).
  - Turn off "Allow GitHub Actions to create and approve pull requests".
  - Fork pull request workflows: require approval for all outside collaborators.
- [ ] **Settings → Code security:** turn on Dependabot alerts, Dependabot security updates,
      secret scanning, **push protection**, private vulnerability reporting, and CodeQL
      (the workflow is already in `.github/workflows/codeql.yml`).
- [ ] **Settings → Environments → github-pages:** deployment branches = `main` only.

## GitHub Pages and the custom domain

- [ ] **Account Settings → Pages → Add a verified domain** _before_ pointing DNS at GitHub.
      This stops anyone else from claiming the domain on their own Pages site (subdomain takeover).
- [ ] **Repository Settings → Pages:** Source = **GitHub Actions**. Enter the custom domain, wait for
      the certificate, then tick **Enforce HTTPS**.
- [ ] DNS at the registrar:
  - an apex domain uses GitHub's A/AAAA records; a subdomain uses a `CNAME` to `izzyboop.github.io`.
  - Add a CAA record so only Let's Encrypt (which GitHub uses) can issue certificates:
    `CAA 0 issue "letsencrypt.org"`.
  - Turn on registrar lock and DNSSEC if the registrar offers them.
- [ ] Prefer a `.dev` or `.app` domain: browsers force HTTPS on these (HSTS preload), which makes up
      for GitHub Pages not sending a `Strict-Transport-Security` header.

## Before each release or pentest

- [ ] `npm audit` and `npm audit signatures` are clean.
- [ ] `tools/check-commits.sh` passes (no personal emails, UTC times only).
- [ ] `gitleaks git .` finds nothing.
- [ ] `npm run build` passes the `check-dist` scan; `npm run e2e` passes (zero CSP violations).
