import type {ReactElement} from 'react';
import {cleanup, render} from '@testing-library/react';
import {createEngine, type Engine, type Transport} from '../engine';
import type {Platform} from '../platform';
import {WalletProvider, type Surface} from '../WalletContext';
import {handleMessage} from '../../background/messages';
import {VAULT_KEY} from '../../background/accountsStore';
import {setSession} from '../../background/session';
import type {WalletDeps} from '../../background/deps';
import type {SessionAccount} from '../../vault/accounts';
import type {SolanaReader} from '../../../../core/solana/rpc';
import {WALLET_TOKENS} from '../../../../core/solana/balances';
import {fakeDeps, fakeReader} from '../../background/__tests__/fakeDeps';
import {fakeExt} from '../../background/__tests__/fakeExt';
import {ACCOUNT, HOLDING_LARGE, HOLDING_SMALL, RECIPIENT, sendReader} from '../../background/__tests__/fixtures';

/**
 * The screens against the REAL background (handleMessage, fake Ext, fake deps) — the same wiring as
 * engine.test.ts, rendered in happy-dom. The platform (tabs, window.close, version) is a spy. Screens
 * are rendered inside the real WalletProvider; App.test.tsx renders the whole App.
 */
export const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
export const POPUP = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: ORIGIN, url: `${ORIGIN}/popup.html`};
export const SECOND = {index: 1, publicKey: RECIPIENT, secretKey: ACCOUNT.secretKey};
export const ENV = {
  v: 1,
  scheme: 'slip10',
  accounts: [
    {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
    {index: 1, name: 'Savings', publicKey: RECIPIENT},
  ],
};
export const NOC = WALLET_TOKENS.NOC.mint as string;
export const USDC = WALLET_TOKENS.USDC.mint as string;

/** 62.4821 SOL, 4 200 NOC, 740.21 USDC, no USDT — the design's #11 numbers. */
export function walletReader(over: Partial<SolanaReader> = {}): SolanaReader {
  return fakeReader({
    getBalance: async () => 62_482_100_000n,
    getTokenAccountsByOwner: async owner => [
      {pubkey: 'h1', mint: NOC, owner, amount: 4_200_000_000_000n, decimals: 9},
      {pubkey: 'h2', mint: USDC, owner, amount: 740_210_000n, decimals: 6},
    ],
    getSignaturesForAddress: async () => [],
    ...over,
  });
}

/**
 * walletReader's wallet, able to send (plan 3): quiet fees, a blockhash valid to height 1000, the recipient an
 * existing wallet, and a simulation consistent with the transaction it is given (E2, the background fixtures'
 * sendReader) — with the harness's balances and real token-account addresses, filtered by mint as the RPC does.
 */
export function sendingReader(over: Partial<SolanaReader> = {}): SolanaReader {
  const holdings = (owner: string) => [
    {pubkey: HOLDING_LARGE, mint: NOC, owner, amount: 4_200_000_000_000n, decimals: 9},
    {pubkey: HOLDING_SMALL, mint: USDC, owner, amount: 740_210_000n, decimals: 6},
  ];
  return sendReader({
    getBalance: async () => 62_482_100_000n,
    getTokenAccountsByOwner: async (owner, filter) => holdings(owner).filter(h => !('mint' in filter) || h.mint === filter.mint),
    getSignaturesForAddress: async () => [],
    ...over,
  });
}

export interface Wallet {
  ext: ReturnType<typeof fakeExt>;
  deps: ReturnType<typeof fakeDeps>;
  platform: Platform & {opened: string[]; navigated: string[]; closed: number};
  engine: Engine;
  /** The real background, as the client's transport. */
  transport: Transport;
}

export interface WalletOptions {
  surface?: Surface;
  unlocked?: boolean;
  wallet?: boolean;
  env?: object;
  accounts?: SessionAccount[];
  reader?: SolanaReader;
  deps?: Partial<WalletDeps>;
  before?: (ext: ReturnType<typeof fakeExt>) => Promise<void>;
  /** The provider's clock (default: Date.now). */
  now?: () => number;
  /**
   * Sees every message the client sends, before the background does; may hold it (return a promise) — how a
   * test keeps a state on screen, or counts what a screen asked (plan 3).
   */
  gate?: (m: unknown) => Promise<void> | void;
}

/**
 * Every engine call a test's screens made that has not answered yet. After each test the tree is unmounted and these
 * are drained (bounded by a real-clock wait: some background calls sleep forever by design), so no answer lands after
 * the test file's environment is torn down (the `window is not defined` flake, Task 12 fix round 1).
 */
const inFlight = new Set<Promise<unknown>>();
const realSetTimeout = globalThis.setTimeout;
export const DRAIN_MS = 200;
export async function drainInFlight(): Promise<void> {
  if (inFlight.size === 0) return;
  await Promise.race([Promise.allSettled([...inFlight]), new Promise<void>(r => realSetTimeout(r, DRAIN_MS))]);
  inFlight.clear();
}
afterEach(async () => {
  cleanup();
  await drainInFlight();
});

/** A background with this wallet in it, a client wired to it, and a spy platform. */
export async function setupWallet(o: WalletOptions = {}): Promise<Wallet> {
  const ext = fakeExt();
  if (o.wallet !== false) await ext.local.set(VAULT_KEY, o.env ?? ENV);
  if (o.unlocked !== false && o.wallet !== false) await setSession(ext, o.accounts ?? [ACCOUNT, SECOND]);
  if (o.before !== undefined) await o.before(ext);
  // History paces getTransaction with sleeps under 2 s, which resolve at once here; the pending poller's
  // 2 s sleep never resolves, so no poll loop outlives a test.
  const sleep = (ms: number) => (ms >= 2_000 ? new Promise<void>(() => undefined) : Promise.resolve());
  const deps = fakeDeps({reader: o.reader ?? walletReader(), sleep, ...o.deps});
  const opened: string[] = [];
  const navigated: string[] = [];
  const platform = {
    opened,
    navigated,
    closed: 0,
    openPage(page: string) {
      opened.push(page);
    },
    navigate(page: string) {
      navigated.push(page);
    },
    closeWindow() {
      platform.closed += 1;
    },
    version: () => '0.1.0',
  };
  const transport: Transport = m => {
    const p = handleMessage(ext, m, POPUP, deps);
    inFlight.add(p);
    void p.finally(() => inFlight.delete(p)).catch(() => undefined);
    return p;
  };
  const gated: Transport = async m => {
    await o.gate?.(m);
    return transport(m);
  };
  return {ext, deps, platform, transport, engine: createEngine(o.gate === undefined ? transport : gated, async () => undefined)};
}

/** One screen inside the real provider (the open sequence runs as in the popup). */
export async function renderInWallet(ui: ReactElement, o: WalletOptions = {}): Promise<Wallet> {
  const w = await setupWallet(o);
  render(
    <WalletProvider engine={w.engine} platform={w.platform} surface={o.surface ?? 'popup'} {...(o.now === undefined ? {} : {now: o.now})}>
      {ui}
    </WalletProvider>,
  );
  return w;
}
