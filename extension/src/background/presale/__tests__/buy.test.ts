import {PublicKey, TransactionMessage, VersionedTransaction, type TransactionInstruction} from '@solana/web3.js';
import {base64} from '@scure/base';
import {
  PRESALE_BUY_INTENT,
  PRESALE_BUY_KIND,
  assertPurchaseMessage,
  expectedPurchaseAccounts,
  largerValue,
  parsePurchaseIntent,
  preparePurchase,
  presaleReauthReasons,
  type PreparedPurchase,
  type PurchaseIntent,
} from '../buy';
import {solCents} from '../quote';
import {registerPresale} from '../api';
import {handleMessage, registerPresaleHandler} from '../../messages';
import {CONFIG_LAYOUT, PRESALE_ALLOCATION_LAYOUT} from '../layouts';
import {intentDigest, intentKind, type KindAbout} from '../../intents';
import {challengeInfo, issueChallenge, rebaseChallenge, rebaseKindChallenge, satisfyChallenge} from '../../reauthChallenges';
import {PREPARED_KEY, REAUTH_KEY} from '../../session';
import {PENDING_KEY} from '../../pendingStore';
import {preparedFor} from '../../prepare';
import {sendPrepared} from '../../send';
import {SendRefused} from '../../sendTypes';
import {scaledUsdPrice} from '../../reauthPolicy';
import {fakeDeps, fakeReader} from '../../__tests__/fakeDeps';
import {fakeExt} from '../../__tests__/fakeExt';
import {BLOCKHASH, HOLDING_LARGE, HOLDING_SMALL, SIMULATED_SLOT, pendingRecord, unlocked} from '../../__tests__/fixtures';
import type {GeoAnswer} from '../../geo/gate';
import {PRESALE_INSTRUCTIONS} from '../../dapp/decode/presaleIdl';
import {MAINNET_PROGRAM_ID, MAINNET_USDC_MINT, MAINNET_USDT_MINT, PYTH_SOL_USD_ACCOUNT} from '../../../../../core/presale/addresses';
import {derivePresalePdas, readU64LE} from '../../../../../core/presale/allocation';
import {buildBuyInstructions, buildStablecoinBuyInstructions} from '../../../../../core/presale/buyInstructions';
import {PRESALE_ALLOCATION_RENT_LAMPORTS, PRESALE_USER_ACCOUNT_RENT_LAMPORTS, tokensFor, usdCentsForStable} from '../../../../../core/presale/limits';
import {SPL_TOKEN_PROGRAM} from '../../../../../core/solana/encoding';
import {estimatePriorityFee} from '../../../../../core/solana/priorityFee';
import {networkFeeLamports, priorityFeeLamports} from '../../../../../core/solana/transfer';
import {RequestUnreachable, RpcForbidden, SYSTEM_PROGRAM_ID, type AccountData, type SimulatedAccount, type SimulationOutcome, type TokenAccountEntry} from '../../../../../core/solana/rpc';
import type {Prices} from '../../../../../core/portfolio/value';
import {
  ACCOUNT,
  CONFIG_PDA,
  NOW_MS,
  REFERRER,
  SNAPSHOT_SLOT,
  TREASURY_ADDRESS,
  USDC_VAULT,
  USDT_VAULT,
  allocationData,
  chainMap,
  chainReader,
  configData,
  program,
  tokenAccountData,
  userData,
  vault,
  type Chain,
} from './chain';

registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler});

// B1d §3.3, §3.4 (C2, C10, C11, C21, C23, C27, C28, C36, C39, D3): the purchase's prepare against the byte builders of
// chain.ts and a simulation computed from the transaction it is given — the program's own effects on the accounts the
// prepare asks for — and steered, one change at a time, into every shape a drainer, a lying proxy or a race would give.

const SOL_USD = 198.42;
const OPEN: GeoAnswer = {open: true, reason: null, countryCode: 'SI'};
/** The rents mainnet charges (5 080 lamports per byte of 128 + length, §2.1) — below the bounds, as the runtime is. */
const ALLOCATION_RENT = 1_244_600n;
const USER_RENT = 944_880n;
const PDAS = derivePresalePdas(new PublicKey(ACCOUNT));
const DEFAULT_REFERRER_ALLOCATION = 'C6TE5HwdPxJhUcAdwt6DRr2ceoavWBPqfCqcyFVFAWkQ';
/** The treasury and the USDC vault with characters 5–8 replaced: each truncates exactly as the real one does. */
const LOOKALIKE_TREASURY = '6ZiahdPa3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd';
const USDC_NONCANONICAL_SMALL = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const SOL_2 = '2000000000';
const PRICE = 50_000; // estimatePriorityFee's normal floor, with no recent fees
const NETWORK = networkFeeLamports(1, PRICE, 120_000);

const holding = (pubkey: string, mint: string, amount: bigint, owner = ACCOUNT): TokenAccountEntry => ({pubkey, mint, owner, amount, decimals: 6});
const HOLDINGS: TokenAccountEntry[] = [
  holding(USDC_NONCANONICAL_SMALL, MAINNET_USDC_MINT, 30_000_000n),
  holding(HOLDING_LARGE, MAINNET_USDC_MINT, 500_000_000n),
  holding(HOLDING_SMALL, MAINNET_USDT_MINT, 70_000_000n),
];
const EXISTING: Partial<Chain> = {user: program(userData()), allocation: program(allocationData())};

/** What the program does to the accounts a purchase touches, as a simulation reports them. */
interface Effects {
  currency: 'SOL' | 'USDC' | 'USDT';
  amount: bigint;
  cents: bigint;
  stage: number;
}
type Edit = (o: SimulationOutcome, at: (address: string) => number) => SimulationOutcome;

interface World {
  deps: ReturnType<typeof fakeDeps>;
  ext: ReturnType<typeof fakeExt>;
  reads: number;
  wires: string[];
  asked: (readonly string[])[];
}

/** The k-th of a list, the last one repeated. */
const nth = <T>(xs: readonly T[], k: number): T => xs[Math.min(k, xs.length - 1)] as T;

function effectsOf(wire: string, chain: Map<string, AccountData | null>, pythUsd: number): Effects {
  const message = VersionedTransaction.deserialize(base64.decode(wire)).message;
  const ix = message.compiledInstructions.at(-1);
  if (ix === undefined) throw new Error('no purchase');
  const disc = [...ix.data.subarray(0, 8)];
  const name = PRESALE_INSTRUCTIONS.find(i => i.discriminator.every((b, n) => b === disc[n]))?.name;
  const currency = name === 'presale_purchase_with_sol' ? 'SOL' : name === 'presale_purchase_with_usdc' ? 'USDC' : 'USDT';
  const amount = readU64LE(ix.data, 8);
  const config = chain.get(CONFIG_PDA)?.data ?? new Uint8Array(0);
  const stage = config[CONFIG_LAYOUT.fields.current_stage.offset] as number;
  const cents = currency === 'SOL' ? solCents(amount, scaledUsdPrice(pythUsd) as bigint) : usdCentsForStable(amount);
  return {currency, amount, cents, stage};
}

/** The simulation the program and an honest proxy give for `wire`, against `chain` as it is at that slot. */
function honestSimulation(wire: string, addresses: readonly string[], chain: Map<string, AccountData | null>, sol: bigint, holdings: readonly TokenAccountEntry[], pythUsd: number): SimulationOutcome {
  const e = effectsOf(wire, chain, pythUsd);
  const allocation = chain.get(PDAS.userAllocation.toBase58()) ?? null;
  const user = chain.get(PDAS.userAccount.toBase58()) ?? null;
  const A = PRESALE_ALLOCATION_LAYOUT.fields;
  const before = allocation === null ? {total: 0n, spent: 0n, count: 0} : {total: readU64LE(allocation.data, A.total_tokens.offset), spent: readU64LE(allocation.data, A.total_spent_cents.offset), count: allocation.data[A.purchase_count.offset] as number};
  const referrer = allocation === null ? null : allocation.data.subarray(A.referrer.offset, A.referrer.offset + 32).every(b => b === 0) ? null : new PublicKey(allocation.data.subarray(A.referrer.offset, A.referrer.offset + 32)).toBase58();
  const allocationAfter: SimulatedAccount = {
    lamports: allocation?.lamports ?? ALLOCATION_RENT,
    owner: MAINNET_PROGRAM_ID,
    data: allocationData({totalTokens: before.total + tokensFor(e.cents, e.stage), spent: before.spent + e.cents, count: before.count + 1, referrer, bonus: 0n}),
  };
  const rent = (allocation === null ? ALLOCATION_RENT : 0n) + (user === null ? USER_RENT : 0n);
  const post = (address: string): SimulatedAccount | null => {
    if (address === ACCOUNT) return {lamports: sol - (e.currency === 'SOL' ? e.amount : 0n) - rent, owner: SYSTEM_PROGRAM_ID, data: new Uint8Array(0)};
    if (address === PDAS.userAllocation.toBase58()) return allocationAfter;
    if (address === PDAS.userAccount.toBase58()) return user ?? {lamports: USER_RENT, owner: MAINNET_PROGRAM_ID, data: userData()};
    const before = chain.get(address);
    if (address === TREASURY_ADDRESS && before) return {...before, lamports: before.lamports + (e.currency === 'SOL' ? e.amount : 0n)};
    if ((address === USDC_VAULT || address === USDT_VAULT) && before) {
      const mint = address === USDC_VAULT ? MAINNET_USDC_MINT : MAINNET_USDT_MINT;
      const gain = (e.currency === 'USDC' && address === USDC_VAULT) || (e.currency === 'USDT' && address === USDT_VAULT) ? e.amount : 0n;
      return vault({mint, amount: readU64LE(before.data, 64) + gain});
    }
    const h = holdings.find(x => x.pubkey === address);
    if (h !== undefined) return {lamports: 2_039_280n, owner: SPL_TOKEN_PROGRAM, data: tokenAccountData({mint: h.mint, owner: h.owner, amount: h.amount - e.amount})};
    return null;
  };
  return {err: null, logs: [], unitsConsumed: 61_000, slot: SIMULATED_SLOT, accounts: addresses.map(post)};
}

/**
 * The world: an unlocked wallet holding ACCOUNT; `chains` the program state each successive snapshot read sees and
 * `simChains` (by default the same) each successive simulation, the last one repeated; `edits` steer each simulation.
 */
async function world(
  o: {chain?: Partial<Chain>; chains?: Partial<Chain>[]; simChains?: Partial<Chain>[]; edits?: (Edit | null)[]; sol?: bigint; holdings?: TokenAccountEntry[]; prices?: () => Promise<Prices>; geo?: () => Promise<GeoAnswer>; pythUsd?: number; snapshotSlots?: number[]; read?: () => Promise<never>} = {},
): Promise<World> {
  const chains = (o.chains ?? [o.chain ?? {}]).map(c => chainMap(c));
  const simChains = o.simChains === undefined ? chains : o.simChains.map(c => chainMap(c));
  const sol = o.sol ?? 5_000_000_000n;
  const holdings = o.holdings ?? HOLDINGS;
  const w: World = {deps: fakeDeps(), ext: fakeExt(), reads: 0, wires: [], asked: []};
  let sims = 0;
  const reader = chainReader(chains[0] as Map<string, AccountData | null>, [], {
    getAccountsDataAt: async addresses => {
      if (o.read !== undefined) return o.read();
      const k = w.reads++;
      const chain = nth(chains, k);
      return {slot: nth(o.snapshotSlots ?? [SNAPSHOT_SLOT], k), accounts: addresses.map(a => chain.get(a) ?? null)};
    },
    getBalance: async owner => {
      if (owner !== ACCOUNT) throw new Error(`unexpected owner ${owner}`);
      return sol;
    },
    getTokenAccountsByOwner: async (owner, filter) => {
      if (owner !== ACCOUNT || !('mint' in filter)) throw new Error('a purchase reads the holdings of its own mint');
      return holdings.filter(h => h.mint === filter.mint);
    },
    getRecentPrioritizationFees: async () => [],
    getLatestBlockhash: async () => ({blockhash: BLOCKHASH, lastValidBlockHeight: 1000}),
    simulateTransaction: async (wire, opts) => {
      const k = sims++;
      w.wires.push(wire);
      w.asked.push(opts?.accounts ?? []);
      const addresses = opts?.accounts ?? [];
      const honest = honestSimulation(wire, addresses, nth(simChains, k), sol, holdings, o.pythUsd ?? SOL_USD);
      const edit = (o.edits ?? [])[k] ?? null;
      return edit === null ? honest : edit(honest, a => addresses.indexOf(a));
    },
  });
  w.deps = fakeDeps({reader, geo: o.geo ?? (async () => OPEN), prices: o.prices ?? (async () => ({solana: SOL_USD, usdc: 1, usdt: 1}))});
  w.deps.clock.t = NOW_MS;
  await unlocked(w.ext);
  return w;
}

const intent = (currency: PurchaseIntent['currency'], amount: string, stage = 0): PurchaseIntent => ({currency, amount, stage});
const prepare = (w: World, i: PurchaseIntent, opts: {challengeId?: string} = {}) => preparePurchase(w.ext, w.deps, ACCOUNT, i, opts);
async function refusal(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof Error && 'code' in e) return String((e as {code: unknown}).code);
    throw e;
  }
  throw new Error('not refused');
}
const stored = async (w: World): Promise<PreparedPurchase[]> => ((await w.ext.session.get(PREPARED_KEY)) as PreparedPurchase[] | undefined) ?? [];
/** One account of a simulation changed. */
const withAccount = (address: string, f: (a: SimulatedAccount | null) => SimulatedAccount | null): Edit => (o, at) => {
  const accounts = [...(o.accounts ?? [])];
  const i = at(address);
  if (i < 0) throw new Error(`the simulation was not asked for ${address}`);
  accounts[i] = f(accounts[i] ?? null);
  return {...o, accounts};
};
const lamportsMinus = (address: string, n: bigint): Edit => withAccount(address, a => (a === null ? null : {...a, lamports: a.lamports - n}));
const allocationEdit = (f: (d: Uint8Array) => void): Edit =>
  withAccount(PDAS.userAllocation.toBase58(), a => {
    if (a === null) return null;
    const data = Uint8Array.from(a.data);
    f(data);
    return {...a, data};
  });
const putU64At = (d: Uint8Array, offset: number, v: bigint) => {
  for (let i = 0; i < 8; i++) d[offset + i] = Number((v >> BigInt(8 * i)) & 0xffn);
};
const A = PRESALE_ALLOCATION_LAYOUT.fields;
/** A first purchase's allocation after, crediting `cents` and the NOC the program gives for them at stage 0. */
const credited = (cents: bigint): Edit =>
  allocationEdit(d => {
    putU64At(d, A.total_spent_cents.offset, cents);
    putU64At(d, A.total_tokens.offset, tokensFor(cents, 0));
  });
const SOL_CENTS = solCents(2_000_000_000n, scaledUsdPrice(SOL_USD) as bigint);

describe('the purchase intent (§1.4)', () => {
  it('parsed key by key: a currency, a positive u64 amount, a stage 0–9', () => {
    expect(parsePurchaseIntent({currency: 'USDT', amount: '1', stage: 9})).toEqual({currency: 'USDT', amount: '1', stage: 9});
    expect(parsePurchaseIntent({currency: 'SOL', amount: '18446744073709551615', stage: 0})).toEqual({currency: 'SOL', amount: '18446744073709551615', stage: 0});
    for (const bad of [
      null,
      [],
      {currency: 'NOC', amount: '1', stage: 0},
      {currency: 'sol', amount: '1', stage: 0},
      {currency: 'SOL', amount: '0', stage: 0},
      {currency: 'SOL', amount: '01', stage: 0},
      {currency: 'SOL', amount: '18446744073709551616', stage: 0},
      {currency: 'SOL', amount: 1, stage: 0},
      {currency: 'SOL', amount: '1', stage: 10},
      {currency: 'SOL', amount: '1', stage: -1},
      {currency: 'SOL', amount: '1', stage: 1.5},
      {currency: 'SOL', amount: '1', stage: '0'},
      {currency: 'SOL', amount: '1'},
      {currency: 'SOL', amount: '1', stage: 0, referrer: null},
    ]) {
      expect([bad, parsePurchaseIntent(bad)]).toEqual([bad, null]);
    }
  });

  it('registered as the presale-buy kind; its digest binds the account, currency, amount and stage under its own domain', () => {
    expect(intentKind(PRESALE_BUY_KIND)).toBe(PRESALE_BUY_INTENT);
    const base = intentDigest(PRESALE_BUY_INTENT, ACCOUNT, intent('SOL', SOL_2));
    const others = [intentDigest(PRESALE_BUY_INTENT, REFERRER, intent('SOL', SOL_2)), intentDigest(PRESALE_BUY_INTENT, ACCOUNT, intent('USDC', SOL_2)), intentDigest(PRESALE_BUY_INTENT, ACCOUNT, intent('SOL', '2000000001')), intentDigest(PRESALE_BUY_INTENT, ACCOUNT, intent('SOL', SOL_2, 1))];
    expect(new Set([base, ...others]).size).toBe(5);
    expect(intentDigest(PRESALE_BUY_INTENT, ACCOUNT, intent('SOL', SOL_2))).toBe(base);
  });
});

describe('re-authentication (§3.4, D3, C21, C36)', () => {
  const r = (o: Partial<Parameters<typeof presaleReauthReasons>[0]> = {}) =>
    presaleReauthReasons({firstPurchase: false, amount: 5n, balance: 100n, usdMicros: 100_000_000n, thresholdCents: 10_000, ...o});

  it('none at the boundaries: exactly 5 % of the balance, exactly the threshold, not a first purchase (positive control)', () => {
    expect(r()).toEqual([]);
  });

  it('first-purchase; over 5 % one unit above it; a zero balance above it; over the threshold one micro-dollar above it', () => {
    expect(r({firstPurchase: true})).toEqual(['first-purchase']);
    expect(r({amount: 6n})).toEqual(['over-5-percent']);
    expect(r({balance: 0n, amount: 1n})).toEqual(['over-5-percent']);
    expect(r({usdMicros: 100_000_001n})).toEqual(['over-usd-threshold']);
    expect(r({firstPurchase: true, amount: 6n, usdMicros: null})).toEqual(['first-purchase', 'over-5-percent', 'over-usd-threshold']);
  });

  it('the dollar value is the larger of the price’s and the simulation’s; unknown only when both are (C36)', () => {
    expect(largerValue(99_000_000n, 100_000_001n)).toBe(100_000_001n);
    expect(largerValue(100_000_001n, 99_000_000n)).toBe(100_000_001n);
    expect(largerValue(null, 99_000_000n)).toBe(99_000_000n);
    expect(largerValue(99_000_000n, null)).toBe(99_000_000n);
    expect(largerValue(null, null)).toBeNull();
    expect(r({usdMicros: largerValue(99_000_000n, 100_000_001n)})).toEqual(['over-usd-threshold']);
    expect(r({usdMicros: largerValue(null, null)})).toEqual(['over-usd-threshold']);
  });

  it('first-purchase: allocation absent, or present with purchase_count 0 — not for 1 (through prepare)', async () => {
    const reasons = async (chain: Partial<Chain>) => (await prepare(await world({chain}), intent('USDC', '10000000'))).reauth?.reasons ?? [];
    expect(await reasons({})).toEqual(['first-purchase']);
    expect(await reasons({user: program(userData()), allocation: program(allocationData({count: 0, spent: 0n, totalTokens: 0n}))})).toEqual(['first-purchase']);
    expect(await reasons({user: program(userData()), allocation: program(allocationData({count: 1}))})).toEqual([]);
  });

  it('through prepare: a stablecoin with no price at /wallet/prices is valued at the simulation’s cents — above when they are, not when they are not', async () => {
    const noPrices = async () => ({});
    expect((await prepare(await world({chain: EXISTING, prices: noPrices}), intent('USDC', '10000000'))).reauth).toBeNull();
    const above = await prepare(await world({chain: EXISTING, prices: noPrices, holdings: [holding(HOLDING_LARGE, MAINNET_USDC_MINT, 10_000_000_000n)]}), intent('USDC', '100010000'));
    expect(above.reauth?.reasons).toEqual(['over-usd-threshold']);
  });

  it('through prepare: the price below the threshold and the simulation’s cents above it → above (C36)', async () => {
    // Our price says $99.99; the program (Pyth) says $100.01 — the program's number is what is charged.
    const w = await world({chain: EXISTING, sol: 1_000_000_000_000n, prices: async () => ({solana: 99.99, usdc: 1, usdt: 1}), pythUsd: 100.01});
    expect((await prepare(w, intent('SOL', '1000000000'))).reauth?.reasons).toEqual(['over-usd-threshold']);
    const below = await world({chain: EXISTING, sol: 1_000_000_000_000n, prices: async () => ({solana: 99.99, usdc: 1, usdt: 1}), pythUsd: 99.99});
    expect((await prepare(below, intent('SOL', '1000000000'))).reauth).toBeNull();
  });

  it('the 5 % is of the paying token’s total held, not of the account it pays from (§3.4)', async () => {
    // 26 USDC: above 5 % of the largest holding (500), not of the total (530).
    expect((await prepare(await world({chain: EXISTING}), intent('USDC', '26000000'))).reauth).toBeNull();
    expect((await prepare(await world({chain: EXISTING}), intent('USDC', '26500001'))).reauth?.reasons).toEqual(['over-5-percent']);
  });

  it('never a send’s reason: no first-send and no whole-balance-to-new, even for the whole of a balance on a first purchase', async () => {
    const w = await world({holdings: [holding(HOLDING_LARGE, MAINNET_USDC_MINT, 10_000_000n)]});
    expect((await prepare(w, intent('USDC', '10000000'))).reauth?.reasons).toEqual(['first-purchase', 'over-5-percent']);
  });
});

describe('prepare: a SOL purchase, every check passing (the positive control)', () => {
  it('a first purchase: the view, the simulated rent of both new PDAs, the entry stored, nothing signed', async () => {
    const w = await world();
    const view = await prepare(w, intent('SOL', SOL_2));
    const nocBase = tokensFor(SOL_CENTS, 0);
    expect(view).toEqual({
      id: expect.any(String),
      currency: 'SOL',
      amount: SOL_2,
      stage: 0,
      priceTicks: '1501',
      nocBase: nocBase.toString(),
      spentCents: SOL_CENTS.toString(),
      destination: TREASURY_ADDRESS,
      referrer: null,
      fees: {networkLamports: NETWORK.toString(), priorityLamports: priorityFeeLamports(PRICE, 120_000).toString(), rentLamports: (ALLOCATION_RENT + USER_RENT).toString()},
      reauth: {challengeId: expect.stringMatching(/^[0-9a-f]{32}$/), reasons: ['first-purchase', 'over-5-percent', 'over-usd-threshold'], proven: false},
      validUntil: w.deps.now() + 30_000,
      simulation: {slot: SIMULATED_SLOT, elapsedMs: 0, programs: ['compute-budget', 'presale'], instructionCount: 3},
    });
    // The simulation's accounts: payer, allocation, destination, and the user account (absent in the snapshot).
    expect(w.asked).toEqual([[ACCOUNT, PDAS.userAllocation.toBase58(), TREASURY_ADDRESS, PDAS.userAccount.toBase58()]]);
    const [entry] = await stored(w);
    expect(entry).toMatchObject({id: view.id, account: ACCOUNT, kind: 'presale-buy', intent: intent('SOL', SOL_2), challengeId: view.reauth?.challengeId, shown: {fees: {networkLamports: NETWORK.toString(), markupLamports: '0'}}});
    expect(entry?.shown.basis).toEqual({allocationExists: false, purchaseCount: 0, referrer: null, userAccountExists: false});
    expect(await preparedFor(w.ext, w.deps, ACCOUNT)).toBeNull();
    expect(w.deps.broadcasts).toEqual([]);
    // #10's description, bound to the same values.
    expect(await challengeInfo(w.ext, w.deps.now(), view.reauth?.challengeId ?? '')).toEqual({
      kind: 'presale-buy',
      account: ACCOUNT,
      currency: 'SOL',
      amount: SOL_2,
      stage: 0,
      priceTicks: '1501',
      nocBase: nocBase.toString(),
      spentCents: SOL_CENTS.toString(),
      destination: TREASURY_ADDRESS,
      networkLamports: NETWORK.toString(),
      priorityLamports: priorityFeeLamports(PRICE, 120_000).toString(),
      rentLamports: (ALLOCATION_RENT + USER_RENT).toString(),
      reasons: ['first-purchase', 'over-5-percent', 'over-usd-threshold'],
      thresholdCents: 10_000,
    });
  });

  it('the payer’s outflow read with the network fee in it is the other accepted reading', async () => {
    const w = await world({edits: [lamportsMinus(ACCOUNT, NETWORK)]});
    expect((await prepare(w, intent('SOL', SOL_2))).fees.rentLamports).toBe((ALLOCATION_RENT + USER_RENT).toString());
  });

  it('an existing allocation and user account: no rent, no user account asked, the on-chain referrer’s allocation passed and shown', async () => {
    const w = await world({chain: {user: program(userData()), allocation: program(allocationData({referrer: REFERRER}))}});
    const view = await prepare(w, intent('SOL', SOL_2));
    expect(view.fees.rentLamports).toBe('0');
    expect(view.referrer).toEqual({address: REFERRER, registers: false});
    expect(w.asked).toEqual([[ACCOUNT, PDAS.userAllocation.toBase58(), TREASURY_ADDRESS]]);
    const message = VersionedTransaction.deserialize(base64.decode(w.wires[0] as string)).message;
    const purchase = message.compiledInstructions.at(-1);
    expect(message.staticAccountKeys[purchase?.accountKeyIndexes[3] ?? -1]?.toBase58()).toBe(derivePresalePdas(new PublicKey(REFERRER)).userAllocation.toBase58());
  });

  it('a simulated rent exactly at each bound is accepted', async () => {
    const atBound: Edit = (o, at) =>
      withAccount(PDAS.userAccount.toBase58(), a => (a === null ? null : {...a, lamports: PRESALE_USER_ACCOUNT_RENT_LAMPORTS}))(
        withAccount(PDAS.userAllocation.toBase58(), a => (a === null ? null : {...a, lamports: PRESALE_ALLOCATION_RENT_LAMPORTS}))(
          lamportsMinus(ACCOUNT, PRESALE_USER_ACCOUNT_RENT_LAMPORTS + PRESALE_ALLOCATION_RENT_LAMPORTS - USER_RENT - ALLOCATION_RENT)(o, at),
          at,
        ),
        at,
      );
    expect((await prepare(await world({edits: [atBound]}), intent('SOL', SOL_2))).fees.rentLamports).toBe((PRESALE_USER_ACCOUNT_RENT_LAMPORTS + PRESALE_ALLOCATION_RENT_LAMPORTS).toString());
  });
});

describe('prepare: the build (§3.3 step 4, C2, C5)', () => {
  const named = (wire: string): string[] => {
    const message = VersionedTransaction.deserialize(base64.decode(wire)).message;
    const ix = message.compiledInstructions.at(-1);
    return (ix?.accountKeyIndexes ?? []).map(i => message.staticAccountKeys[i]?.toBase58() ?? '');
  };
  const byName = (row: string, table: Record<string, string>) => (PRESALE_INSTRUCTIONS.find(i => i.name === row)?.accounts ?? []).map(n => table[n]);

  it('SOL: the IDL’s accounts in its order; only Compute Budget and the presale; no register_referrer', async () => {
    const w = await world();
    await prepare(w, intent('SOL', SOL_2));
    const table: Record<string, string> = {
      config: CONFIG_PDA,
      user_account: PDAS.userAccount.toBase58(),
      user_allocation: PDAS.userAllocation.toBase58(),
      referrer_allocation: DEFAULT_REFERRER_ALLOCATION,
      pyth_sol_usd_price: PYTH_SOL_USD_ACCOUNT,
      user: ACCOUNT,
      sol_treasury: TREASURY_ADDRESS,
      system_program: SYSTEM_PROGRAM_ID,
    };
    expect(named(w.wires[0] as string)).toEqual(byName('presale_purchase_with_sol', table));
    const message = VersionedTransaction.deserialize(base64.decode(w.wires[0] as string)).message;
    const programs = message.compiledInstructions.map(ix => message.staticAccountKeys[ix.programIdIndex]?.toBase58());
    expect(programs).toEqual(['ComputeBudget111111111111111111111111111111', 'ComputeBudget111111111111111111111111111111', MAINNET_PROGRAM_ID]);
  });

  it('a stablecoin pays from the largest holding account — neither of the two is the derived ATA — and lands on the pinned vault ATA', async () => {
    const w = await world();
    await prepare(w, intent('USDC', '20000000'));
    const table: Record<string, string> = {
      config: CONFIG_PDA,
      user_account: PDAS.userAccount.toBase58(),
      user_allocation: PDAS.userAllocation.toBase58(),
      referrer_allocation: DEFAULT_REFERRER_ALLOCATION,
      stablecoin_ata_for_user: HOLDING_LARGE,
      stablecoin_ata_for_admin: USDC_VAULT,
      stablecoin_mint: MAINNET_USDC_MINT,
      user: ACCOUNT,
      token_program: SPL_TOKEN_PROGRAM,
      system_program: SYSTEM_PROGRAM_ID,
    };
    expect(named(w.wires[0] as string)).toEqual(byName('presale_purchase_with_usdc', table));
    expect(w.asked).toEqual([[ACCOUNT, PDAS.userAllocation.toBase58(), USDC_VAULT, HOLDING_LARGE, PDAS.userAccount.toBase58()]]);
  });

  it('USDT: the IDL’s row, the USDT vault', async () => {
    const w = await world();
    const view = await prepare(w, intent('USDT', '10000000'));
    expect(view.destination).toBe(USDT_VAULT);
    expect(named(w.wires[0] as string)[5]).toBe(USDT_VAULT);
    expect(named(w.wires[0] as string)[6]).toBe(MAINNET_USDT_MINT);
  });

  it('a balance split across accounts is refused before anything is built; one too small in total too', async () => {
    const w = await world();
    expect(await refusal(prepare(w, intent('USDC', '510000000')))).toBe('split-balance');
    expect(await refusal(prepare(w, intent('USDC', '540000000')))).toBe('insufficient-token');
    expect(w.wires).toEqual([]);
  });

  it('assertPurchaseMessage: the pinned destinations pass; a look-alike treasury or vault built in is an engine bug, thrown', () => {
    const user = new PublicKey(ACCOUNT);
    const resolved = {referrerAllocation: new PublicKey(DEFAULT_REFERRER_ALLOCATION), registerReferrer: null};
    const compile = (ixs: TransactionInstruction[]) => new TransactionMessage({payerKey: user, recentBlockhash: BLOCKHASH, instructions: ixs}).compileToV0Message();
    const sol = {account: ACCOUNT, currency: 'SOL' as const, referrerAllocation: DEFAULT_REFERRER_ALLOCATION, destination: TREASURY_ADDRESS, source: null, amount: 7n};
    expect(assertPurchaseMessage(compile(buildBuyInstructions(user, 7n, 0, resolved, new PublicKey(TREASURY_ADDRESS))), sol)).toBe(2);
    expect(() => assertPurchaseMessage(compile(buildBuyInstructions(user, 7n, 0, resolved, new PublicKey(LOOKALIKE_TREASURY))), sol)).toThrow('expected');
    expect(() => assertPurchaseMessage(compile(buildBuyInstructions(user, 8n, 0, resolved, new PublicKey(TREASURY_ADDRESS))), sol)).toThrow('data');
    const usdc = {account: ACCOUNT, currency: 'USDC' as const, referrerAllocation: DEFAULT_REFERRER_ALLOCATION, destination: USDC_VAULT, source: HOLDING_LARGE, amount: 7n};
    const source = new PublicKey(HOLDING_LARGE);
    expect(assertPurchaseMessage(compile(buildStablecoinBuyInstructions(user, 'USDC', 7n, 0, resolved, new PublicKey(TREASURY_ADDRESS), source)), usdc)).toBe(2);
    expect(() => assertPurchaseMessage(compile(buildStablecoinBuyInstructions(user, 'USDC', 7n, 0, resolved, new PublicKey(LOOKALIKE_TREASURY), source)), usdc)).toThrow('expected');
    expect(() => assertPurchaseMessage(compile(buildStablecoinBuyInstructions(user, 'USDC', 7n, 0, resolved, new PublicKey(TREASURY_ADDRESS), new PublicKey(HOLDING_SMALL))), usdc)).toThrow('expected');
    expect(expectedPurchaseAccounts(usdc)[5]).toBe(USDC_VAULT);
  });
});

describe('prepare: the simulation is checked exactly (§3.3 step 5, C11, C23, C28)', () => {
  const sol = intent('SOL', SOL_2);
  const usdc = intent('USDC', '20000000');
  const code = async (i: PurchaseIntent, edits: (Edit | null)[], chain: Partial<Chain> = {}) => refusal(prepare(await world({edits, chain}), i));

  it('the payer loses one lamport more than the purchase costs → mismatch; one less → mismatch', async () => {
    expect(await code(sol, [lamportsMinus(ACCOUNT, 1n)])).toBe('simulation-mismatch');
    expect(await code(sol, [lamportsMinus(ACCOUNT, -1n)])).toBe('simulation-mismatch');
    expect(await code(usdc, [lamportsMinus(ACCOUNT, 1n)])).toBe('simulation-mismatch');
  });

  it('the paying token account loses more than the amount, or comes back owned by another → mismatch', async () => {
    expect(await code(usdc, [withAccount(HOLDING_LARGE, a => (a === null ? null : {...a, data: tokenAccountData({mint: MAINNET_USDC_MINT, owner: ACCOUNT, amount: 479_999_999n})}))])).toBe('simulation-mismatch');
    expect(await code(usdc, [withAccount(HOLDING_LARGE, a => (a === null ? null : {...a, data: tokenAccountData({mint: MAINNET_USDC_MINT, owner: REFERRER, amount: 480_000_000n})}))])).toBe('simulation-mismatch');
  });

  it('the allocation does not grow, grows by two purchases, by one NOC base unit too few, or a stablecoin’s cents off by one → mismatch', async () => {
    const unchanged: Edit = withAccount(PDAS.userAllocation.toBase58(), a => (a === null ? null : {...a, data: allocationData()}));
    expect(await code(sol, [unchanged], EXISTING)).toBe('simulation-mismatch');
    expect(await code(sol, [allocationEdit(d => (d[A.purchase_count.offset] = 2))])).toBe('simulation-mismatch');
    expect(await code(sol, [allocationEdit(d => putU64At(d, A.total_tokens.offset, tokensFor(SOL_CENTS, 0) - 1n))])).toBe('simulation-mismatch');
    // The cents one off each way, with the NOC the program would give for them: only the stablecoin's exact-cents rule refuses.
    expect(await code(usdc, [credited(2001n)])).toBe('simulation-mismatch');
    expect(await code(usdc, [credited(1999n)])).toBe('simulation-mismatch');
    expect(await code(usdc, [credited(0n)])).toBe('simulation-mismatch');
  });

  it('the allocation after is another account’s, or not a PresaleAllocation → mismatch', async () => {
    expect(await code(sol, [allocationEdit(d => d.set(new PublicKey(REFERRER).toBytes(), A.user.offset))])).toBe('simulation-mismatch');
    expect(await code(sol, [allocationEdit(d => (d[0] = 0))])).toBe('simulation-mismatch');
    expect(await code(sol, [allocationEdit(d => (d[A.claimed.offset] = 2))])).toBe('simulation-mismatch');
  });

  it('a SOL purchase the simulation values outside the limits (the program would refuse it), or at 0 cents → mismatch; at each limit it passes', async () => {
    // SOL's cents are the program's (Pyth): nothing else ties them down, so only the limits on the simulated cents refuse.
    expect(await code(sol, [credited(999n)])).toBe('simulation-mismatch');
    expect(await code(sol, [credited(0n)])).toBe('simulation-mismatch');
    expect(await code(sol, [credited(5_000_001n)])).toBe('simulation-mismatch');
    expect((await prepare(await world({edits: [credited(1_000n)]}), sol)).spentCents).toBe('1000');
    expect((await prepare(await world({edits: [credited(5_000_000n)]}), sol)).spentCents).toBe('5000000');
  });

  it('a new PDA’s rent above its bound, 0, or the PDA not the program’s layout → mismatch (rent from the simulation, §2.1)', async () => {
    const rent = (address: string, lamports: bigint, extra: bigint): Edit => (o, at) =>
      lamportsMinus(ACCOUNT, extra)(withAccount(address, a => (a === null ? null : {...a, lamports}))(o, at), at);
    expect(await code(sol, [rent(PDAS.userAllocation.toBase58(), PRESALE_ALLOCATION_RENT_LAMPORTS + 1n, PRESALE_ALLOCATION_RENT_LAMPORTS + 1n - ALLOCATION_RENT)])).toBe('simulation-mismatch');
    expect(await code(sol, [rent(PDAS.userAccount.toBase58(), PRESALE_USER_ACCOUNT_RENT_LAMPORTS + 1n, PRESALE_USER_ACCOUNT_RENT_LAMPORTS + 1n - USER_RENT)])).toBe('simulation-mismatch');
    expect(await code(sol, [rent(PDAS.userAllocation.toBase58(), 0n, -ALLOCATION_RENT)])).toBe('simulation-mismatch');
    expect(await code(sol, [rent(PDAS.userAccount.toBase58(), 0n, -USER_RENT)])).toBe('simulation-mismatch');
    expect(await code(sol, [withAccount(PDAS.userAccount.toBase58(), a => (a === null ? null : {...a, owner: SYSTEM_PROGRAM_ID}))])).toBe('simulation-mismatch');
    expect(await code(sol, [withAccount(PDAS.userAccount.toBase58(), () => null)])).toBe('simulation-mismatch');
  });

  it('the simulation leaves out an account, or answers none → mismatch', async () => {
    expect(await code(sol, [o => ({...o, accounts: (o.accounts ?? []).slice(0, 3)})])).toBe('simulation-mismatch');
    expect(await code(sol, [o => ({...o, accounts: null})])).toBe('simulation-mismatch');
  });

  it('a vault after owned by a look-alike of the treasury, or of another mint → mismatch at once (a shape, not a race)', async () => {
    const w = await world({edits: [withAccount(USDC_VAULT, a => (a === null ? null : {...a, data: tokenAccountData({mint: MAINNET_USDC_MINT, owner: LOOKALIKE_TREASURY, amount: 192_099_207n})}))]});
    expect(await refusal(prepare(w, usdc))).toBe('simulation-mismatch');
    expect([w.reads, w.wires.length]).toEqual([1, 1]);
    expect(await code(usdc, [withAccount(USDC_VAULT, a => (a === null ? null : {...a, data: tokenAccountData({mint: MAINNET_USDT_MINT, amount: 192_099_207n})}))])).toBe('simulation-mismatch');
    expect(await code(sol, [withAccount(TREASURY_ADDRESS, a => (a === null ? null : {...a, owner: MAINNET_PROGRAM_ID}))])).toBe('simulation-mismatch');
  });

  it('each program error on the purchase → its code; on another instruction, or any other error → simulation-failed; the payer’s rent → sender-below-rent', async () => {
    const failing = (err: unknown): Edit => o => ({...o, err, accounts: null});
    for (const [n, expected] of [
      [6022, 'below-min'],
      [6023, 'above-limit'],
      [6002, 'blocked'],
      [6020, 'presale-closed'],
      [6021, 'presale-closed'],
      [6024, 'presale-closed'],
      [6006, 'simulation-failed'],
    ] as const) {
      expect([n, await code(sol, [failing({InstructionError: [2, {Custom: n}]})])]).toEqual([n, expected]);
    }
    expect(await code(sol, [failing({InstructionError: [1, {Custom: 6022}]})])).toBe('simulation-failed');
    expect(await code(sol, [failing('AccountNotFound')])).toBe('simulation-failed');
    expect(await code(sol, [failing({InsufficientFundsForRent: {account_index: 0}})])).toBe('sender-below-rent');
  });

  it('NOC at another stage’s price → price-changed (review L3); a stage that moved before the read → price-changed (C27), nothing simulated', async () => {
    expect(await code(sol, [allocationEdit(d => putU64At(d, A.total_tokens.offset, tokensFor(SOL_CENTS, 1)))])).toBe('price-changed');
    const w = await world({chain: {config: program(configData({stage: 1}))}});
    expect(await refusal(prepare(w, sol))).toBe('price-changed');
    expect(w.wires).toEqual([]);
  });
});

describe('the destination (C28) and the one retry (C39)', () => {
  const sol = intent('SOL', SOL_2);
  const usdc = intent('USDC', '20000000');
  const short = (address: string, n: bigint): Edit =>
    withAccount(address, a => {
      if (a === null) return null;
      if (address === TREASURY_ADDRESS) return {...a, lamports: a.lamports - n};
      return {...a, data: tokenAccountData({mint: MAINNET_USDC_MINT, amount: readU64LE(a.data, 64) - n})};
    });

  it('the treasury gains nothing (the amount went elsewhere) twice → presale-busy, after one fresh read and the same bytes again', async () => {
    const w = await world({edits: [short(TREASURY_ADDRESS, 2_000_000_000n), short(TREASURY_ADDRESS, 2_000_000_000n)]});
    expect(await refusal(prepare(w, sol))).toBe('presale-busy');
    expect([w.reads, w.wires.length, w.wires[0] === w.wires[1]]).toEqual([2, 2, true]);
    expect(await stored(w)).toEqual([]);
  });

  it('the vault gains amount − 1, twice → presale-busy; once, then exactly → prepared', async () => {
    expect(await refusal(prepare(await world({edits: [short(USDC_VAULT, 1n), short(USDC_VAULT, 1n)]}), usdc))).toBe('presale-busy');
    const w = await world({edits: [short(USDC_VAULT, 1n), null]});
    expect((await prepare(w, usdc)).destination).toBe(USDC_VAULT);
    expect([w.reads, w.wires.length, w.wires[0] === w.wires[1]]).toEqual([2, 2, true]);
  });

  it('another buyer landed between the snapshot and the simulation: the fresh snapshot’s treasury is the “before” of the second check', async () => {
    // The first simulation sees a treasury 3 SOL fuller than the first read; the fresh read sees it too.
    const later = {treasury: {...(chainMap().get(TREASURY_ADDRESS) as AccountData), lamports: 48_288_800_000n + 3_000_000_000n}};
    const w = await world({chains: [{}, later], simChains: [later]});
    const view = await prepare(w, sol);
    expect([w.reads, w.wires.length]).toEqual([2, 2]);
    expect(view.simulation.slot).toBe(SIMULATED_SLOT);
  });

  it('the fresh snapshot moved the stage → price-changed, no second simulation', async () => {
    const moved = await world({chains: [{}, {config: program(configData({stage: 1}))}], edits: [short(TREASURY_ADDRESS, 1n)]});
    expect(await refusal(prepare(moved, sol))).toBe('price-changed');
    expect([moved.reads, moved.wires.length]).toEqual([2, 1]);
  });

  it('the fresh snapshot moved a limit past the amount — the minimum raised above it, the per-user remainder shrunk below it → that limit’s line, no second simulation (review 1 M3)', async () => {
    for (const [before, after, expected] of [
      [{}, {config: program(configData({minPurchase: SOL_CENTS + 100n}))}, 'below-min'],
      [EXISTING, {...EXISTING, allocation: program(allocationData({spent: 20_000_000n - SOL_CENTS + 100n}))}, 'above-user-limit'],
    ] as const) {
      const w = await world({chains: [before, after], edits: [short(TREASURY_ADDRESS, 1n)]});
      expect([expected, await refusal(prepare(w, sol)), w.reads, w.wires.length]).toEqual([expected, expected, 2, 1]);
    }
  });

  it('the fresh snapshot finds the allocation or the user account created, or a referrer registered, meanwhile (what the bytes were built from) → state-changed, no second simulation', async () => {
    for (const [before, after] of [
      [{}, EXISTING],
      [{user: program(userData())}, EXISTING],
      [{}, {user: program(userData())}],
      // A referrer registered from elsewhere meanwhile: the purchase was built with the default referrer allocation.
      [EXISTING, {user: program(userData()), allocation: program(allocationData({referrer: REFERRER}))}],
    ] as const) {
      const w = await world({chains: [before, after], edits: [short(TREASURY_ADDRESS, 1n)]});
      expect([before, after, await refusal(prepare(w, sol)), w.reads, w.wires.length]).toEqual([before, after, 'state-changed', 2, 1]);
    }
  });

  it('the fresh snapshot closed the sale, blocked the account or failed → its code, no second simulation', async () => {
    for (const [chain, expected] of [
      [{config: program(configData({active: 0}))}, 'presale-closed'],
      [{user: program(userData({blocked: 1}))}, 'blocked'],
      [{config: null}, 'presale-unavailable'],
    ] as const) {
      const w = await world({chains: [{}, chain], edits: [short(TREASURY_ADDRESS, 1n)]});
      expect([expected, await refusal(prepare(w, sol)), w.wires.length]).toEqual([expected, expected, 1]);
    }
  });

  it('a simulation answered at a slot below the snapshot’s is stale: simulation-mismatch at once, no retry (review 2 L1)', async () => {
    const w = await world({snapshotSlots: [SIMULATED_SLOT + 1], edits: [short(TREASURY_ADDRESS, 1n)]});
    expect(await refusal(prepare(w, sol))).toBe('simulation-mismatch');
    expect([w.reads, w.wires.length]).toEqual([1, 1]);
    // The same slot is not below it: retried (positive control).
    const same = await world({snapshotSlots: [SIMULATED_SLOT], edits: [short(TREASURY_ADDRESS, 1n), null]});
    expect((await prepare(same, sol)).destination).toBe(TREASURY_ADDRESS);
  });

  it('only a destination-only mismatch is retried: a wrong outflow with a wrong destination is refused at once', async () => {
    const both: Edit = (o, at) => short(TREASURY_ADDRESS, 1n)(lamportsMinus(ACCOUNT, 1n)(o, at), at);
    const w = await world({edits: [both, null]});
    expect(await refusal(prepare(w, sol))).toBe('simulation-mismatch');
    expect([w.reads, w.wires.length]).toEqual([1, 1]);
  });

  it('the second simulation is checked in full: a destination right but the payer drained more → mismatch', async () => {
    const w = await world({edits: [short(TREASURY_ADDRESS, 1n), lamportsMinus(ACCOUNT, 1n)]});
    expect(await refusal(prepare(w, sol))).toBe('simulation-mismatch');
  });
});

describe('prepare: what closes it before anything is built (§3.3 steps 1–3, §5)', () => {
  const sol = intent('SOL', SOL_2);

  it('locked; an account outside the session; an open purchase or send of the account (C10)', async () => {
    const w = await world();
    expect(await refusal(preparePurchase(w.ext, w.deps, REFERRER, sol))).toBe('unknown-account');
    await w.ext.local.set(PENDING_KEY, [pendingRecord({account: ACCOUNT, state: 'pending'})]);
    expect(await refusal(prepare(w, sol))).toBe('in-flight');
    const locked = await world();
    await locked.ext.session.clear();
    expect(await refusal(prepare(locked, sol))).toBe('locked');
    expect([w.reads, locked.reads]).toEqual([0, 0]);
  });

  it('the gate closed decides first — even over an unreadable state — and no balance is read', async () => {
    let balance = 0;
    const w = await world({geo: async () => ({open: false, reason: 'stale_list', countryCode: 'SI'}), chain: {config: null}});
    w.deps.reader = {...w.deps.reader, getBalance: async () => ((balance += 1), 0n)};
    expect(await refusal(prepare(w, sol))).toBe('geo-closed');
    expect(balance).toBe(0);
    const throwing = await world({geo: async () => Promise.reject(new Error('x'))});
    expect(await refusal(prepare(throwing, sol))).toBe('geo-closed');
  });

  it('the state: unavailable, refused (403), inactive, blocked', async () => {
    expect(await refusal(prepare(await world({chain: {config: null}}), sol))).toBe('presale-unavailable');
    expect(await refusal(prepare(await world({read: async () => Promise.reject(new RpcForbidden('/rpc'))}), sol))).toBe('coordinator-refused');
    expect(await refusal(prepare(await world({read: async () => Promise.reject(new RequestUnreachable('/rpc', 'down'))}), sol))).toBe('presale-unavailable');
    expect(await refusal(prepare(await world({chain: {config: program(configData({active: 0}))}}), sol))).toBe('presale-closed');
    expect(await refusal(prepare(await world({chain: {user: program(userData({blocked: 1}))}}), sol))).toBe('blocked');
  });

  it('the quote’s lines: the configured minimum for SOL and a stablecoin alike, no SOL without a price, a stablecoin without one', async () => {
    // $10 at $198.42: 50 397 137 lamports are 999 cents.
    expect(await refusal(prepare(await world(), intent('SOL', '50397137')))).toBe('below-min');
    expect(await refusal(prepare(await world(), intent('USDC', '9999999')))).toBe('below-min');
    const noPrice = async () => ({usdc: 1, usdt: 1});
    expect(await refusal(prepare(await world({prices: noPrice}), sol))).toBe('no-sol-price');
    expect((await prepare(await world({prices: noPrice}), intent('USDC', '10000000'))).currency).toBe('USDC');
    expect(await refusal(prepare(await world({sol: 2_000_000_000n}), sol))).toBe('insufficient-sol');
  });

  it('a 403 on the prices is the coordinator refusing; on the balance too', async () => {
    expect(await refusal(prepare(await world({prices: async () => Promise.reject(new RpcForbidden('/wallet/prices'))}), sol))).toBe('coordinator-refused');
    const w = await world();
    w.deps.reader = {...w.deps.reader, getBalance: async () => Promise.reject(new RpcForbidden('/rpc'))};
    expect(await refusal(prepare(w, sol))).toBe('coordinator-refused');
  });
});

describe('the purchase challenge (§1.3 describe, §3.3 step 6)', () => {
  it('a carried live challenge of the same intent is renewed — the same id, still proven — not issued again', async () => {
    const w = await world();
    const first = await prepare(w, intent('SOL', SOL_2));
    const id = first.reauth?.challengeId ?? '';
    expect(await satisfyChallenge(w.ext, w.deps.now(), id)).toBe(true);
    w.deps.clock.t += 31_000;
    const again = await prepare(w, intent('SOL', SOL_2), {challengeId: id});
    expect(again.reauth).toEqual({challengeId: id, reasons: first.reauth?.reasons, proven: true});
    expect(Object.keys((await w.ext.session.get(REAUTH_KEY)) as object)).toEqual([id]);
  });

  it('a carried challenge of another intent is not renewed: a new one is issued', async () => {
    const w = await world();
    const first = await prepare(w, intent('SOL', SOL_2));
    const again = await prepare(w, intent('SOL', '2000000001'), {challengeId: first.reauth?.challengeId ?? ''});
    expect(again.reauth?.challengeId).not.toBe(first.reauth?.challengeId);
    expect(again.reauth?.proven).toBe(false);
  });

  it('rebaseChallenge stays send-only: it never renews a purchase challenge; rebaseKindChallenge refuses another digest or another identity', async () => {
    const w = await world();
    const view = await prepare(w, intent('SOL', SOL_2));
    const id = view.reauth?.challengeId ?? '';
    const digest = intentDigest(PRESALE_BUY_INTENT, ACCOUNT, intent('SOL', SOL_2));
    const refresh = {networkLamports: '1', priorityLamports: '0', markupLamports: '0', markupReason: 'pre-tge' as const, rentLamports: '0', reasons: [], thresholdCents: 1};
    expect(await rebaseChallenge(w.ext, w.deps.now(), id, digest, refresh)).toBe(false);
    const about = (await challengeInfo(w.ext, w.deps.now(), id)) as KindAbout;
    expect(await rebaseKindChallenge(w.ext, w.deps.now(), id, 'another digest', about)).toBe(false);
    expect(await rebaseKindChallenge(w.ext, w.deps.now(), id, digest, {...about, account: REFERRER})).toBe(false);
    expect(await rebaseKindChallenge(w.ext, w.deps.now(), id, digest, {...about, nocBase: '1'})).toBe(true);
    expect(await challengeInfo(w.ext, w.deps.now(), id)).toEqual({...about, nocBase: '1'});
  });

  it('the store keeps exactly the shape the kind issues: an extra key, an unknown reason, a priority above the network fee, no reasons — refused', async () => {
    const w = await world();
    const view = await prepare(w, intent('SOL', SOL_2));
    const about = (await challengeInfo(w.ext, w.deps.now(), view.reauth?.challengeId ?? '')) as KindAbout;
    for (const bad of [{...about, extra: 1}, {...about, reasons: ['first-send']}, {...about, reasons: []}, {...about, priorityLamports: '9999999999'}, {...about, stage: 10}, {...about, currency: 'NOC'}]) {
      await expect(issueChallenge(w.ext, w.deps, 'd', bad)).rejects.toThrow('malformed about');
    }
    expect(await issueChallenge(w.ext, w.deps, 'd', about)).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('nothing signs a purchase in this task (D17; sign-time checks are Task 3’s)', () => {
  it('wallet.send’s kind refuses the purchase entry as unknown; the purchase kind’s beforeSign refuses it — the entry and the proof stay', async () => {
    const w = await world();
    const view = await prepare(w, intent('SOL', SOL_2));
    await satisfyChallenge(w.ext, w.deps.now(), view.reauth?.challengeId ?? '');
    await expect(sendPrepared(w.ext, w.deps, view.id)).rejects.toMatchObject({code: 'unknown-prepared'});
    await expect(sendPrepared(w.ext, w.deps, view.id, PRESALE_BUY_KIND)).rejects.toBeInstanceOf(SendRefused);
    await expect(sendPrepared(w.ext, w.deps, view.id, PRESALE_BUY_KIND)).rejects.toMatchObject({code: 'prepared-invalid'});
    expect((await stored(w)).map(e => e.id)).toEqual([view.id]);
    expect(w.deps.broadcasts).toEqual([]);
  });

  it('a send prepared afterwards replaces the purchase entry (one entry per account, §1.3) — the kinds share one store', async () => {
    const w = await world();
    await prepare(w, intent('SOL', SOL_2));
    const again = await prepare(w, intent('USDC', '20000000'));
    expect((await stored(w)).map(e => [e.id, e.kind])).toEqual([[again.id, 'presale-buy']]);
  });
});

describe('the fee stays within the quote’s bound (Task 1)', () => {
  it('a busy network still prices at the normal tier: the fee is the ceiling’s, never above PRESALE_FEE_BOUND_LAMPORTS', async () => {
    const w = await world();
    w.deps.reader = {...w.deps.reader, getRecentPrioritizationFees: async () => [{prioritizationFee: 9_000_000_000}]};
    const view = await prepare(w, intent('USDC', '20000000'));
    const ceiling = await estimatePriorityFee(fakeReader({getRecentPrioritizationFees: async () => [{prioritizationFee: 9_000_000_000}]}), 'normal');
    expect(view.fees.networkLamports).toBe(networkFeeLamports(1, ceiling, 120_000).toString());
    expect(BigInt(view.fees.networkLamports)).toBe(2_405_000n);
  });
});

describe('presale.prepareBuy through the real message handler (§1.4)', () => {
  const POPUP = (ext: ReturnType<typeof fakeExt>) => ({id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/popup.html`});
  const msg = (o: Record<string, unknown> = {}) => ({type: 'presale.prepareBuy', account: ACCOUNT, intent: intent('SOL', SOL_2), ...o});

  it('a PurchaseView from the popup; the same request from the approval window or the vault page is forbidden, nothing read', async () => {
    const w = await world();
    const r = await handleMessage(w.ext, msg(), POPUP(w.ext), w.deps);
    expect(r).toMatchObject({ok: true, data: {currency: 'SOL', amount: SOL_2, destination: TREASURY_ADDRESS}});
    const other = await world();
    for (const page of ['approve.html', 'unlock.html']) {
      expect(await handleMessage(other.ext, msg(), {...POPUP(other.ext), url: `${other.ext.extensionOrigin}/${page}`, tab: {}, frameId: 0}, other.deps)).toEqual({ok: false, error: 'forbidden'});
    }
    expect([other.reads, other.wires.length]).toEqual([0, 0]);
  });

  it.each([
    ['an extra key', msg({extra: 1})],
    ['no intent', {type: 'presale.prepareBuy', account: ACCOUNT}],
    ['an intent with an extra key', msg({intent: {...intent('SOL', SOL_2), referrer: null}})],
    ['a stage of 10', msg({intent: intent('SOL', SOL_2, 10)})],
    ['an amount of 0', msg({intent: intent('SOL', '0')})],
    ['NOC', msg({intent: {currency: 'NOC', amount: '1', stage: 0}})],
    ['a non-address account', msg({account: 'not-an-address'})],
    ['a challenge id of another shape', msg({challengeId: 'abc'})],
    ['a challenge id that is not a string', msg({challengeId: 7})],
  ])('%s → malformed, nothing read', async (_, m) => {
    const w = await world();
    expect(await handleMessage(w.ext, m, POPUP(w.ext), w.deps)).toEqual({ok: false, error: 'malformed'});
    expect([w.reads, w.wires.length]).toEqual([0, 0]);
  });

  it('locked, or an account outside the session — nothing read', async () => {
    const w = await world();
    expect(await handleMessage(w.ext, msg({account: REFERRER}), POPUP(w.ext), w.deps)).toEqual({ok: false, error: 'unknown-account'});
    await w.ext.session.clear();
    expect(await handleMessage(w.ext, msg(), POPUP(w.ext), w.deps)).toEqual({ok: false, error: 'locked'});
    expect(w.reads).toBe(0);
  });

  it('a refusal is its code with its detail; a carried challenge id reaches the prepare', async () => {
    const closed = await world({geo: async () => ({open: false, reason: 'stale_list', countryCode: 'SI'})});
    expect(await handleMessage(closed.ext, msg(), POPUP(closed.ext), closed.deps)).toEqual({ok: false, error: 'geo-closed', data: {detail: 'stale_list'}});
    const moved = await world({chain: {config: program(configData({stage: 1}))}});
    expect(await handleMessage(moved.ext, msg(), POPUP(moved.ext), moved.deps)).toEqual({ok: false, error: 'price-changed', data: {detail: "stage 1, the intent's 0"}});
    const w = await world();
    const first = (await handleMessage(w.ext, msg(), POPUP(w.ext), w.deps)) as {ok: true; data: {reauth: {challengeId: string}}};
    const again = await handleMessage(w.ext, msg({challengeId: first.data.reauth.challengeId}), POPUP(w.ext), w.deps);
    expect(again).toMatchObject({ok: true, data: {reauth: {challengeId: first.data.reauth.challengeId}}});
  });
});
