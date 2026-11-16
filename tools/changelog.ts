// Parses CHANGELOG.md (Keep a Changelog format) into data the app can show as
// plain text. Used by vite.config.ts at build time and by tools/release.sh.

export interface ChangelogSection {
  title: string;
  items: string[];
}

export interface ChangelogRelease {
  version: string;
  date: string | null;
  sections: ChangelogSection[];
}

const RELEASE = /^## \[([^\]]+)\](?:\s+-\s+(\d{4}-\d{2}-\d{2}))?\s*$/;
const SECTION = /^### (.+?)\s*$/;
const ITEM = /^- (.*)$/;
const CONTINUATION = /^ {2,}(\S.*)$/;

/** Strips Markdown emphasis, code and links so items read as plain text. */
export function plainText(md: string): string {
  return md
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

export function parseChangelog(md: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  let release: ChangelogRelease | null = null;
  let section: ChangelogSection | null = null;
  for (const line of md.split('\n')) {
    const r = RELEASE.exec(line);
    if (r) {
      release = { version: r[1] ?? '', date: r[2] ?? null, sections: [] };
      section = null;
      releases.push(release);
      continue;
    }
    if (!release) continue;
    const s = SECTION.exec(line);
    if (s) {
      section = { title: s[1] ?? '', items: [] };
      release.sections.push(section);
      continue;
    }
    if (!section) continue;
    const item = ITEM.exec(line);
    if (item) {
      section.items.push(item[1] ?? '');
      continue;
    }
    const more = CONTINUATION.exec(line);
    const last = section.items.at(-1);
    if (more && last !== undefined) {
      section.items[section.items.length - 1] = `${last} ${more[1] ?? ''}`;
    }
  }
  for (const rel of releases) {
    for (const sec of rel.sections) sec.items = sec.items.map(plainText);
    rel.sections = rel.sections.filter((sec) => sec.items.length > 0);
  }
  return releases;
}

/** Moves the Unreleased entries under a new version heading (keeps an empty Unreleased). */
export function stampRelease(md: string, version: string, date: string): string {
  const marker = '## [Unreleased]';
  const at = md.indexOf(marker);
  if (at === -1) throw new Error('CHANGELOG.md has no "## [Unreleased]" section.');
  const unreleased = parseChangelog(md).find((r) => r.version === 'Unreleased');
  if (!unreleased || unreleased.sections.length === 0) {
    throw new Error('Nothing under "## [Unreleased]" in CHANGELOG.md; add the changes first.');
  }
  if (parseChangelog(md).some((r) => r.version === version)) {
    throw new Error(`CHANGELOG.md already has a section for ${version}.`);
  }
  return `${md.slice(0, at)}${marker}\n\n## [${version}] - ${date}${md.slice(at + marker.length)}`;
}
