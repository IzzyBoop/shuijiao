import type { PortalModule } from '../../core/modules';
import { ExternalLink } from '../../core/ui/ExternalLink';
import { reportProblemUrl } from '../../core/report';
import dictionaryInfo from '../../core/lang/dict-meta.json';
import { WhatsNew } from './WhatsNew';

function AboutPage() {
  return (
    <>
      <div class="page-head">
        <h1>About</h1>
        <span class="badge">Version {__APP_VERSION__}</span>
      </div>

      <section class="panel stack">
        <h2>Your privacy</h2>
        <p>
          Everything you add (cards, decks, review history, and settings) is stored only in this browser on
          this device. Nothing is sent to a server, and there are no accounts, trackers, or analytics.
        </p>
        <p>
          That also means clearing your browser's site data deletes your cards. Use{' '}
          <a href="#/settings">Settings → Backup</a> to download a backup file now and then, and to move your
          cards to another device.
        </p>
        <p>Pronunciation uses your device's built-in speech voices, so audio is generated on your device.</p>
      </section>

      <section class="panel stack">
        <h2>Something not working?</h2>
        <p>
          Tell the developer what happened. The form opens in a new tab with the portal's version filled in;
          nothing about your cards is sent.
        </p>
        <p>
          <ExternalLink url={reportProblemUrl()}>Report an issue or suggest a feature</ExternalLink>
        </p>
      </section>

      <WhatsNew />

      <section class="panel stack">
        <h2>Credits and licences</h2>
        <p>
          Dictionary data:{' '}
          <ExternalLink url="https://www.mdbg.net/chinese/dictionary?page=cc-cedict">CC-CEDICT</ExternalLink>,
          licensed{' '}
          <ExternalLink url="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</ExternalLink>.
          Version from {dictionaryInfo.sourceDate.slice(0, 10)}, {dictionaryInfo.entries.toLocaleString()}{' '}
          entries.
        </p>
        <p>
          Built with Preact, Dexie, opencc-js, pinyin-pro, ts-fsrs, and Valibot (MIT, Apache-2.0, and
          BSD-3-Clause licences). Icons adapted from Feather (MIT).
        </p>
        <p>
          The 墨 Ink style is inspired by the website of{' '}
          <ExternalLink url="https://ryoku.dev/">Ryoku Linux</ExternalLink>. Its fonts are Fraunces, Space
          Grotesk, and Space Mono (SIL Open Font License).
        </p>
      </section>
    </>
  );
}

export const aboutModule: PortalModule = {
  id: 'about',
  nav: [{ label: "About & what's new", path: '/about', icon: 'info', order: 100, placement: 'footer' }],
  routes: [{ path: '/about', title: 'About', component: AboutPage }],
};
