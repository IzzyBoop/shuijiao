import { setAppStatus } from './app-status';

/**
 * Registers the service worker under Trusted Types. The CSP allows exactly one
 * policy, "sw-url", and it only ever produces the fixed worker URL.
 */

interface TrustedTypePolicyLike {
  createScriptURL(input: string): unknown;
}
interface TrustedTypesLike {
  createPolicy(name: string, rules: { createScriptURL(input: string): string }): TrustedTypePolicyLike;
}

const SW_URL = './sw.js';

let policy: TrustedTypePolicyLike | null | undefined;

function scriptUrl(): string {
  if (policy === undefined) {
    const tt = (window as unknown as { trustedTypes?: TrustedTypesLike }).trustedTypes;
    policy = tt
      ? tt.createPolicy('sw-url', {
          createScriptURL(input) {
            if (input !== SW_URL) throw new TypeError('Blocked script URL');
            return input;
          },
        })
      : null;
  }
  // A TrustedScriptURL is accepted wherever a string URL is.
  return (policy ? policy.createScriptURL(SW_URL) : SW_URL) as string;
}

/** Set when the student chose to switch to the new version: its takeover reloads the page. */
let applying = false;

/**
 * Registers the service worker and keeps watch for new versions. Call it before the
 * app renders, so that even a version that crashes on start can still be updated.
 */
export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  let controlled = sw.controller !== null;
  try {
    const reg = await sw.register(scriptUrl(), { scope: './' });
    const offer = (worker: ServiceWorker) => {
      setAppStatus({
        update: () => {
          applying = true;
          worker.postMessage('skip-waiting');
        },
      });
    };
    if (reg.waiting && sw.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && sw.controller) offer(worker);
      });
    });
    sw.addEventListener('controllerchange', () => {
      const wasControlled = controlled;
      controlled = sw.controller !== null;
      if (applying) {
        applying = false;
        window.location.reload();
      } else if (wasControlled) {
        // A new version took over from another tab. Its files replaced this tab's, so
        // this tab must reload before it next needs one.
        setAppStatus({ update: null, reload: 'other-tab' });
      }
      // Otherwise this was the first visit, and the worker has just started: nothing to do.
    });
    watchForUpdates(reg);
  } catch {
    // Offline support is optional; the portal works without it.
  }
}

/**
 * The browser only looks for a new version when the page is opened. An installed app or
 * a tab left open for days would never notice one, so look again whenever the portal
 * comes back into view (at most every 10 minutes) and every hour while it is open.
 */
function watchForUpdates(reg: ServiceWorkerRegistration): void {
  let last = Date.now();
  const check = () => {
    if (Date.now() - last < 10 * 60_000) return;
    last = Date.now();
    reg.update().catch(() => {
      // Offline, or the site is unreachable: try again next time.
    });
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.setInterval(check, 60 * 60_000);
}

/**
 * "Reload" after a crash: switch to the newest version if there is one (a crash may be
 * fixed by it), otherwise just reload.
 */
export async function reloadToLatest(): Promise<void> {
  const sw = 'serviceWorker' in navigator ? navigator.serviceWorker : null;
  const reg = await sw?.getRegistration().catch(() => undefined);
  if (sw?.controller && reg) {
    await reg.update().catch(() => undefined);
    const worker = reg.waiting ?? reg.installing;
    if (worker) {
      if (worker.state !== 'installed') {
        await new Promise<void>((resolve) => {
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed') resolve();
          });
          window.setTimeout(resolve, 10_000);
        });
      }
      applying = true;
      worker.postMessage('skip-waiting');
      // If the switch doesn't happen (the worker failed to install), reload anyway.
      window.setTimeout(() => {
        window.location.reload();
      }, 5_000);
      return;
    }
  }
  window.location.reload();
}
