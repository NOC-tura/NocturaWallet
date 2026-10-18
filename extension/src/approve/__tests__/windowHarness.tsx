import {AsyncLocalStorage} from 'node:async_hooks';
import {act, cleanup, render} from '@testing-library/react';
import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {GRANTS_KEY} from '../../background/dapp/grants';
import {Approve} from '../Approve';
import {createClient, type ApproveClient} from '../client';
import {handleMessage} from '../../background/messages';
import {VAULT_KEY} from '../../background/accountsStore';
import {setSession} from '../../background/session';
import {runUnlockHook} from '../../background/dapp/queue';
import {fakeExt} from '../../background/__tests__/fakeExt';
import {fakeDeps} from '../../background/__tests__/fakeDeps';
import {ACCOUNT} from '../../background/__tests__/fixtures';
import {openPage, type Page} from '../../background/dapp/__tests__/pageHarness';
import {chainReader, newChain, type Chain} from '../../background/dapp/__tests__/txHarness';

/**
 * B1c-3 (plan 3 Task 9): the window's timers — the 1 s poll, C15's 500 ms hold, the red-flag screen's 1.5 s hold, the
 * 2-second confirm — run on the harness's clock, never the wall clock: a test that slept through a hold in real time
 * lost the race to it under CPU load (the window's timer and React's render landing after the test's own timer). Time
 * moves only by `elapse`; `settled` waits for the background and React by real event-loop turns with the clock still.
 */
export function onHarnessClock(): void {
  beforeEach(() => {
    current += 1;
    running.enterWith(current);
    vi.useFakeTimers({toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval']});
  });
  afterEach(async () => {
    current += 1;
    // React does not support overlapping act() scopes: one still open (a timed-out test's) closes before cleanup's.
    while (acting > 0) await new Promise<void>(r => realSetTimeout(r, 0));
    cleanup();
    vi.useRealTimers();
  });
}
/**
 * A test vitest timed out goes on running — nothing cancels it. Its next step here (a window shown, the clock moved, a
 * turn waited), or the end of the act() it was in, throws instead of acting on the tests after it (its own act() scopes
 * included, which React cannot overlap); without this, one CPU-starved test failed the tests after it in its file.
 */
const running = new AsyncLocalStorage<number>();
let current = 0;
function stillRunning(): void {
  const test = running.getStore();
  if (test !== undefined && test !== current) throw new Error('this test has already ended (it timed out): stopped here');
}
let acting = 0;
const realSetTimeout = globalThis.setTimeout;
async function inAct(step: () => Promise<unknown>): Promise<void> {
  stillRunning();
  acting += 1;
  try {
    await act(async () => void (await step()));
  } finally {
    acting -= 1;
  }
  stillRunning();
}
/** `fire` (an event, a typed word) inside act(), its renders flushed — the harness's act, so a timed-out test's one is known. */
export const acted = (fire: () => unknown): Promise<void> => inAct(async () => void fire());
/** The harness's clock moves `ms` on: every window timer due by then fires, in order, each render flushed. */
export const elapse = (ms: number): Promise<void> => inAct(() => vi.advanceTimersByTimeAsync(ms));
/** The harness's clock moves to the next window timer due and fires it alone (the poll, when no hold is pending). */
export const nextTimer = (): Promise<void> => inAct(() => vi.advanceTimersToNextTimerAsync());
/**
 * Real event-loop turns `settled` gives a check — a count, not a duration: the background's work here is promise chains
 * (the fake chrome.*, the steered chain), each drained whole in one turn; every check in these files passes within one.
 */
export const SETTLE_TURNS = 20;
/** `check` once it passes (returns without throwing), the clock standing still; its last failure after SETTLE_TURNS turns. */
export async function settled<T>(check: () => T | Promise<T>): Promise<T> {
  let last: unknown = new Error('never checked');
  for (let turn = 0; turn < SETTLE_TURNS; turn++) {
    try {
      return await check();
    } catch (e) {
      last = e;
    }
    await inAct(() => new Promise<void>(r => realSetTimeout(r, 0)));
  }
  throw last;
}

/** A second real keypair (32 × 0x02): vault.setKeys checks every key. */
const SEED2 = new Uint8Array(32).fill(2);
const PUB2 = ed25519.getPublicKey(SEED2);
export const SECOND = {index: 1, publicKey: base58.encode(PUB2), secretKey: base64.encode(new Uint8Array([...SEED2, ...PUB2]))};
export const ENV = {
  v: 1,
  scheme: 'slip10',
  accounts: [
    {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
    {index: 1, name: 'Savings', publicKey: SECOND.publicKey},
  ],
};

/**
 * The approval window against the REAL background (handleMessage with approve.html as the sender, the fake chrome.*),
 * and pages that ask it through the real page partition (pageHarness). `closed` counts window.close().
 */
export async function openWindow(o: {unlocked?: boolean; chain?: Chain} = {}) {
  const ext = fakeExt();
  // B1c-2: the chain a transaction request is simulated against (txHarness's steered one).
  const chain = o.chain ?? newChain();
  const deps = fakeDeps({reader: chainReader(chain)});
  await ext.local.set(VAULT_KEY, ENV);
  if (o.unlocked !== false) {
    await setSession(ext, [ACCOUNT, SECOND]);
    await runUnlockHook(ext, deps);
  }
  const approve = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/approve.html`};
  const sent: unknown[] = [];
  const closed = {n: 0};
  // B1c-2 (plan 2 rev 2, dry-run item): a closed window is gone — it reads nothing more. Without this, a still-mounted
  // window's next 1 s poll read `none` again and counted a second close, so `closed.n === 1` was a race under load.
  const client: ApproveClient = createClient(m => {
    if (closed.n > 0) return Promise.reject(new Error('the window is closed'));
    sent.push(m);
    return handleMessage(ext, m, approve, deps);
  });
  let tab = 10;
  /** A page on its own tab that asks to connect; the request's id and the page. */
  const connect = async (origin: string): Promise<{page: Page; requestId: string}> => {
    const page = openPage(ext, deps, origin, {tab: {id: tab++}});
    const r = await page.ask({type: 'page.connect', id: `c${tab}`, silent: false});
    return {page, requestId: String(r?.requestId)};
  };
  /** A page holding a session-free persistent grant for ACCOUNT that asks to sign `message` (UTF-8). */
  const sign = async (origin: string, message: string): Promise<{page: Page; requestId: string}> => {
    const grants = ((await ext.local.get(GRANTS_KEY)) as unknown[] | undefined) ?? [];
    await ext.local.set(GRANTS_KEY, [...grants, {origin, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: []}]);
    const page = openPage(ext, deps, origin, {tab: {id: tab++}});
    const r = await page.ask({type: 'page.signMessage', id: `s${tab}`, account: ACCOUNT.publicKey, message: base64.encode(new TextEncoder().encode(message))});
    if (r?.accepted !== true) throw new Error(`sign request not queued: ${JSON.stringify(r)}`);
    return {page, requestId: String(r.requestId)};
  };
  /**
   * B1c-2: a page holding a persistent grant for ACCOUNT that asks to sign these transactions (base64) — or to sign and
   * send the first; `known` makes the recipients known (no re-authentication for a first send).
   */
  const signTx = async (origin: string, transactions: string[], o2: {send?: boolean} = {}): Promise<{page: Page; requestId: string}> => {
    const grants = ((await ext.local.get(GRANTS_KEY)) as unknown[] | undefined) ?? [];
    await ext.local.set(GRANTS_KEY, [...grants, {origin, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: []}]);
    const page = openPage(ext, deps, origin, {tab: {id: tab++}});
    const m = o2.send === true ? {type: 'page.signAndSendTransaction', transaction: transactions[0]} : {type: 'page.signTransaction', transactions};
    const r = await page.ask({...m, id: `t${tab}`, account: ACCOUNT.publicKey});
    if (r?.accepted !== true) throw new Error(`transaction request not queued: ${JSON.stringify(r)}`);
    return {page, requestId: String(r.requestId)};
  };
  const show = () => {
    stillRunning();
    return render(
      <div className="app app-window">
        <Approve client={client} close={() => void (closed.n += 1)} />
      </div>,
    );
  };
  return {ext, deps, chain, client, closed, sent, connect, sign, signTx, show, unlock: () => handleMessage(ext, {type: 'vault.setKeys', accounts: [ACCOUNT, SECOND]}, {...approve, url: `${ext.extensionOrigin}/unlock.html`}, deps)};
}
