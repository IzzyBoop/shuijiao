import { reportProblemUrl } from '../report';
import { ExternalLink } from './ExternalLink';

/**
 * Shown when a page can't read what it needs from the browser's storage, instead of the
 * bare error message: what may have happened, and what to do.
 */
export function LoadError({
  error,
  retry,
  what = 'your cards',
}: {
  error: string;
  retry: () => void;
  what?: string;
}) {
  return (
    <section class="panel stack" role="alert">
      <h1>Couldn't load {what}</h1>
      <p>
        The portal couldn't read {what} from this browser's storage. This can happen in a private window, when
        the browser blocks site data or the device is full, or while the portal is being updated in another
        tab.
      </p>
      <p>
        Your cards are usually still there. Try again, or reload the portal. If it keeps happening, please
        report it.
      </p>
      <div class="row">
        <button type="button" class="primary" onClick={retry}>
          Try again
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.reload();
          }}
        >
          Reload the portal
        </button>
        <ExternalLink url={reportProblemUrl(`Could not load ${what}.\n${error}`)}>
          Report the problem
        </ExternalLink>
      </div>
      <details>
        <summary class="small">Details</summary>
        <pre class="small crash-details">{error}</pre>
      </details>
    </section>
  );
}
