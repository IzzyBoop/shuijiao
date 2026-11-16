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

export type UpdateListener = (apply: () => void) => void;

export async function registerServiceWorker(onUpdate: UpdateListener): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  // On a first visit there is no controller yet; the new worker taking control then is
  // not an update and must not reload the page.
  const hadController = navigator.serviceWorker.controller !== null;
  try {
    const reg = await navigator.serviceWorker.register(scriptUrl(), { scope: './' });
    const offer = (worker: ServiceWorker) => {
      onUpdate(() => {
        worker.postMessage('skip-waiting');
      });
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker);
      });
    });
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded || !hadController) return;
      reloaded = true;
      window.location.reload();
    });
  } catch {
    // Offline support is optional; the portal works without it.
  }
}
