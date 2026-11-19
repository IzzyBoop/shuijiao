import { useState } from 'preact/hooks';
import { useAppStatus } from '../core/app-status';

/** The bottom banner: a new version is ready, or this tab must reload. */
export function UpdateBanner() {
  const { update, reload, blocked } = useAppStatus();
  const [dismissed, setDismissed] = useState(false);

  if (reload) {
    return (
      <div class="update-banner" role="alert">
        <span>
          {reload === 'other-tab'
            ? 'The portal was updated in another tab. Reload this tab to keep going.'
            : 'The portal was updated. Reload to keep going.'}
        </span>
        <button
          type="button"
          class="primary"
          onClick={() => {
            window.location.reload();
          }}
        >
          Reload
        </button>
      </div>
    );
  }
  if (blocked) {
    return (
      <div class="update-banner" role="alert">
        <span>To finish updating, close the portal's other tabs and windows.</span>
      </div>
    );
  }
  if (update && !dismissed) {
    return (
      <div class="update-banner" role="status">
        <span>A new version of the portal is ready.</span>
        <span class="row">
          <button
            type="button"
            class="ghost"
            onClick={() => {
              setDismissed(true);
            }}
          >
            Later
          </button>
          <button type="button" class="primary" onClick={update}>
            Reload
          </button>
        </span>
      </div>
    );
  }
  return null;
}
