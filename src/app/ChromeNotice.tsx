import { useState } from 'preact/hooks';
import { chromeNoticeClosed, closeChromeNotice, isAppleTouch, isGoogleChrome } from '../core/notices';
import { href } from '../core/router';
import { Icon } from '../core/ui/Icon';

/**
 * Tells students in other browsers that audio works best in Chrome. Shown on every
 * page until closed, then never again (in this browser). Not on iPhone and iPad, where
 * every browser (Chrome too) uses the same Apple voices.
 */
export function ChromeNotice() {
  const [show, setShow] = useState(() => !isGoogleChrome() && !isAppleTouch() && !chromeNoticeClosed());
  if (!show) return null;
  return (
    <div class="notice site-notice">
      <Icon name="sound" />
      <span class="grow">
        水餃 works best in <strong>Google Chrome</strong>, which has the most reliable Chinese voices for
        playing audio. Your cards stay in the browser you made them in, so to switch,{' '}
        <a href={href('/settings')}>download a backup</a> here and import it in Chrome.
      </span>
      <button
        type="button"
        class="icon-only ghost notice-close"
        aria-label="Close this message"
        title="Close"
        onClick={() => {
          closeChromeNotice();
          setShow(false);
        }}
      >
        <Icon name="x" />
      </button>
    </div>
  );
}
