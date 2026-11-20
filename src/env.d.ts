/** The app version from package.json, injected at build time by vite.config.ts. */
declare const __APP_VERSION__: string;

/** The stylesheets for the self-hosted Chinese fonts, by character style (vite.config.ts). */
declare const __CJK_FONT_SHEETS__: { serif: string; kai: string };

/** Released versions from CHANGELOG.md, newest first (see tools/changelog.ts). */
declare module 'virtual:changelog' {
  interface ChangelogSection {
    title: string;
    items: string[];
  }
  interface ChangelogRelease {
    version: string;
    date: string | null;
    intro: string;
    sections: ChangelogSection[];
  }
  const releases: ChangelogRelease[];
  export default releases;
}
