import { Component, type ComponentChildren } from 'preact';
import { reportProblemUrl } from '../report';
import { reloadToLatest } from '../sw-register';
import { ExternalLink } from './ExternalLink';

interface Props {
  children: ComponentChildren;
  /** When this changes (e.g. the page), a crashed part gets another try. */
  resetKey?: unknown;
}

interface State {
  error: Error | null;
}

/**
 * Catches a crash while showing part of the portal, and shows what to do instead of a
 * blank page: reload (to the newest version, which may have the fix), or report it.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static override getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidUpdate(previous: Props): void {
    if (previous.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  override render() {
    const { error } = this.state;
    return error ? <CrashScreen error={error} /> : this.props.children;
  }
}

export function CrashScreen({ error }: { error: Error }) {
  const where = window.location.hash.split('/').slice(0, 2).join('/') || '#/';
  const stack = (error.stack ?? '').split('\n').slice(0, 6).join('\n');
  const details = `The portal crashed on ${where}.\n${error.name}: ${error.message}\n${stack}`;
  return (
    <section class="panel stack" role="alert">
      <h1>Something went wrong</h1>
      <p>
        This part of the portal stopped working. Your cards are stored in this browser, and this doesn't
        change them.
      </p>
      <p>Reloading often fixes it, and gets the newest version of the portal if there is one.</p>
      <div class="row">
        <button type="button" class="primary" onClick={() => void reloadToLatest()}>
          Reload the portal
        </button>
        <ExternalLink url={reportProblemUrl(details)}>Report the problem</ExternalLink>
      </div>
      <details>
        <summary class="small">Details</summary>
        <pre class="small crash-details">{`${error.name}: ${error.message}`}</pre>
      </details>
    </section>
  );
}
