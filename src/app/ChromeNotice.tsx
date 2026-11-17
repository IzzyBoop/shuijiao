import { useState } from 'preact/hooks';
import { chromeNoticeClosed, closeChromeNotice, isGoogleChrome } from '../core/notices';
import { Icon } from '../core/ui/Icon';

/**
 * Tells students in other browsers that audio works best in Chrome. Shown on every
 * page until closed, then never again (in this browser).
 */
export function ChromeNotice() {
  const [show, setShow] = useState(() => !isGoogleChrome() && !chromeNoticeClosed());
  if (!show) return null;
  return (
    <div class="notice site-notice">
      <Icon name="sound" />
      <span class="grow">
        水餃 works best in <strong>Google Chrome</strong>, which has the most reliable Chinese voices for
        playing audio.
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
