import {expect, type BrowserContext, type Page, type Route} from '@playwright/test';
import {build, type Rollup} from 'vite';
import {fileURLToPath} from 'node:url';

/**
 * B1c §6.3: the test dApp, served through ctx.route — never from the network. Its script (e2e/fixtures/dapp/page.ts,
 * with the real @wallet-standard/app) is built once into a classic script. Every host it is served at is contained
 * twice: the route answers it, and launchContained's resolver map (DAPP_HOSTS) makes it unresolvable inside the browser,
 * so a request the route misses fails locally. `hits` counts what the route served; `unexpected` any path it does not
 * serve (asserted empty).
 */
export const DAPP_HOSTS = ['dapp.test', 'jup.ag', 'tensr.trade', 'xn--phntom-4nf.app', 'xn--bcher-kva.example'] as const;
const ROOT = fileURLToPath(new URL('..', import.meta.url));

let script: string | null = null;
async function dappScript(): Promise<string> {
  if (script !== null) return script;
  const out = (await build({
    configFile: false,
    logLevel: 'silent',
    root: ROOT,
    publicDir: false,
    build: {write: false, minify: false, lib: {entry: 'e2e/fixtures/dapp/page.ts', formats: ['iife'], name: 'testDapp', fileName: () => 'dapp.js'}},
  })) as Rollup.RollupOutput | Rollup.RollupOutput[];
  const first = Array.isArray(out) ? out[0] : out;
  const chunk = first?.output.find(o => o.type === 'chunk');
  if (chunk === undefined || chunk.type !== 'chunk') throw new Error('the test dApp did not build');
  script = chunk.code;
  return script;
}

const PAGE = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Test dApp</title></head><body><h1>Test dApp</h1><script src="/dapp.js"></script></body></html>';
/** E2E 23: the dApp's page inside an iframe of its own origin. */
const FRAMED = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Framed</title></head><body><script src="/dapp.js"></script><iframe src="/inner.html" title="inner"></iframe></body></html>';

export interface DappServer {
  hits: string[];
  unexpected: string[];
}

export async function serveDapp(ctx: BrowserContext): Promise<DappServer> {
  const js = await dappScript();
  const server: DappServer = {hits: [], unexpected: []};
  for (const host of DAPP_HOSTS) {
    await ctx.route(new RegExp(`^https://${host.replace(/\./g, '\\.')}(:\\d+)?/`), (route: Route) => {
      const url = new URL(route.request().url());
      server.hits.push(url.href);
      if (url.pathname === '/dapp.js') return route.fulfill({status: 200, contentType: 'text/javascript', body: js});
      if (url.pathname === '/' || url.pathname === '/inner.html') return route.fulfill({status: 200, contentType: 'text/html', body: PAGE});
      if (url.pathname === '/framed.html') return route.fulfill({status: 200, contentType: 'text/html', body: FRAMED});
      server.unexpected.push(url.href);
      return route.abort();
    });
  }
  return server;
}

type Result = {ok: true; value: unknown} | {ok: false; code: unknown; message: string};
declare const dapp: {
  names(): string[];
  features(): string[];
  accounts(): string[];
  changes(): string[][];
  relayed(): unknown[];
  connect(silent: boolean): Promise<Result>;
  disconnect(): Promise<Result>;
  sign(text: string, o?: {base64?: boolean}): Promise<Result>;
};

/** A dApp tab at `origin`, its Wallet Standard registry ready (Noctura found, or not). */
export async function openDapp(ctx: BrowserContext, origin: string, path = '/'): Promise<Page> {
  const page = await ctx.newPage();
  await page.goto(`${origin}${path}`);
  await page.waitForFunction(() => typeof (window as unknown as {dapp?: unknown}).dapp === 'object');
  return page;
}

export const names = (p: Page) => p.evaluate(() => dapp.names());
export const features = (p: Page) => p.evaluate(() => dapp.features());
export const changes = (p: Page) => p.evaluate(() => dapp.changes());
export const relayed = (p: Page) => p.evaluate(() => dapp.relayed());
export const connect = (p: Page, silent = false) => p.evaluate(s => dapp.connect(s), silent);
export const disconnect = (p: Page) => p.evaluate(() => dapp.disconnect());
export const sign = (p: Page, text: string, o: {base64?: boolean} = {}) => p.evaluate(({t, b}) => dapp.sign(t, {base64: b}), {t: text, b: o.base64 === true});

/**
 * The approval window `act` causes (windows.create → a new page of approve.html). What `act` returns is NOT awaited: a
 * request's promise settles only once the window decides it (the dry run's first form awaited it and deadlocked).
 */
export async function approvalWindow(ctx: BrowserContext, act: () => unknown): Promise<Page> {
  const opened = ctx.waitForEvent('page', p => p.url().endsWith('/approve.html'));
  const result = act();
  if (result instanceof Promise) result.catch(() => undefined);
  const win = await opened;
  await win.waitForLoadState('domcontentloaded');
  return win;
}

/** The window closed itself (`none`, §4.3) — polled: it may have closed before anyone listened for it. */
export async function windowClosed(win: Page): Promise<void> {
  await expect.poll(() => win.isClosed(), {timeout: 10_000}).toBe(true);
}

/**
 * `act` opens no window at all (§1.6, §2.6: answered at once): no new page appears while it runs and for a second
 * after. Races `act()` against a page actually opening (review fix M1) — awaiting `act()` alone meant a regression
 * that queues a window (whose promise then never settles, since nothing drives it) failed only as this test's own
 * 180 s timeout, with no indication why; this fails at once with "a window opened" instead.
 */
export async function noWindow<T>(ctx: BrowserContext, act: () => Promise<T>): Promise<T> {
  const opened: string[] = [];
  const seen = (p: Page) => void opened.push(p.url());
  ctx.on('page', seen);
  try {
    const regression = ctx.waitForEvent('page', {timeout: 0}).then(p => {
      throw new Error(`a window opened: ${p.url()}`);
    });
    void regression.catch(() => undefined);
    const out = await Promise.race([act(), regression]);
    await new Promise(r => setTimeout(r, 1_000));
    expect(opened).toEqual([]);
    return out as T;
  } finally {
    ctx.off('page', seen);
  }
}
