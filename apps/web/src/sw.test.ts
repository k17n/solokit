import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rawSource = readFileSync(join(__dirname, '..', 'public', 'sw.js'), 'utf8');
const ORIGIN = 'https://solokit.test';
const PRECACHE = ['/', '/privacy/', '/_next/static/a.js'];

type Handler = (event: Record<string, unknown>) => void;

interface Req {
  url: string;
  method: string;
  mode: string;
  headers: { has(k: string): boolean; get(k: string): string | null };
}
interface Res {
  body: string;
  ok: boolean;
  type: string;
  clone(): Res;
}

function req(
  path: string,
  init: { method?: string; mode?: string; headers?: Record<string, string>; origin?: string } = {},
): Req {
  const headers = new Map(Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    url: (init.origin ?? ORIGIN) + path,
    method: init.method ?? 'GET',
    mode: init.mode ?? 'no-cors',
    headers: {
      has: (k) => headers.has(k.toLowerCase()),
      get: (k) => headers.get(k.toLowerCase()) ?? null,
    },
  };
}

function res(body: string, opts: { ok?: boolean; type?: string } = {}): Res {
  return { body, ok: opts.ok ?? true, type: opts.type ?? 'basic', clone: () => res(body, opts) };
}

function pathOf(r: Req | string) {
  const parsed = new URL(typeof r === 'string' ? r : r.url, ORIGIN);
  return { full: parsed.pathname + parsed.search, path: parsed.pathname };
}

class FakeCache {
  store = new Map<string, Res>();
  failing = new Set<string>();
  requests: { url: string; cache?: string }[] = [];
  async addAll(items: (string | { url: string; cache?: string })[]) {
    const reqs = items.map((i) => (typeof i === 'string' ? { url: i } : i));
    this.requests.push(...reqs);
    if (reqs.some((r) => this.failing.has(pathOf(r.url).full))) {
      throw new TypeError('addAll: bad response status');
    }
    for (const r of reqs) this.store.set(pathOf(r.url).full, res(`precached:${pathOf(r.url).full}`));
  }
  async put(r: Req | string, response: Res) {
    await Promise.resolve();
    await Promise.resolve();
    this.store.set(pathOf(r).full, response);
  }
  async match(r: Req | string, opts: { ignoreSearch?: boolean } = {}) {
    const p = pathOf(r);
    if (opts.ignoreSearch) {
      for (const [k, v] of this.store) if (k.split('?')[0] === p.path) return v;
      return undefined;
    }
    return this.store.get(p.full);
  }
}

function setup(networkImpl: (r: Req) => Promise<Res>, failingUrls: string[] = []) {
  const handlers: Record<string, Handler> = {};
  const store = new Map<string, FakeCache>();
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, h: Handler) => {
      handlers[type] = h;
    },
    skipWaiting: vi.fn(async () => {}),
    clients: { claim: vi.fn(async () => {}) },
  };
  const caches = {
    open: async (name: string) => {
      if (!store.has(name)) {
        const c = new FakeCache();
        for (const u of failingUrls) c.failing.add(u);
        store.set(name, c);
      }
      return store.get(name)!;
    },
    keys: async () => [...store.keys()],
    delete: async (name: string) => store.delete(name),
  };
  const fetchStub = vi.fn(networkImpl);
  const ResponseStub = { error: () => res('', { ok: false, type: 'error' }) };
  const source = rawSource
    .replaceAll('__BUILD_ID__', 'test123')
    .replaceAll('__PRECACHE_URLS__', JSON.stringify(PRECACHE));
  class RequestStub {
    url: string;
    cache?: string;
    constructor(url: string, init: { cache?: string } = {}) {
      this.url = url;
      this.cache = init.cache;
    }
  }
  new Function('self', 'caches', 'fetch', 'Response', 'URL', 'Request', source)(
    self,
    caches,
    fetchStub,
    ResponseStub,
    URL,
    RequestStub,
  );
  return { handlers, store, self, fetchStub };
}

async function runWaitUntil(type: 'install' | 'activate', handlers: Record<string, Handler>) {
  const promises: Promise<unknown>[] = [];
  handlers[type]!({ waitUntil: (p: Promise<unknown>) => promises.push(p) });
  await Promise.all(promises);
}

async function dispatchFetch(handlers: Record<string, Handler>, request: Req) {
  let responded: Promise<Res> | undefined;
  const waits: Promise<unknown>[] = [];
  handlers.fetch!({
    request,
    respondWith: (p: Promise<Res>) => {
      responded = p;
    },
    waitUntil: (p: Promise<unknown>) => waits.push(p),
  });
  const response = responded ? await responded : undefined;
  await Promise.all(waits);
  return { intercepted: responded !== undefined, response, waits };
}

const offline = async (): Promise<Res> => {
  throw new TypeError('offline');
};

describe('service worker source', () => {
  it('is a template containing both tokens', () => {
    expect(rawSource).toContain('__BUILD_ID__');
    expect(rawSource).toContain('__PRECACHE_URLS__');
  });
});

describe('service worker behaviour', () => {
  let online = true;
  beforeEach(() => {
    online = true;
  });
  const network = async (r: Req) => {
    if (!online) throw new TypeError('offline');
    return res(`network:${pathOf(r).full}`);
  };

  it('precaches exactly the list on install and skips waiting', async () => {
    const { handlers, store, self } = setup(network);
    await runWaitUntil('install', handlers);
    expect([...store.keys()]).toEqual(['solokit-test123']);
    expect([...store.get('solokit-test123')!.store.keys()].sort()).toEqual([...PRECACHE].sort());
    expect(self.skipWaiting).toHaveBeenCalled();
  });

  it('precaches with cache: reload so the HTTP cache is bypassed', async () => {
    const { handlers, store } = setup(network);
    await runWaitUntil('install', handlers);
    const requests = store.get('solokit-test123')!.requests;
    expect(requests.map((r) => r.url).sort()).toEqual([...PRECACHE].sort());
    expect(requests.every((r) => r.cache === 'reload')).toBe(true);
  });

  it('deletes old solokit caches on activate but keeps current and unrelated ones', async () => {
    const { handlers, store, self } = setup(network);
    for (const n of ['solokit-test123', 'solokit-old', 'solokit-v1', 'other-cache']) {
      store.set(n, new FakeCache());
    }
    await runWaitUntil('activate', handlers);
    expect([...store.keys()].sort()).toEqual(['other-cache', 'solokit-test123']);
    expect(self.clients.claim).toHaveBeenCalled();
  });

  it('does not intercept non-GET, cross-origin or Range requests', async () => {
    const { handlers, fetchStub } = setup(network);
    expect((await dispatchFetch(handlers, req('/x', { method: 'POST' }))).intercepted).toBe(false);
    expect(
      (await dispatchFetch(handlers, req('/x', { origin: 'https://other.test' }))).intercepted,
    ).toBe(false);
    expect(
      (await dispatchFetch(handlers, req('/x.mp4', { headers: { Range: 'bytes=0-1' } }))).intercepted,
    ).toBe(false);
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('never intercepts or caches the analytics beacon script or its reports', async () => {
    const { handlers, fetchStub, store } = setup(network);
    const beacon = 'https://static.cloudflareinsights.com';
    const report = 'https://cloudflareinsights.com';
    for (const r of [
      req('/beacon.min.js', { origin: beacon }),
      req('/cdn-cgi/rum', { origin: report, method: 'POST' }),
      req('/cdn-cgi/rum?', { origin: report }),
    ]) {
      expect((await dispatchFetch(handlers, r)).intercepted).toBe(false);
    }
    expect(fetchStub).not.toHaveBeenCalled();
    expect([...(store.get('solokit-test123')?.store.keys() ?? [])]).toEqual([]);
  });

  it('keeps the offline page working when the beacon is unreachable', async () => {
    const { handlers } = setup(offline);
    await runWaitUntil('install', handlers);
    const page = await dispatchFetch(handlers, req('/', { mode: 'navigate' }));
    expect(page.response!.body).toBe('precached:/');
  });

  it('navigation uses the network when online and caches the copy', async () => {
    const { handlers, store } = setup(network);
    const { response } = await dispatchFetch(handlers, req('/privacy/', { mode: 'navigate' }));
    expect(response!.body).toBe('network:/privacy/');
    expect((await store.get('solokit-test123')!.match('/privacy/'))!.body).toBe('network:/privacy/');
  });

  it('stores responses only through event.waitUntil', async () => {
    for (const [path, mode] of [
      ['/privacy/', 'navigate'],
      ['/_next/static/new.js', 'no-cors'],
    ] as const) {
      const { handlers, store } = setup(network);
      const { waits, response } = await dispatchFetch(handlers, req(path, { mode }));
      expect(response).toBeDefined();
      expect(waits).toHaveLength(1);
      await Promise.all(waits);
      expect((await store.get('solokit-test123')!.match(path))!.body).toBe(`network:${path}`);
    }
  });

  it('does not store before the waitUntil promise settles (async put)', async () => {
    const { handlers, store } = setup(network);
    let responded: Promise<Res> | undefined;
    const waits: Promise<unknown>[] = [];
    handlers.fetch!({
      request: req('/_next/static/late.js'),
      respondWith: (p: Promise<Res>) => {
        responded = p;
      },
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    });
    await responded;
    expect(store.get('solokit-test123')!.store.has('/_next/static/late.js')).toBe(false);
    await Promise.all(waits);
    expect(store.get('solokit-test123')!.store.has('/_next/static/late.js')).toBe(true);
  });

  it('install rejects when any precache URL cannot be fetched (addAll is all-or-nothing)', async () => {
    const { handlers, store, self } = setup(network, ['/privacy/']);
    await expect(runWaitUntil('install', handlers)).rejects.toThrow('addAll');
    expect(store.get('solokit-test123')!.store.size).toBe(0);
    expect(self.skipWaiting).not.toHaveBeenCalled();
  });

  it('navigation does not cache non-ok or non-basic responses', async () => {
    const bad = setup(async () => res('boom', { ok: false }));
    await dispatchFetch(bad.handlers, req('/missing/', { mode: 'navigate' }));
    const opaque = setup(async () => res('x', { type: 'opaque' }));
    await dispatchFetch(opaque.handlers, req('/opaque/', { mode: 'navigate' }));
    expect(bad.store.get('solokit-test123')?.store.has('/missing/') ?? false).toBe(false);
    expect(opaque.store.get('solokit-test123')?.store.has('/opaque/') ?? false).toBe(false);
  });

  it('offline navigation falls back to the cached page, then /, then an error', async () => {
    const { handlers } = setup(offline);
    await runWaitUntil('install', handlers);
    const cached = await dispatchFetch(handlers, req('/privacy/?utm=1', { mode: 'navigate' }));
    expect(cached.response!.body).toBe('precached:/privacy/');
    const home = await dispatchFetch(handlers, req('/unknown/', { mode: 'navigate' }));
    expect(home.response!.body).toBe('precached:/');

    const empty = setup(offline);
    const none = await dispatchFetch(empty.handlers, req('/unknown/', { mode: 'navigate' }));
    expect(none.response!.type).toBe('error');
  });

  it('offline navigation to a slash-less URL finds the trailing-slash page', async () => {
    const { handlers } = setup(offline);
    await runWaitUntil('install', handlers);
    const page = await dispatchFetch(handlers, req('/privacy?utm=1', { mode: 'navigate' }));
    expect(page.response!.body).toBe('precached:/privacy/');
    const home = await dispatchFetch(handlers, req('/nope', { mode: 'navigate' }));
    expect(home.response!.body).toBe('precached:/');
  });

  it('serves a cached asset without touching the network', async () => {
    const { handlers, fetchStub } = setup(network);
    await runWaitUntil('install', handlers);
    const { response } = await dispatchFetch(handlers, req('/_next/static/a.js?v=1'));
    expect(response!.body).toBe('precached:/_next/static/a.js');
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('fetches and stores an uncached asset when online', async () => {
    const { handlers, store } = setup(network);
    const { response } = await dispatchFetch(handlers, req('/_next/static/new.js'));
    expect(response!.body).toBe('network:/_next/static/new.js');
    expect(store.get('solokit-test123')!.store.has('/_next/static/new.js')).toBe(true);
  });

  it('returns an error response, not a throw, for an uncached asset offline', async () => {
    const { handlers } = setup(offline);
    const { response } = await dispatchFetch(handlers, req('/_next/static/none.js'));
    expect(response!.type).toBe('error');
  });
});
