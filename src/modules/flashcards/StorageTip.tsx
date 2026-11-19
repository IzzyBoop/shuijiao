import { useState } from 'preact/hooks';
import { canPersistStorage, isStoragePersisted, requestPersistentStorage } from '../../core/db/persist';
import {
  erasesIdleSites,
  isAppleTouch,
  isInstalled,
  snoozeStorageTip,
  storageTipSnoozed,
} from '../../core/notices';
import { href } from '../../core/router';
import { Icon } from '../../core/ui/Icon';
import { useAsync } from '../../core/ui/useAsync';

/**
 * One tip, on the Study page, about keeping your cards from being deleted by the browser:
 * - Safari (iPhone, iPad, Mac) deletes a site's data after 7 days without a visit, unless
 *   it is on the Home Screen or in the Dock, so suggest that (with a backup to move the
 *   cards over, because the app keeps its own storage, separate from Safari's).
 * - Elsewhere, ask the browser to protect the cards from clean-up when space runs low.
 */
export function StorageTip() {
  const [closed, setClosed] = useState(() => storageTipSnoozed());
  const [result, setResult] = useState<'granted' | 'refused' | null>(null);
  const persisted = useAsync(() => isStoragePersisted(), []);

  const close = () => {
    snoozeStorageTip();
    setClosed(true);
  };
  const closeButton = (
    <button
      type="button"
      class="icon-only ghost notice-close"
      aria-label="Hide this tip for a month"
      title="Hide for a month"
      onClick={close}
    >
      <Icon name="x" />
    </button>
  );

  if (closed) return null;

  if (erasesIdleSites() && !isInstalled()) {
    const where = isAppleTouch() ? 'Home Screen' : 'Dock';
    return (
      <div class="notice warn">
        <Icon name="alert" />
        <div class="grow stack-tight">
          <p>
            Safari deletes a website's data if you don't open it for 7 days, and your cards would go with it.
            Apps on your {where} are kept. To move your cards there:
          </p>
          <ol class="small">
            <li>
              <a href={href('/settings')}>Download a backup</a>.
            </li>
            <li>
              {isAppleTouch() ? (
                <>
                  Tap the Share button, then <strong>Add to Home Screen</strong>.
                </>
              ) : (
                <>
                  In Safari's menu bar, choose <strong>File → Add to Dock</strong>.
                </>
              )}
            </li>
            <li>Open 水餃 from your {where} and import the backup there.</li>
          </ol>
        </div>
        {closeButton}
      </div>
    );
  }

  if (result === 'granted') {
    return (
      <div class="notice ok" role="status">
        <Icon name="check" />
        <span class="grow">Done: your browser will keep your cards even when space runs low.</span>
        {closeButton}
      </div>
    );
  }
  if (result === 'refused') {
    return (
      <div class="notice" role="status">
        <Icon name="alert" />
        <span class="grow">
          Your browser said no. Installing 水餃 as an app (from the browser's menu) usually lets it keep your
          cards. Until then, <a href={href('/settings')}>download a backup</a> now and then.
        </span>
        {closeButton}
      </div>
    );
  }
  if (!canPersistStorage() || persisted.data !== false) return null;

  return (
    <div class="notice">
      <Icon name="alert" />
      <div class="grow stack-tight">
        <p>Your browser may clear your cards if your device runs low on space.</p>
        <div>
          <button
            type="button"
            onClick={() => {
              void requestPersistentStorage().then((granted) => {
                setResult(granted ? 'granted' : 'refused');
              });
            }}
          >
            Protect my cards
          </button>
        </div>
      </div>
      {closeButton}
    </div>
  );
}
