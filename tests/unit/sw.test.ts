import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

/** A tiny stand-in for the browser's CacheStorage, keyed by URL string. */
class FakeCaches {
  readonly stores = new Map<string, Map<string, Response>>();
  private store(name: string) {
    let store = this.stores.get(name);
    if (!store) {
      store = new Map();
      this.stores.set(name, store);
    }
    return store;
  }
  open(name: string) {
    const store = this.store(name);
    return Promise.resolve({
      put: (url: string, response: Response) => {
        store.set(url, response);
        return Promise.resolve();
      },
    });
  }
  keys() {
    return Promise.resolve([...this.stores.keys()]);
  }
  match(url: string, options: { cacheName: string }) {
    return Promise.resolve(this.stores.get(options.cacheName)?.get(url));
  }
}

/** Relative URLs can't make a real Request outside a browser; the worker only passes it to fetch. */
class FakeRequest {
  constructor(
    readonly url: string,
    readonly init: unknown,
  ) {}
}

function install(precache: string[], caches: FakeCaches, fetch: (r: FakeRequest) => Promise<Response>) {
  const listeners: Record<string, (event: unknown) => void> = {};
  const self = {
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners[type] = listener;
    },
  };
  const code = readFileSync('tools/sw-template.js', 'utf8')
    .replace('__VERSION__', JSON.stringify('new'))
    .replace('__PRECACHE__', JSON.stringify(precache));
  runInNewContext(code, { self, caches, fetch, Request: FakeRequest });
  let done: Promise<unknown> = Promise.resolve();
  listeners.install?.({
    waitUntil: (p: Promise<unknown>) => {
      done = p;
    },
  });
  return done;
}

describe('service worker install', () => {
  it('reuses unchanged files from the previous version and downloads only the rest', async () => {
    const caches = new FakeCaches();
    const old = caches.stores.set('shell-old', new Map()).get('shell-old');
    old?.set('./', new Response('old page'));
    old?.set('./assets/autofill-AAA.js', new Response('autofill, unchanged'));
    old?.set('./assets/index-OLD.js', new Response('old entry'));
    const fetched: string[] = [];
    await install(['./', './assets/autofill-AAA.js', './assets/index-NEW.js'], caches, (r) => {
      fetched.push(r.url);
      return Promise.resolve(new Response(`fresh ${r.url}`));
    });

    expect(fetched.sort()).toEqual(['./', './assets/index-NEW.js']);
    const shell = caches.stores.get('shell-new');
    expect(await shell?.get('./assets/autofill-AAA.js')?.text()).toBe('autofill, unchanged');
    expect(await shell?.get('./')?.text()).toBe('fresh ./');
  });

  it('fails the install if a file cannot be downloaded, so it is tried again later', async () => {
    const caches = new FakeCaches();
    const installing = install(['./', './assets/index-NEW.js'], caches, (r) =>
      Promise.resolve(new Response('', { status: r.url === './' ? 200 : 404 })),
    );
    await expect(installing).rejects.toThrow('Could not download ./assets/index-NEW.js');
  });
});
