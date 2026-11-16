/** The app version from package.json, injected at build time by vite.config.ts. */
declare const __APP_VERSION__: string;

/** Released versions from CHANGELOG.md, newest first (see tools/changelog.ts). */
declare module 'virtual:changelog' {
  interface ChangelogSection {
    title: string;
    items: string[];
  }
  interface ChangelogRelease {
    version: string;
    date: string | null;
    sections: ChangelogSection[];
  }
  const releases: ChangelogRelease[];
  export default releases;
}
