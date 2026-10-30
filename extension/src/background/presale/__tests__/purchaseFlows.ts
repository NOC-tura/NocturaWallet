import {base64} from '@scure/base';
import {PRESALE_BUY_INTENT, preparePurchase, type PurchaseIntent} from '../buy';
import {intentDigest} from '../../intents';
import {preparedIntegrity} from '../../prepare';
import {sendPrepared} from '../../send';
import {satisfyChallenge} from '../../reauthChallenges';
import {PREPARED_KEY, REAUTH_KEY} from '../../session';
import {PENDING_KEY} from '../../pendingStore';
import {pollOnce} from '../../pending';
import {fakeDeps} from '../../__tests__/fakeDeps';
import {fakeExt} from '../../__tests__/fakeExt';
import {BLOCKHASH, HOLDING_LARGE, HOLDING_SMALL, unlocked} from '../../__tests__/fixtures';
import {MAINNET_USDC_MINT, MAINNET_USDT_MINT} from '../../../../../core/presale/addresses';
import {firstSignature} from '../../../../../core/solana/broadcast';
import type {AccountData, TokenAccountEntry} from '../../../../../core/solana/rpc';
import {ACCOUNT, NOW_MS, REFERRER, allocationData, chainMap, chainReader, program, userData, type Chain} from './chain';
import {honestSimulation} from './simulation';

// B1d-2 Task 2: the purchases B1d-1b made, as flows that run unchanged on B1d-1b's tree (main a1bda47) and on this one —
// the capture step ran them there once and wrote `captured/purchases.a1bda47.json`; captured.test.ts runs them here and
// compares byte for byte. Only what both trees have is used: the purchase's prepare and the shared pipeline, chain.ts's
// chain and simulation.ts's honest simulation. Every flow names no referral address (B1d-2's new input).

const SOL_USD = 198.42;
const HOLDINGS: TokenAccountEntry[] = [
  {pubkey: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', mint: MAINNET_USDC_MINT, owner: ACCOUNT, amount: 30_000_000n, decimals: 6},
  {pubkey: HOLDING_LARGE, mint: MAINNET_USDC_MINT, owner: ACCOUNT, amount: 500_000_000n, decimals: 6},
  {pubkey: HOLDING_SMALL, mint: MAINNET_USDT_MINT, owner: ACCOUNT, amount: 70_000_000n, decimals: 6},
];

export interface PurchaseFlow {
  intent: PurchaseIntent;
  view: string;
  prepared: string;
  challenges: string;
  wire: string;
  sent: string;
  polled: string;
}
export interface PurchaseCapture {
  capturedFrom: string;
  digests: {account: string; intent: PurchaseIntent; digest: string}[];
  integrity: {entry: Record<string, unknown>; integrity: string}[];
  flows: Record<'firstSol' | 'repeatUsdc' | 'onChainReferrerSol', PurchaseFlow>;
}

const text = (v: unknown): string => JSON.stringify(v ?? null);

/** One purchase through the engine: prepared, proven when asked, signed and sent once, then confirmed. */
async function flow(chain: Partial<Chain>, intent: PurchaseIntent): Promise<PurchaseFlow> {
  const ext = fakeExt();
  await unlocked(ext);
  const map: Map<string, AccountData | null> = chainMap(chain);
  const sol = 5_000_000_000n;
  const reader = chainReader(map, [], {
    getBalance: async () => sol,
    getTokenAccountsByOwner: async (_owner, filter) => HOLDINGS.filter(h => 'mint' in filter && h.mint === filter.mint),
    getRecentPrioritizationFees: async () => [],
    getLatestBlockhash: async () => ({blockhash: BLOCKHASH, lastValidBlockHeight: 1000}),
    simulateTransaction: async (wire, opts) => honestSimulation(wire, opts?.accounts ?? [], map, sol, HOLDINGS, SOL_USD),
  });
  const deps = fakeDeps({reader, geo: async () => ({open: true, reason: null, countryCode: 'SI'}), prices: async () => ({solana: SOL_USD, usdc: 1, usdt: 1})});
  deps.clock.t = NOW_MS;
  deps.broadcast = async wire => {
    deps.broadcasts.push(wire);
    return firstSignature(wire);
  };
  const view = await preparePurchase(ext, deps, ACCOUNT, intent);
  const prepared = text(await ext.session.get(PREPARED_KEY));
  const challenges = text(await ext.session.get(REAUTH_KEY));
  if (view.reauth !== null && !(await satisfyChallenge(ext, deps.now(), view.reauth.challengeId))) throw new Error('the challenge was not proven');
  await sendPrepared(ext, deps, view.id, 'presale-buy');
  const sent = text(await ext.local.get(PENDING_KEY));
  deps.reader = {...deps.reader, getSignatureStatuses: async sigs => sigs.map(() => ({err: null, confirmationStatus: 'confirmed' as const})), getBlockHeight: async () => 900};
  deps.clock.t += 2_000;
  await pollOnce(ext, deps);
  const polled = text(await ext.local.get(PENDING_KEY));
  const wire = deps.broadcasts.map(w => base64.encode(w));
  if (wire.length !== 1) throw new Error(`${wire.length} broadcasts`);
  return {intent, view: text(view), prepared, challenges, wire: wire[0] as string, sent, polled};
}

export async function runPurchaseFlows(capturedFrom: string): Promise<PurchaseCapture> {
  // 1. The challenge digest of a purchase: three currencies, the u64 bounds, three stages, two accounts.
  const intents: PurchaseIntent[] = [
    {currency: 'SOL', amount: '2000000000', stage: 0},
    {currency: 'USDC', amount: '1', stage: 9},
    {currency: 'USDT', amount: '18446744073709551615', stage: 3},
  ];
  const digests = [ACCOUNT, REFERRER].flatMap(account => intents.map(intent => ({account, intent, digest: intentDigest(PRESALE_BUY_INTENT, account, intent)})));
  // 2. The integrity of a stored purchase entry, with and without a challenge.
  const integrity = [null, 'ab'.repeat(16)].map(challengeId => {
    const entry = {id: 'cd'.repeat(16), account: ACCOUNT, kind: 'presale-buy', intent: intents[0] as PurchaseIntent, message: 'AQID', lastValidBlockHeight: 1000, createdAt: 1_000_000, intentDigest: 'ef'.repeat(32), challengeId};
    return {entry, integrity: preparedIntegrity(entry)};
  });
  // 3. Three purchases: a first SOL purchase (both PDAs created, re-authenticated); a USDC purchase from an account that
  // bought before (no challenge, the largest holding pays); a SOL purchase credited to an on-chain referrer (no challenge).
  const existing: Partial<Chain> = {user: program(userData()), allocation: program(allocationData())};
  return {
    capturedFrom,
    digests,
    integrity,
    flows: {
      firstSol: await flow({}, {currency: 'SOL', amount: '2000000000', stage: 0}),
      repeatUsdc: await flow(existing, {currency: 'USDC', amount: '20000000', stage: 0}),
      onChainReferrerSol: await flow({...existing, allocation: program(allocationData({referrer: REFERRER}))}, {currency: 'SOL', amount: '200000000', stage: 0}),
    },
  };
}
