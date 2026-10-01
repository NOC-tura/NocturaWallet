import type {ReactElement} from 'react';
import {render} from '@testing-library/react';
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
import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';

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

export interface Wallet {
  ext: ReturnType<typeof fakeExt>;
  deps: ReturnType<typeof fakeDeps>;
  platform: Platform & {opened: string[]; closed: number};
  engine: Engine;
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
}

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
  const platform = {
    opened,
    closed: 0,
    openPage(page: string) {
      opened.push(page);
    },
    closeWindow() {
      platform.closed += 1;
    },
    version: () => '0.1.0',
  };
  const transport: Transport = m => handleMessage(ext, m, POPUP, deps);
  return {ext, deps, platform, engine: createEngine(transport, async () => undefined)};
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
