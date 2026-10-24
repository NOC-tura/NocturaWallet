import type {WalletOptions, Wallet} from '../../__tests__/harness';
import type {GeoAnswer} from '../../../background/geo/gate';
import {BLOCKHASH, HOLDING_LARGE, HOLDING_SMALL} from '../../../background/__tests__/fixtures';
import {ACCOUNT, allocationData, chainMap, chainReader, program, userData, type Chain} from '../../../background/presale/__tests__/chain';
import {honestSimulation} from '../../../background/presale/__tests__/simulation';
import {MAINNET_USDC_MINT, MAINNET_USDT_MINT} from '../../../../../core/presale/addresses';
import {firstSignature} from '../../../../../core/solana/broadcast';
import type {AccountData, TokenAccountEntry} from '../../../../../core/solana/rpc';
import {purchaseViewOf, type PurchaseView} from '../client';

/**
 * B1d-1b Task 5: a wallet able to buy — the program state from chain.ts's byte builders, the honest simulation, the gate
 * and the prices as deps, a broadcast route that keeps what it is handed and answers the transaction's own signature,
 * and ONE clock for the background and the popup (the quote's 30 s is the background's; #20 counts it down on the
 * popup's). For #20's purchase variant and the resume tests, against the real background.
 */
export const SOL_USD = 198.42;
export const OPEN: GeoAnswer = {open: true, reason: null, countryCode: 'SI'};
const holding = (pubkey: string, mint: string, amount: bigint): TokenAccountEntry => ({pubkey, mint, owner: ACCOUNT, amount, decimals: 6});
export const HOLDINGS: TokenAccountEntry[] = [holding(HOLDING_LARGE, MAINNET_USDC_MINT, 50_000_000n), holding(HOLDING_SMALL, MAINNET_USDT_MINT, 7_000_000n)];
/** An account that bought before (its presale accounts exist, purchase_count 2): no first purchase, no account setup. */
export const BOUGHT_BEFORE: Partial<Chain> = {allocation: program(allocationData()), user: program(userData())};

export interface PurchaseWorld {
  chain: Map<string, AccountData | null>;
  wallet: {sol: bigint};
  geo: {answer: GeoAnswer};
  /** The background's and the popup's clock — the test's own (fake timers move both; the sale started before chain.ts's NOW_MS). */
  now: () => number;
  broadcasts: Uint8Array[];
  options: WalletOptions;
}

export function purchaseWorld(o: {chain?: Partial<Chain>; sol?: bigint; before?: WalletOptions['before']; gate?: WalletOptions['gate']; surface?: WalletOptions['surface']} = {}): PurchaseWorld {
  const chain = chainMap(o.chain);
  const wallet = {sol: o.sol ?? 12_482_100_000n};
  const geo = {answer: OPEN};
  const now = () => Date.now();
  const broadcasts: Uint8Array[] = [];
  const reader = chainReader(chain, [], {
    getBalance: async () => wallet.sol,
    getTokenAccountsByOwner: async (_owner, filter) => HOLDINGS.filter(h => !('mint' in filter) || h.mint === filter.mint),
    getSignaturesForAddress: async () => [],
    getRecentPrioritizationFees: async () => [],
    getLatestBlockhash: async () => ({blockhash: BLOCKHASH, lastValidBlockHeight: 1000}),
    simulateTransaction: async (wire, opts) => honestSimulation(wire, opts?.accounts ?? [], chain, wallet.sol, HOLDINGS, SOL_USD),
  });
  const deps = {
    geo: async () => geo.answer,
    prices: async () => ({solana: SOL_USD, usdc: 1, usdt: 1}),
    now,
    broadcast: async (wire: Uint8Array) => {
      broadcasts.push(wire);
      return firstSignature(wire);
    },
  };
  return {
    chain,
    wallet,
    geo,
    now,
    broadcasts,
    options: {reader, deps, now, ...(o.before === undefined ? {} : {before: o.before}), ...(o.gate === undefined ? {} : {gate: o.gate}), ...(o.surface === undefined ? {} : {surface: o.surface})},
  };
}

/** presale.prepareBuy through the real background, as #23's Buy asks it: the purchase it prepared. */
export async function preparePurchase(w: Wallet, intent: {currency: 'SOL' | 'USDC' | 'USDT'; amount: string; stage?: number}, challengeId?: string): Promise<PurchaseView> {
  const r = (await w.transport({type: 'presale.prepareBuy', account: ACCOUNT, intent: {currency: intent.currency, amount: intent.amount, stage: intent.stage ?? 0}, ...(challengeId === undefined ? {} : {challengeId})})) as {ok: boolean; data?: unknown; error?: string};
  const view = r.ok ? purchaseViewOf(r.data) : undefined;
  if (view === undefined) throw new Error(`prepare refused: ${r.error ?? 'malformed'}`);
  return view;
}
