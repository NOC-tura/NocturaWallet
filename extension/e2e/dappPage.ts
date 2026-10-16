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
export const DAPP_HOSTS = ['dapp.test', 'jup.ag', 'tensr.trade', 'xn--phntom-4nf.app', 'xn--bcher-kva.example', 'api.mainnet-beta.solana.com'] as const;
/**
 * B1c-2: the test dApp's own RPC endpoint (its @solana/web3.js Connection — a wallet-adapter dApp's). The adapter never
 * calls it while the wallet sends through signAndSendTransaction; a call would mean it fell back to sending itself.
 * Contained like every other host: unresolvable in the browser, and the route records any request as unexpected.
 */
const DAPP_RPC_HOST = 'api.mainnet-beta.solana.com';
const ROOT = fileURLToPath(new URL('..', import.meta.url));

let script: string | null = null;
async function dappScript(): Promise<string> {
  if (script !== null) return script;
  const out = (await build({
    configFile: false,
    logLevel: 'silent',
    root: ROOT,
    publicDir: false,
    // B1c-2: the page bundles @solana/web3.js and the wallet adapter (a real dApp's stack); @solana/errors reads
    // process.env.NODE_ENV, which a page does not have.
    define: {'process.env.NODE_ENV': '"production"'},
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
    if (host === DAPP_RPC_HOST) {
      await ctx.route(`https://${DAPP_RPC_HOST}/**`, (route: Route) => {
        server.unexpected.push(route.request().url());
        return route.abort();
      });
      continue;
    }
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
/** adapterSignAll's own failure shape (review fix minor): the adapter's error TYPE, not the shared Result's. */
type NamedFailure = {ok: false; message: string; name: string | undefined};
/** B1c-2 Task 10 fix round 1 (I1): one instruction of a custom transaction (`customSignTx`, below). */
export interface RawIx {
  programId: string;
  keys: {pubkey: string; isSigner: boolean; isWritable: boolean}[];
  data: number[];
}
declare const dapp: {
  names(): string[];
  features(): string[];
  accounts(): string[];
  changes(): string[][];
  relayed(): unknown[];
  connect(silent: boolean): Promise<Result>;
  disconnect(): Promise<Result>;
  sign(text: string, o?: {base64?: boolean}): Promise<Result>;
  signTx(count: number, blockhash: string): Promise<Result>;
  send(blockhash: string, lamports: number): Promise<Result>;
  adapterCompatible(): boolean;
  adapterConnect(): Promise<Result>;
  adapterSign(blockhash: string): Promise<Result>;
  adapterSignAll(count: number, blockhash: string): Promise<Result | NamedFailure>;
  adapterSend(blockhash: string): Promise<Result>;
  raw(type: string, payload: Record<string, unknown>): Promise<unknown>;
  rawTx(account: string, blockhash: string): string;
  customSign(blockhash: string, payer: string, ixs: RawIx[]): Promise<Result>;
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

/** B1c-2: the test dApp's transaction calls (e2e/fixtures/dapp/page.ts), each a v0 transfer at `blockhash`. */
export const signTx = (p: Page, count: number, blockhash: string) => p.evaluate(({n, b}) => dapp.signTx(n, b), {n: count, b: blockhash});
export const sendTx = (p: Page, blockhash: string, lamports: number) => p.evaluate(({b, l}) => dapp.send(b, l), {b: blockhash, l: lamports});
/** B1c-2 Task 10 fix round 1 (I1): a transaction from arbitrary instructions, through the real solana:signTransaction
 * feature — the decoder's own-safety-relevant states (an unknown program, a known program's undecoded instruction,
 * an SPL token transfer, a no-balance-change approve); `payer` need not be the connected account. */
export const customSignTx = (p: Page, blockhash: string, payer: string, ixs: RawIx[]) => p.evaluate(({b, pk, i}) => dapp.customSign(b, pk, i), {b: blockhash, pk: payer, i: ixs});
/** A transaction request posted straight to the relay (any script on a page can), naming `account`. */
export const rawSignTx = (p: Page, account: string, blockhash: string) => p.evaluate(({a, b}) => dapp.raw('page.signTransaction', {account: a, transactions: [dapp.rawTx(a, b)]}), {a: account, b: blockhash});
export const adapter = {
  compatible: (p: Page) => p.evaluate(() => dapp.adapterCompatible()),
  connect: (p: Page) => p.evaluate(() => dapp.adapterConnect()),
  sign: (p: Page, blockhash: string) => p.evaluate(b => dapp.adapterSign(b), blockhash),
  signAll: (p: Page, count: number, blockhash: string) => p.evaluate(({n, b}) => dapp.adapterSignAll(n, b), {n: count, b: blockhash}),
  send: (p: Page, blockhash: string) => p.evaluate(b => dapp.adapterSend(b), blockhash),
};

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
