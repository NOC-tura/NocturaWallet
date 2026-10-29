import {MessageV0, PublicKey, TransactionMessage, VersionedMessage, VersionedTransaction, type TransactionInstruction} from '@solana/web3.js';
import {base58, base64} from '@scure/base';
import {ed25519} from '@noble/curves/ed25519.js';
import {PRESALE_BUY_INTENT, assertPurchaseMessage, parsePurchaseIntent, preparePurchase, type PreparedPurchase, type PurchaseIntent, type PurchaseView} from '../buy';
import {registerPresale} from '../api';
import {readPresaleRecords, runPresaleRecords} from '../record';
import {handleMessage, registerPresaleHandler} from '../../messages';
import {PRESALE_ALLOCATION_LAYOUT} from '../layouts';
import {intentDigest, type KindAbout} from '../../intents';
import {challengeInfo, challengeSatisfied, issueChallenge, satisfyChallenge} from '../../reauthChallenges';
import {PREPARED_KEY, REAUTH_KEY, clearSession, getSession, setSession} from '../../session';
import type {SessionAccount} from '../../../vault/accounts';
import {PENDING_KEY} from '../../pendingStore';
import {preparedIntegrity} from '../../prepare';
import {pollOnce} from '../../pending';
import {VAULT_KEY} from '../../accountsStore';
import type {PostAnswer} from '../../deps';
import {fakeDeps} from '../../__tests__/fakeDeps';
import {fakeExt} from '../../__tests__/fakeExt';
import {ACCOUNT as SESSION_ACCOUNT, BLOCKHASH, HOLDING_LARGE, HOLDING_SMALL, unlocked} from '../../__tests__/fixtures';
import type {GeoAnswer} from '../../geo/gate';
import {PRESALE_INSTRUCTIONS} from '../../dapp/decode/presaleIdl';
import {describePresale} from '../../../unlock/presale';
import {MAINNET_PROGRAM_ID, MAINNET_USDC_MINT, MAINNET_USDT_MINT} from '../../../../../core/presale/addresses';
import {derivePresalePdas} from '../../../../../core/presale/allocation';
import {buildBuyInstructions} from '../../../../../core/presale/buyInstructions';
import {PRESALE_ALLOCATION_RENT_LAMPORTS} from '../../../../../core/presale/limits';
import {firstSignature} from '../../../../../core/solana/broadcast';
import {RequestUnreachable, RpcForbidden, SYSTEM_PROGRAM_ID, type AccountData, type SimulatedAccount, type SimulationOutcome, type TokenAccountEntry} from '../../../../../core/solana/rpc';
import {ACCOUNT, NOW_MS, OTHER, REFERRER, SNAPSHOT_SLOT, TREASURY_ADDRESS, allocationData, chainMap, chainReader, program, userData, type Chain} from './chain';
import {ALLOCATION_RENT, USER_RENT, honestSimulation} from './simulation';

registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});

// B1d-2 Task 2 (§3.3, §3.4, §3.5, C7, C22, C32, D8): the referral address — presale.checkReferrer, the prepare that
// checks it again and registers it in the purchase's own transaction (register_referrer, account 3), the simulation's
// referrer@84, the sign-time re-check from the bytes the integrity binds, the forced re-authentication, #10's rows and
// the record's referrerAddress. A purchase without one is B1d-1b's byte for byte (captured.test.ts).

const SOL_USD = 198.42;
const OPEN: GeoAnswer = {open: true, reason: null, countryCode: 'SI'};
const PDAS = derivePresalePdas(new PublicKey(ACCOUNT));
const SOL_2 = '2000000000';
/** The referral address: a buyer with an allocation of their own. */
const R = REFERRER;
const allocationOf = (k: string): string => derivePresalePdas(new PublicKey(k)).userAllocation.toBase58();
const R_ALLOCATION = allocationOf(R);
const R_ALLOCATED: AccountData = program(allocationData({user: R, count: 1}));
/** A second account of this wallet (a real Ed25519 keypair, seed 32 × 0x02). */
const SEED2 = new Uint8Array(32).fill(2);
const PUB2 = ed25519.getPublicKey(SEED2);
const SECOND: SessionAccount = {index: 1, publicKey: base58.encode(PUB2), secretKey: base64.encode(new Uint8Array([...SEED2, ...PUB2]))};
const DEFAULT_KEY = '11111111111111111111111111111111';
const SHORT_KEY = base58.encode(new Uint8Array(31).fill(7));
const HOLDINGS: TokenAccountEntry[] = [
  {pubkey: HOLDING_LARGE, mint: MAINNET_USDC_MINT, owner: ACCOUNT, amount: 500_000_000n, decimals: 6},
  {pubkey: HOLDING_SMALL, mint: MAINNET_USDT_MINT, owner: ACCOUNT, amount: 70_000_000n, decimals: 6},
];
const EXISTING: Partial<Chain> = {user: program(userData()), allocation: program(allocationData())};
/** An allocation that exists but has never bought (purchase_count 0, no referrer): still a first purchase (C21). */
const NEVER_BOUGHT: Partial<Chain> = {user: program(userData()), allocation: program(allocationData({count: 0, spent: 0n, totalTokens: 0n, bonus: 0n}))};

type Edit = (o: SimulationOutcome, at: (address: string) => number) => SimulationOutcome;
const nth = <T>(xs: readonly T[], k: number): T => xs[Math.min(k, xs.length - 1)] as T;

interface World {
  deps: ReturnType<typeof fakeDeps>;
  ext: ReturnType<typeof fakeExt>;
  reads: number;
  /** Every getAccountsData call's addresses (the referral address's reads), in order. */
  accountReads: string[][];
  wires: string[];
  asked: (readonly string[])[];
  posts: {path: string; body: unknown}[];
}

/**
 * The world of buy.test.ts, with the referral address's reads: `chains` each successive snapshot, `referrers` each
 * successive getAccountsData (by address; the buyer's own allocation from the current chain), `refErrors` failing one.
 */
async function world(
  o: {chain?: Partial<Chain>; chains?: Partial<Chain>[]; simChains?: Partial<Chain>[]; referrers?: Map<string, AccountData | null>[]; refErrors?: (Error | null)[]; edits?: (Edit | null)[]; geo?: () => Promise<GeoAnswer>; session?: SessionAccount[]} = {},
): Promise<World> {
  const chains = (o.chains ?? [o.chain ?? {}]).map(c => chainMap(c));
  const simChains = o.simChains === undefined ? chains : o.simChains.map(c => chainMap(c));
  const referrers = o.referrers ?? [new Map([[R_ALLOCATION, R_ALLOCATED]])];
  const sol = 5_000_000_000n;
  const w: World = {deps: fakeDeps(), ext: fakeExt(), reads: 0, accountReads: [], wires: [], asked: [], posts: []};
  let sims = 0;
  const reader = chainReader(chains[0] as Map<string, AccountData | null>, [], {
    getAccountsDataAt: async addresses => {
      const chain = nth(chains, w.reads++);
      return {slot: SNAPSHOT_SLOT, accounts: addresses.map(a => chain.get(a) ?? null)};
    },
    getAccountsData: async addresses => {
      const k = w.accountReads.length;
      w.accountReads.push([...addresses]);
      const fails = o.refErrors?.[k];
      if (fails !== undefined && fails !== null) throw fails;
      const refs = nth(referrers, k);
      const chain = nth(chains, Math.max(0, w.reads - 1));
      return addresses.map(a => (refs.has(a) ? (refs.get(a) ?? null) : (chain.get(a) ?? null)));
    },
    getBalance: async () => sol,
    getTokenAccountsByOwner: async (_owner, filter) => HOLDINGS.filter(h => 'mint' in filter && h.mint === filter.mint),
    getRecentPrioritizationFees: async () => [],
    getLatestBlockhash: async () => ({blockhash: BLOCKHASH, lastValidBlockHeight: 1000}),
    simulateTransaction: async (wire, opts) => {
      const k = sims++;
      w.wires.push(wire);
      w.asked.push(opts?.accounts ?? []);
      const addresses = opts?.accounts ?? [];
      const honest = honestSimulation(wire, addresses, nth(simChains, k), sol, HOLDINGS, SOL_USD);
      const edit = (o.edits ?? [])[k] ?? null;
      return edit === null ? honest : edit(honest, a => addresses.indexOf(a));
    },
  });
  const broadcast = async (wire: Uint8Array) => {
    w.deps.broadcasts.push(wire);
    return firstSignature(wire);
  };
  const postJson = async (path: string, body: unknown): Promise<PostAnswer> => {
    w.posts.push({path, body});
    return {status: 200, body: {success: true, verified: true, duplicate: false, data: null}};
  };
  w.deps = fakeDeps({reader, broadcast, postJson, geo: o.geo ?? (async () => OPEN), prices: async () => ({solana: SOL_USD, usdc: 1, usdt: 1})});
  w.deps.clock.t = NOW_MS;
  if (o.session === undefined) await unlocked(w.ext);
  else await setSession(w.ext, o.session);
  // The stored wallet holds the buyer (a confirmed purchase is recorded only for an account of the wallet stored now).
  await w.ext.local.set(VAULT_KEY, {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Account 1', publicKey: ACCOUNT}]});
  return w;
}

const intent = (currency: PurchaseIntent['currency'], amount: string, referrer?: string): PurchaseIntent => ({currency, amount, stage: 0, ...(referrer === undefined ? {} : {referrer})});
const prepare = (w: World, i: PurchaseIntent) => preparePurchase(w.ext, w.deps, ACCOUNT, i);
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
const POPUP = (ext: ReturnType<typeof fakeExt>) => ({id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/popup.html`});
const ask = (w: World, m: Record<string, unknown>) => handleMessage(w.ext, m, POPUP(w.ext), w.deps);
const check = (w: World, referrer: unknown, extra: Record<string, unknown> = {}) => ask(w, {type: 'presale.checkReferrer', account: ACCOUNT, referrer, ...extra});
const buy = (w: World, id: string) => ask(w, {type: 'presale.buy', id});
const records = async (w: World): Promise<Record<string, unknown>[]> => ((await w.ext.local.get(PENDING_KEY)) as Record<string, unknown>[] | undefined) ?? [];
async function provenPurchase(w: World, i: PurchaseIntent): Promise<PurchaseView> {
  const view = await prepare(w, i);
  if (view.reauth !== null) expect(await satisfyChallenge(w.ext, w.deps.now(), view.reauth.challengeId)).toBe(true);
  return view;
}
const messageOf = (wire: string): MessageV0 => VersionedTransaction.deserialize(base64.decode(wire)).message as MessageV0;
const named = (m: MessageV0, ix: number): string[] => (m.compiledInstructions[ix]?.accountKeyIndexes ?? []).map(k => m.staticAccountKeys[k]?.toBase58() ?? '');
const programOf = (m: MessageV0, ix: number): string => m.staticAccountKeys[m.compiledInstructions[ix]?.programIdIndex ?? -1]?.toBase58() ?? '';
const REGISTER = PRESALE_INSTRUCTIONS.find(i => i.name === 'register_referrer');
/** One account of a simulation changed. */
const withAccount = (address: string, f: (a: SimulatedAccount | null) => SimulatedAccount | null): Edit => (o, at) => {
  const accounts = [...(o.accounts ?? [])];
  const i = at(address);
  if (i < 0) throw new Error(`the simulation was not asked for ${address}`);
  accounts[i] = f(accounts[i] ?? null);
  return {...o, accounts};
};
const A = PRESALE_ALLOCATION_LAYOUT.fields;
/** The allocation after with its referrer@84 replaced (null: 32 zero bytes). */
const referrerAfter = (referrer: string | null): Edit =>
  withAccount(PDAS.userAllocation.toBase58(), a => {
    if (a === null) return null;
    const data = Uint8Array.from(a.data);
    data.set(referrer === null ? new Uint8Array(32) : new PublicKey(referrer).toBytes(), A.referrer.offset);
    return {...a, data};
  });
/** A stored entry's message rebuilt from `ixs` (the same blockhash), its integrity recomputed — what a writer of session storage could do. */
async function forgeMessage(w: World, f: (m: MessageV0) => MessageV0): Promise<void> {
  const [entry] = await stored(w);
  if (entry === undefined) throw new Error('no entry');
  const message = base64.encode(f(VersionedMessage.deserialize(base64.decode(entry.message)) as MessageV0).serialize());
  await w.ext.session.set(PREPARED_KEY, [{...entry, message, integrity: preparedIntegrity({...entry, message})}]);
}
const compile = (m: MessageV0, instructions: TransactionInstruction[]): MessageV0 =>
  new TransactionMessage({payerKey: new PublicKey(ACCOUNT), recentBlockhash: m.recentBlockhash, instructions}).compileToV0Message();
/** The compute-budget price the stored message pays (its instruction 1), to rebuild it at the same fee. */
const priceOf = (m: MessageV0): number => Number(new DataView((m.compiledInstructions[1] as {data: Uint8Array}).data.buffer, (m.compiledInstructions[1] as {data: Uint8Array}).data.byteOffset).getBigUint64(1, true));

describe('the referral address in the intent (§1.4)', () => {
  it('absent or null is no referrer — the intent has no such key, as B1d-1b’s; a base58 string of 32–44 characters is kept; anything else is malformed', () => {
    expect(parsePurchaseIntent({currency: 'SOL', amount: '1', stage: 0})).toEqual({currency: 'SOL', amount: '1', stage: 0});
    const none = parsePurchaseIntent({currency: 'SOL', amount: '1', stage: 0, referrer: null});
    expect([none, none !== null && Object.hasOwn(none, 'referrer')]).toEqual([{currency: 'SOL', amount: '1', stage: 0}, false]);
    expect(parsePurchaseIntent({currency: 'SOL', amount: '1', stage: 0, referrer: R})).toEqual({currency: 'SOL', amount: '1', stage: 0, referrer: R});
    // The key's own validity is §3.5's (referrer-invalid), not the parser's: a 31-byte key and the default key parse.
    expect(parsePurchaseIntent({currency: 'SOL', amount: '1', stage: 0, referrer: SHORT_KEY})?.referrer).toBe(SHORT_KEY);
    expect(parsePurchaseIntent({currency: 'SOL', amount: '1', stage: 0, referrer: DEFAULT_KEY})?.referrer).toBe(DEFAULT_KEY);
    for (const referrer of ['', 'x'.repeat(31), '1'.repeat(45), `${R.slice(0, -1)}0`, 7, {}, [R], true]) {
      expect([referrer, parsePurchaseIntent({currency: 'SOL', amount: '1', stage: 0, referrer})]).toEqual([referrer, null]);
    }
    expect(parsePurchaseIntent({currency: 'SOL', amount: '1', stage: 0, referrer: R, extra: 1})).toBeNull();
    expect(parsePurchaseIntent({currency: 'SOL', amount: '1', referrer: R})).toBeNull();
  });

  it('the digest binds the referral address: with one it differs from without and from another; without one it is B1d-1b’s (captured.test.ts)', () => {
    const d = (i: PurchaseIntent) => intentDigest(PRESALE_BUY_INTENT, ACCOUNT, i);
    const digests = [d(intent('SOL', SOL_2)), d(intent('SOL', SOL_2, R)), d(intent('SOL', SOL_2, OTHER))];
    expect(new Set(digests).size).toBe(3);
    expect(d(intent('SOL', SOL_2, R))).toBe(d({currency: 'SOL', amount: SOL_2, stage: 0, referrer: R}));
  });
});

describe('presale.checkReferrer (§1.4, §3.5, C32): its order, each line at its boundary', () => {
  it('a valid address: {ok: true} after one getAccountsData of the buyer’s allocation and the referrer’s (positive control)', async () => {
    const w = await world();
    expect(await check(w, R)).toEqual({ok: true, data: {ok: true}});
    expect(w.accountReads).toEqual([[PDAS.userAllocation.toBase58(), R_ALLOCATION]]);
    // A first purchase from an allocation that exists but never bought (purchase_count 0) takes one too.
    expect(await check(await world({chain: NEVER_BOUGHT}), R)).toEqual({ok: true, data: {ok: true}});
  });

  it('referrer-invalid: a 31-byte key, the default key — nothing read', async () => {
    for (const k of [SHORT_KEY, DEFAULT_KEY]) {
      const w = await world();
      expect([k, await check(w, k)]).toEqual([k, {ok: true, data: {ok: false, line: 'referrer-invalid'}}]);
      expect(w.accountReads).toEqual([]);
    }
  });

  it('referrer-self: the buyer, another account of the session, an account of the stored wallet not in the session — nothing read', async () => {
    const buyer = await world();
    expect(await check(buyer, ACCOUNT)).toEqual({ok: true, data: {ok: false, line: 'referrer-self'}});
    const session = await world({session: [SESSION_ACCOUNT, SECOND]});
    expect(await check(session, SECOND.publicKey)).toEqual({ok: true, data: {ok: false, line: 'referrer-self'}});
    const stored = await world();
    await stored.ext.local.set(VAULT_KEY, {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Account 1', publicKey: ACCOUNT}, {index: 1, name: 'Account 2', publicKey: SECOND.publicKey}]});
    expect((await getSession(stored.ext))?.map(a => a.publicKey)).toEqual([ACCOUNT]);
    expect(await check(stored, SECOND.publicKey)).toEqual({ok: true, data: {ok: false, line: 'referrer-self'}});
    expect([buyer.accountReads, session.accountReads, stored.accountReads]).toEqual([[], [], []]);
    // Negative control: the same address is a referrer for a wallet that does not hold it.
    expect(await check(await world({referrers: [new Map([[allocationOf(SECOND.publicKey), program(allocationData({user: SECOND.publicKey}))]])]}), SECOND.publicKey)).toEqual({ok: true, data: {ok: true}});
  });

  it('referrer-not-applicable: an on-chain referrer, or not a first purchase (purchase_count 1) — an on-chain referrer always wins (D8)', async () => {
    expect(await check(await world({chain: {...EXISTING, allocation: program(allocationData({referrer: OTHER}))}}), R)).toEqual({ok: true, data: {ok: false, line: 'referrer-not-applicable'}});
    expect(await check(await world({chain: {...EXISTING, allocation: program(allocationData({count: 1}))}}), R)).toEqual({ok: true, data: {ok: false, line: 'referrer-not-applicable'}});
    // An on-chain referrer that is the address itself: still nothing to register.
    expect(await check(await world({chain: {...NEVER_BOUGHT, allocation: program(allocationData({count: 0, referrer: R}))}}), R)).toEqual({ok: true, data: {ok: false, line: 'referrer-not-applicable'}});
  });

  it('referrer-no-allocation: its allocation absent, another user’s at user@8, not the program’s, of another length — §2.1 rule 6', async () => {
    for (const [name, a] of [
      ['absent', null],
      ['a foreign user@8', program(allocationData({user: OTHER}))],
      ['not the program’s', {...R_ALLOCATED, owner: SYSTEM_PROGRAM_ID}],
      ['116 bytes', program(allocationData({user: R, length: 116}))],
      ['a claimed byte of 2', program(allocationData({user: R, claimed: 2}))],
    ] as const) {
      expect([name, await check(await world({referrers: [new Map([[R_ALLOCATION, a]])]}), R)]).toEqual([name, {ok: true, data: {ok: false, line: 'referrer-no-allocation'}}]);
    }
  });

  it('the order: invalid, self, not-applicable, no-allocation — each before the next', async () => {
    const both = {chain: {...EXISTING, allocation: program(allocationData({referrer: OTHER}))}, referrers: [new Map([[R_ALLOCATION, null]])], session: [SESSION_ACCOUNT, SECOND]};
    expect(await check(await world(both), SECOND.publicKey)).toEqual({ok: true, data: {ok: false, line: 'referrer-self'}});
    expect(await check(await world(both), R)).toEqual({ok: true, data: {ok: false, line: 'referrer-not-applicable'}});
  });

  it('a failed read: 403 → coordinator-refused, unreachable → presale-unavailable; the buyer’s allocation malformed → presale-unavailable', async () => {
    expect(await check(await world({refErrors: [new RpcForbidden('/rpc')]}), R)).toEqual({ok: false, error: 'coordinator-refused'});
    expect(await check(await world({refErrors: [new RequestUnreachable('/rpc', 'down')]}), R)).toMatchObject({ok: false, error: 'presale-unavailable'});
    expect(await check(await world({chain: {...EXISTING, allocation: program(allocationData({user: OTHER}))}}), R)).toEqual({ok: false, error: 'presale-unavailable', data: {detail: 'malformed'}});
  });

  it('B1d-2 Task 3: whatever the field holds is the background’s to judge — not 32–44 base58 characters (empty, 31 or 45 characters, outside base58, a long paste) → referrer-invalid, nothing read', async () => {
    for (const referrer of ['', 'x'.repeat(31), '1'.repeat(45), `${R.slice(0, -1)}0`, ` ${R}`, 'a'.repeat(5000)]) {
      const w = await world();
      expect([referrer.length, await check(w, referrer)]).toEqual([referrer.length, {ok: true, data: {ok: false, line: 'referrer-invalid'}}]);
      expect(w.accountReads).toEqual([]);
    }
    // Still behind the session: locked first (nothing judged for a locked wallet).
    const locked = await world();
    await clearSession(locked.ext);
    expect(await check(locked, 'x')).toEqual({ok: false, error: 'locked'});
  });

  it.each([
    ['an extra key', {extra: 1}],
    ['a referrer that is not a string', {referrer: 7}],
    ['a referrer that is null', {referrer: null}],
    ['no referrer', {referrer: undefined}],
    ['a non-address account', {account: 'not-an-address'}],
  ])('%s → malformed, nothing read', async (_, over) => {
    const w = await world();
    expect(await ask(w, {type: 'presale.checkReferrer', account: ACCOUNT, referrer: R, ...over})).toEqual({ok: false, error: 'malformed'});
    expect(w.accountReads).toEqual([]);
  });

  it('locked, or an account outside the session — nothing read; from the approval window or the vault page: forbidden', async () => {
    const locked = await world();
    await clearSession(locked.ext);
    expect(await check(locked, R)).toEqual({ok: false, error: 'locked'});
    const other = await world();
    expect(await ask(other, {type: 'presale.checkReferrer', account: OTHER, referrer: R})).toEqual({ok: false, error: 'unknown-account'});
    for (const page of ['approve.html', 'unlock.html']) {
      const sender = {...POPUP(other.ext), url: `${other.ext.extensionOrigin}/${page}`, tab: {}, frameId: 0};
      expect([page, await handleMessage(other.ext, {type: 'presale.checkReferrer', account: ACCOUNT, referrer: R}, sender, other.deps)]).toEqual([page, {ok: false, error: 'forbidden'}]);
    }
    expect([locked.accountReads, other.accountReads]).toEqual([[], []]);
  });
});

describe('prepare with a referral address (§3.3 steps 2, 4–7; §3.5)', () => {
  it('a first SOL purchase: register_referrer between the compute budget and the purchase, account 3 its allocation, the view and #10 say it registers', async () => {
    const w = await world();
    const view = await prepare(w, intent('SOL', SOL_2, R));
    expect(view.referrer).toEqual({address: R, registers: true});
    expect(view.simulation.instructionCount).toBe(4);
    expect(view.fees.rentLamports).toBe((ALLOCATION_RENT + USER_RENT).toString());
    expect(view.reauth?.reasons).toContain('first-purchase');
    const m = messageOf(w.wires[0] as string);
    expect([0, 1, 2, 3].map(i => programOf(m, i))).toEqual(['ComputeBudget111111111111111111111111111111', 'ComputeBudget111111111111111111111111111111', MAINNET_PROGRAM_ID, MAINNET_PROGRAM_ID]);
    // register_referrer exactly as the IDL has it: its discriminator, the referrer as its argument, its four accounts.
    expect([...(m.compiledInstructions[2]?.data ?? [])]).toEqual([...(REGISTER?.discriminator ?? []), ...new PublicKey(R).toBytes()]);
    expect(REGISTER?.accounts).toEqual(['user_account', 'user_allocation', 'user', 'system_program']);
    expect(named(m, 2)).toEqual([PDAS.userAccount.toBase58(), PDAS.userAllocation.toBase58(), ACCOUNT, SYSTEM_PROGRAM_ID]);
    expect(named(m, 3)[3]).toBe(R_ALLOCATION);
    // The simulation is asked for what B1d-1b asks (the user account too, absent in the snapshot); the referral address's
    // allocation was read once, by itself.
    expect(w.asked).toEqual([[ACCOUNT, PDAS.userAllocation.toBase58(), TREASURY_ADDRESS, PDAS.userAccount.toBase58()]]);
    expect(w.accountReads).toEqual([[R_ALLOCATION]]);
    const [entry] = await stored(w);
    expect(entry?.intent).toEqual({currency: 'SOL', amount: SOL_2, stage: 0, referrer: R});
    expect(entry?.shown.view.referrer).toEqual({address: R, registers: true});
    expect(entry?.intentDigest).toBe(intentDigest(PRESALE_BUY_INTENT, ACCOUNT, intent('SOL', SOL_2, R)));
    expect(await challengeInfo(w.ext, w.deps.now(), view.reauth?.challengeId ?? '')).toMatchObject({kind: 'presale-buy', referrer: {address: R, registers: true}, reasons: ['first-purchase', 'over-5-percent', 'over-usd-threshold']});
    expect(w.deps.broadcasts).toEqual([]);
  });

  it('a first USDC purchase from an allocation that never bought: the same instruction, no rent (both PDAs exist), still re-authenticated', async () => {
    const w = await world({chain: NEVER_BOUGHT});
    const view = await prepare(w, intent('USDC', '20000000', R));
    expect([view.referrer, view.fees.rentLamports, view.reauth?.reasons]).toEqual([{address: R, registers: true}, '0', ['first-purchase']]);
    const m = messageOf(w.wires[0] as string);
    expect(named(m, 2)).toEqual([PDAS.userAccount.toBase58(), PDAS.userAllocation.toBase58(), ACCOUNT, SYSTEM_PROGRAM_ID]);
    expect(named(m, 3)[3]).toBe(R_ALLOCATION);
    expect(named(m, 3)[4]).toBe(HOLDING_LARGE);
  });

  it('refused, never dropped: an on-chain referrer, not a first purchase → referrer-not-applicable before anything is built or simulated', async () => {
    for (const chain of [{...EXISTING, allocation: program(allocationData({referrer: OTHER}))}, EXISTING, {...NEVER_BOUGHT, allocation: program(allocationData({count: 0, referrer: R}))}]) {
      const w = await world({chain});
      expect(await refusal(prepare(w, intent('SOL', SOL_2, R)))).toBe('referrer-not-applicable');
      expect([w.wires, await stored(w)]).toEqual([[], []]);
    }
    // Positive control: the same accounts without a referral address prepare (the on-chain referrer credited, as B1d-1b).
    const onChain = await world({chain: {...EXISTING, allocation: program(allocationData({referrer: OTHER}))}});
    expect((await prepare(onChain, intent('SOL', SOL_2))).referrer).toEqual({address: OTHER, registers: false});
  });

  it('each other line at prepare: invalid, self (the buyer, another account of the session), no allocation — nothing simulated', async () => {
    const cases: [string, PurchaseIntent, Parameters<typeof world>[0]][] = [
      ['referrer-invalid', intent('SOL', SOL_2, SHORT_KEY), {}],
      ['referrer-invalid', intent('SOL', SOL_2, DEFAULT_KEY), {}],
      ['referrer-self', intent('SOL', SOL_2, ACCOUNT), {}],
      ['referrer-self', intent('SOL', SOL_2, SECOND.publicKey), {session: [SESSION_ACCOUNT, SECOND]}],
      ['referrer-no-allocation', intent('SOL', SOL_2, R), {referrers: [new Map([[R_ALLOCATION, null]])]}],
      ['referrer-no-allocation', intent('SOL', SOL_2, R), {referrers: [new Map([[R_ALLOCATION, program(allocationData({user: OTHER}))]])]}],
    ];
    for (const [code, i, o] of cases) {
      const w = await world(o);
      expect([i.referrer, await refusal(prepare(w, i))]).toEqual([i.referrer, code]);
      expect(w.wires).toEqual([]);
    }
  });

  it('the gate closed and a stage that moved decide first, as without a referrer', async () => {
    const closed = await world({geo: async () => ({open: false, reason: 'no_check', countryCode: null})});
    expect(await refusal(prepare(closed, intent('SOL', SOL_2, ACCOUNT)))).toBe('geo-closed');
    expect(await refusal(prepare(await world(), {...intent('SOL', SOL_2, ACCOUNT), stage: 1}))).toBe('price-changed');
  });

  it('a referrer allocation read failing: 403 → coordinator-refused, unreachable → presale-unavailable; nothing simulated', async () => {
    const forbidden = await world({refErrors: [new RpcForbidden('/rpc')]});
    expect(await refusal(prepare(forbidden, intent('SOL', SOL_2, R)))).toBe('coordinator-refused');
    const down = await world({refErrors: [new RequestUnreachable('/rpc', 'down')]});
    expect(await refusal(prepare(down, intent('SOL', SOL_2, R)))).toBe('presale-unavailable');
    expect([forbidden.wires, down.wires]).toEqual([[], []]);
  });
});

describe('the simulation with a referrer (§3.3 step 5)', () => {
  it('referrer@84 after must be the registered referrer: left zero (the registration ignored), or another key → simulation-mismatch', async () => {
    expect(await refusal(prepare(await world({edits: [referrerAfter(null)]}), intent('SOL', SOL_2, R)))).toBe('simulation-mismatch');
    expect(await refusal(prepare(await world({edits: [referrerAfter(OTHER)]}), intent('SOL', SOL_2, R)))).toBe('simulation-mismatch');
    // Positive control: the registered referrer itself.
    expect((await prepare(await world({edits: [referrerAfter(R)]}), intent('SOL', SOL_2, R))).referrer).toEqual({address: R, registers: true});
  });

  it('a purchase without a referral address: referrer@84 stays as it was — zero, or the on-chain referrer', async () => {
    expect(await refusal(prepare(await world({edits: [referrerAfter(R)]}), intent('SOL', SOL_2)))).toBe('simulation-mismatch');
    const onChain = {chain: {...EXISTING, allocation: program(allocationData({referrer: OTHER}))}};
    expect(await refusal(prepare(await world({...onChain, edits: [referrerAfter(R)]}), intent('SOL', SOL_2)))).toBe('simulation-mismatch');
    expect(await refusal(prepare(await world({...onChain, edits: [referrerAfter(null)]}), intent('SOL', SOL_2)))).toBe('simulation-mismatch');
  });

  it('register_referrer creates the two PDAs: their rent, from the simulation, is checked as without one — above its bound → mismatch, at it → accepted', async () => {
    const lamports = (n: bigint): Edit => (o, at) =>
      withAccount(PDAS.userAllocation.toBase58(), a => (a === null ? null : {...a, lamports: n}))(withAccount(ACCOUNT, a => (a === null ? null : {...a, lamports: a.lamports - (n - ALLOCATION_RENT)}))(o, at), at);
    expect(await refusal(prepare(await world({edits: [lamports(PRESALE_ALLOCATION_RENT_LAMPORTS + 1n)]}), intent('SOL', SOL_2, R)))).toBe('simulation-mismatch');
    expect((await prepare(await world({edits: [lamports(PRESALE_ALLOCATION_RENT_LAMPORTS)]}), intent('SOL', SOL_2, R))).fees.rentLamports).toBe((PRESALE_ALLOCATION_RENT_LAMPORTS + USER_RENT).toString());
    // The payer paying the rent once more than the PDAs hold (rent charged twice) is still an outflow mismatch.
    expect(await refusal(prepare(await world({edits: [withAccount(ACCOUNT, a => (a === null ? null : {...a, lamports: a.lamports - ALLOCATION_RENT}))]}), intent('SOL', SOL_2, R)))).toBe('simulation-mismatch');
  });

  it('the program refusing register_referrer (AlreadyHasReferrer on instruction 2) → simulation-failed', async () => {
    // The snapshot sees no referrer; by the simulation one was registered from another device.
    const w = await world({simChains: [{...NEVER_BOUGHT, allocation: program(allocationData({count: 0, referrer: OTHER}))}], chain: NEVER_BOUGHT});
    expect(await refusal(prepare(w, intent('SOL', SOL_2, R)))).toBe('simulation-failed');
  });

  it('the busy-destination retry re-resolves the referrer (C39): the fresh snapshot finds a referrer registered — another, or this very one — → state-changed, no second simulation', async () => {
    const busy: Edit = withAccount(TREASURY_ADDRESS, a => (a === null ? null : {...a, lamports: a.lamports - 1n}));
    for (const registered of [OTHER, R]) {
      const w = await world({chains: [NEVER_BOUGHT, {...NEVER_BOUGHT, allocation: program(allocationData({count: 0, spent: 0n, totalTokens: 0n, bonus: 0n, referrer: registered}))}], edits: [busy]});
      expect([registered, await refusal(prepare(w, intent('SOL', SOL_2, R)))]).toEqual([registered, 'state-changed']);
      expect(w.wires).toHaveLength(1);
    }
    // Positive control: a fresh snapshot that changed nothing the bytes were built from → the second simulation, prepared.
    const w = await world({chains: [NEVER_BOUGHT, NEVER_BOUGHT], edits: [busy]});
    expect((await prepare(w, intent('SOL', SOL_2, R))).referrer).toEqual({address: R, registers: true});
    expect(w.wires).toHaveLength(2);
    expect(w.wires[1]).toBe(w.wires[0]);
  });
});

describe('presale.buy with a referral address: signed once, recorded with it (§3.3, §2.3, §2.4)', () => {
  it('end to end: prepare → #10 proven → presale.buy → v1_pending names the referrer → confirmed → the record POSTs referrerAddress', async () => {
    const w = await world();
    const view = await provenPurchase(w, intent('SOL', SOL_2, R));
    const answer = await buy(w, view.id);
    expect(answer).toMatchObject({ok: true, data: {state: 'pending', extra: {kind: 'presale-buy', data: {referrer: R}}}});
    expect(w.deps.broadcasts).toHaveLength(1);
    const sent = VersionedTransaction.deserialize(w.deps.broadcasts[0] as Uint8Array);
    expect(ed25519.verify(sent.signatures[0] as Uint8Array, sent.message.serialize(), new PublicKey(ACCOUNT).toBytes())).toBe(true);
    expect(named(sent.message as MessageV0, 3)[3]).toBe(R_ALLOCATION);
    // The referral address's allocation read at prepare and again at the signature.
    expect(w.accountReads).toEqual([[R_ALLOCATION], [R_ALLOCATION]]);
    w.deps.reader = {...w.deps.reader, getSignatureStatuses: async sigs => sigs.map(() => ({err: null, confirmationStatus: 'confirmed' as const})), getBlockHeight: async () => 900};
    w.deps.clock.t += 2_000;
    await pollOnce(w.ext, w.deps);
    await runPresaleRecords(w.ext, w.deps);
    const [entry] = await readPresaleRecords(w.ext);
    expect(entry?.payload.referrerAddress).toBe(R);
    expect(w.posts).toEqual([{path: '/solana/purchase', body: expect.objectContaining({txHash: firstSignature(w.deps.broadcasts[0] as Uint8Array), buyerAddress: ACCOUNT, referrerAddress: R})}]);
  });

  it('pendingData: the registered referrer; a stored view that names another, or says it registers nothing, does not read back', async () => {
    const w = await world();
    await prepare(w, intent('SOL', SOL_2, R));
    const [entry] = await stored(w);
    if (entry === undefined || PRESALE_BUY_INTENT.pendingData === undefined) throw new Error('no entry');
    expect(PRESALE_BUY_INTENT.pendingData(entry, entry.intent)).toMatchObject({referrer: R});
    for (const referrer of [{address: OTHER, registers: true}, {address: R, registers: false}, null]) {
      const forged = {...entry, shown: {...entry.shown, view: {...entry.shown.view, referrer}}};
      expect([referrer, PRESALE_BUY_INTENT.pendingData(forged, entry.intent)]).toEqual([referrer, null]);
    }
    // Nor one simulated as three instructions (a registration counts one more).
    const three = {...entry, shown: {...entry.shown, simulation: {...entry.shown.simulation, instructionCount: 3}}};
    expect(PRESALE_BUY_INTENT.pendingData(three, entry.intent)).toBeNull();
  });
});

describe('pendingData ties the shown referrer to the basis (review 1 M1)', () => {
  it('an on-chain referrer: named as read (positive control); a stored view naming another, or none, and a basis naming one beside a registration, do not read back', async () => {
    const w = await world({chain: {...EXISTING, allocation: program(allocationData({referrer: OTHER}))}});
    await prepare(w, intent('SOL', SOL_2));
    const [entry] = await stored(w);
    if (entry === undefined || PRESALE_BUY_INTENT.pendingData === undefined) throw new Error('no entry');
    expect([entry.shown.view.referrer, entry.shown.basis.referrer, PRESALE_BUY_INTENT.pendingData(entry, entry.intent)]).toEqual([{address: OTHER, registers: false}, OTHER, expect.objectContaining({referrer: OTHER})]);
    for (const referrer of [{address: R, registers: false}, null]) {
      const forged = {...entry, shown: {...entry.shown, view: {...entry.shown.view, referrer}}};
      expect([referrer, PRESALE_BUY_INTENT.pendingData(forged, entry.intent)]).toEqual([referrer, null]);
    }
    const otherBasis = {...entry, shown: {...entry.shown, basis: {...entry.shown.basis, referrer: R}}};
    expect(PRESALE_BUY_INTENT.pendingData(otherBasis, entry.intent)).toBeNull();
    const fresh = await world();
    await prepare(fresh, intent('SOL', SOL_2, R));
    const [registering] = await stored(fresh);
    if (registering === undefined) throw new Error('no entry');
    expect([registering.shown.basis.referrer, PRESALE_BUY_INTENT.pendingData(registering, registering.intent)]).toEqual([null, expect.objectContaining({referrer: R})]);
    const claimed = {...registering, shown: {...registering.shown, basis: {...registering.shown.basis, referrer: OTHER}}};
    expect(PRESALE_BUY_INTENT.pendingData(claimed, registering.intent)).toBeNull();
  });
});

describe('presale.buy with a referral address: what the signature checks again (C22, §3.5) — the entry and the proof stay', () => {
  type Row = {sign?: Partial<Chain>; referrers?: Map<string, AccountData | null>; refError?: Error; session?: SessionAccount[]};
  const rows: [string, string, Row][] = [
    ['another referrer registered meanwhile', 'state-changed', {sign: {...NEVER_BOUGHT, allocation: program(allocationData({count: 0, spent: 0n, totalTokens: 0n, bonus: 0n, referrer: OTHER}))}}],
    ['this very referrer registered meanwhile, from another device', 'state-changed', {sign: {...NEVER_BOUGHT, allocation: program(allocationData({count: 0, spent: 0n, totalTokens: 0n, bonus: 0n, referrer: R}))}}],
    ['a purchase meanwhile (purchase_count 1)', 'state-changed', {sign: {...NEVER_BOUGHT, allocation: program(allocationData({count: 1}))}}],
    ['its allocation gone', 'referrer-no-allocation', {referrers: new Map([[R_ALLOCATION, null]])}],
    ['its allocation now another user’s', 'referrer-no-allocation', {referrers: new Map([[R_ALLOCATION, program(allocationData({user: OTHER}))]])}],
    ['the address now an account of this wallet', 'referrer-self', {session: [SESSION_ACCOUNT, {...SECOND, publicKey: R}]}],
    ['its allocation read answered 403', 'coordinator-refused', {refError: new RpcForbidden('/rpc')}],
    ['its allocation read unreachable', 'presale-unavailable', {refError: new RequestUnreachable('/rpc', 'down')}],
  ];

  it.each(rows)('%s → %s; nothing signed', async (_, code, row) => {
    const w = await world({chains: [NEVER_BOUGHT, row.sign ?? NEVER_BOUGHT], referrers: [new Map([[R_ALLOCATION, R_ALLOCATED]]), row.referrers ?? new Map([[R_ALLOCATION, R_ALLOCATED]])], refErrors: [null, row.refError ?? null]});
    const view = await provenPurchase(w, intent('SOL', SOL_2, R));
    if (row.session !== undefined) await setSession(w.ext, row.session);
    expect(await buy(w, view.id)).toMatchObject({ok: false, error: code});
    expect((await stored(w)).map(e => e.id)).toEqual([view.id]);
    expect(await challengeSatisfied(w.ext, w.deps.now(), view.reauth?.challengeId ?? '', intentDigest(PRESALE_BUY_INTENT, ACCOUNT, intent('SOL', SOL_2, R)))).toBe(true);
    expect([w.deps.broadcasts, await records(w)]).toEqual([[], []]);
  });

  it('every check passing at the signature (positive control): it signs the registration', async () => {
    const w = await world({chains: [NEVER_BOUGHT, NEVER_BOUGHT]});
    const view = await provenPurchase(w, intent('SOL', SOL_2, R));
    expect(await buy(w, view.id)).toMatchObject({ok: true, data: {state: 'pending'}});
    expect(w.deps.broadcasts).toHaveLength(1);
  });

  it('a first USDC purchase that registers its referrer signs (positive control, review 1 Minor 1): register_referrer(R), account 3 its allocation, account 4 the paying holding', async () => {
    const w = await world({chains: [NEVER_BOUGHT, NEVER_BOUGHT]});
    const view = await provenPurchase(w, intent('USDC', '20000000', R));
    expect(await buy(w, view.id)).toMatchObject({ok: true, data: {state: 'pending'}});
    expect(w.deps.broadcasts).toHaveLength(1);
    const m = VersionedTransaction.deserialize(w.deps.broadcasts[0] as Uint8Array).message as MessageV0;
    expect(m.compiledInstructions).toHaveLength(4);
    expect([...(m.compiledInstructions[2]?.data ?? [])]).toEqual([...(REGISTER?.discriminator ?? []), ...new PublicKey(R).toBytes()]);
    expect([named(m, 3)[3], named(m, 3)[4]]).toEqual([R_ALLOCATION, HOLDING_LARGE]);
  });
});

describe('the signature rests on the bytes the integrity binds, never on `shown` (C22, review 1 M1) — each forgery has its integrity recomputed', () => {
  async function forged(f: (m: MessageV0) => MessageV0): Promise<{w: World; id: string}> {
    const w = await world({chains: [{}, {}]});
    const view = await provenPurchase(w, intent('SOL', SOL_2, R));
    await forgeMessage(w, f);
    return {w, id: view.id};
  }
  const kept = async (w: World, id: string) => {
    expect((await stored(w)).map(e => e.id)).toEqual([id]);
    expect([w.deps.broadcasts, await records(w)]).toEqual([[], []]);
  };

  it('the registration removed (the purchase alone, still crediting the referrer’s allocation) → prepared-invalid', async () => {
    const {w, id} = await forged(m => compile(m, buildBuyInstructions(new PublicKey(ACCOUNT), BigInt(SOL_2), priceOf(m), {referrerAllocation: new PublicKey(R_ALLOCATION), registerReferrer: null}, new PublicKey(TREASURY_ADDRESS))));
    expect(await buy(w, id)).toMatchObject({ok: false, error: 'prepared-invalid'});
    await kept(w, id);
  });

  it('another referrer registered and credited instead → prepared-invalid', async () => {
    const {w, id} = await forged(m => compile(m, buildBuyInstructions(new PublicKey(ACCOUNT), BigInt(SOL_2), priceOf(m), {referrerAllocation: new PublicKey(allocationOf(OTHER)), registerReferrer: new PublicKey(OTHER)}, new PublicKey(TREASURY_ADDRESS))));
    expect(await buy(w, id)).toMatchObject({ok: false, error: 'prepared-invalid'});
    await kept(w, id);
  });

  it('the registration names another referrer while account 3 stays this one’s allocation → prepared-invalid', async () => {
    const {w, id} = await forged(m => compile(m, buildBuyInstructions(new PublicKey(ACCOUNT), BigInt(SOL_2), priceOf(m), {referrerAllocation: new PublicKey(R_ALLOCATION), registerReferrer: new PublicKey(OTHER)}, new PublicKey(TREASURY_ADDRESS))));
    expect(await buy(w, id)).toMatchObject({ok: false, error: 'prepared-invalid'});
    await kept(w, id);
  });

  it('the referrer registered but account 3 the default allocation (the program would refuse it; the bonus nowhere) → prepared-invalid', async () => {
    const {w, id} = await forged(m => compile(m, buildBuyInstructions(new PublicKey(ACCOUNT), BigInt(SOL_2), priceOf(m), {referrerAllocation: new PublicKey(allocationOf(DEFAULT_KEY)), registerReferrer: new PublicKey(R)}, new PublicKey(TREASURY_ADDRESS))));
    expect(await buy(w, id)).toMatchObject({ok: false, error: 'prepared-invalid'});
    await kept(w, id);
  });

  it('the registration’s accounts swapped (user_account and user_allocation) → prepared-invalid', async () => {
    const {w, id} = await forged(m => {
      const ixs = m.compiledInstructions.map((ix, i) => (i === 2 ? {...ix, accountKeyIndexes: [ix.accountKeyIndexes[1] as number, ix.accountKeyIndexes[0] as number, ...ix.accountKeyIndexes.slice(2)]} : ix));
      return new MessageV0({header: m.header, staticAccountKeys: m.staticAccountKeys, recentBlockhash: m.recentBlockhash, compiledInstructions: ixs, addressTableLookups: m.addressTableLookups});
    });
    expect(await buy(w, id)).toMatchObject({ok: false, error: 'prepared-invalid'});
    await kept(w, id);
  });

  it('the honest bytes unchanged but re-serialized (positive control): signs', async () => {
    const {w, id} = await forged(m => new MessageV0({header: m.header, staticAccountKeys: m.staticAccountKeys, recentBlockhash: m.recentBlockhash, compiledInstructions: m.compiledInstructions, addressTableLookups: m.addressTableLookups}));
    expect(await buy(w, id)).toMatchObject({ok: true});
  });

  it('a registration whose re-authentication was taken away (challengeId null, integrity recomputed) → prepared-invalid; nothing signed', async () => {
    const w = await world({chains: [{}, {}]});
    const view = await provenPurchase(w, intent('SOL', SOL_2, R));
    const [entry] = await stored(w);
    if (entry === undefined) throw new Error('no entry');
    const bare = {...entry, challengeId: null};
    await w.ext.session.set(PREPARED_KEY, [{...bare, integrity: preparedIntegrity(bare)}]);
    expect(await buy(w, view.id)).toMatchObject({ok: false, error: 'prepared-invalid'});
    await kept(w, view.id);
  });

  it('the entry rewritten whole for another referrer (intent, digest, message, integrity) under the first one’s proof → reauth-required: the proof was for that referrer', async () => {
    const w = await world({chains: [{}, {}], referrers: [new Map([[R_ALLOCATION, R_ALLOCATED], [allocationOf(OTHER), program(allocationData({user: OTHER}))]])]});
    const view = await provenPurchase(w, intent('SOL', SOL_2, R));
    const [entry] = await stored(w);
    if (entry === undefined) throw new Error('no entry');
    const m = VersionedMessage.deserialize(base64.decode(entry.message)) as MessageV0;
    const other = compile(m, buildBuyInstructions(new PublicKey(ACCOUNT), BigInt(SOL_2), priceOf(m), {referrerAllocation: new PublicKey(allocationOf(OTHER)), registerReferrer: new PublicKey(OTHER)}, new PublicKey(TREASURY_ADDRESS)));
    const i = intent('SOL', SOL_2, OTHER);
    const bound = {...entry, intent: i, intentDigest: intentDigest(PRESALE_BUY_INTENT, ACCOUNT, i), message: base64.encode(other.serialize())};
    await w.ext.session.set(PREPARED_KEY, [{...bound, integrity: preparedIntegrity(bound), shown: {...entry.shown, view: {...entry.shown.view, referrer: {address: OTHER, registers: true}}}}]);
    expect(await buy(w, view.id)).toMatchObject({ok: false, error: 'reauth-required'});
    await kept(w, view.id);
  });

  it('the stored intent’s referrer changed without the integrity → prepared-invalid', async () => {
    const w = await world({chains: [{}, {}]});
    const view = await provenPurchase(w, intent('SOL', SOL_2, R));
    const [entry] = await stored(w);
    if (entry === undefined) throw new Error('no entry');
    await w.ext.session.set(PREPARED_KEY, [{...entry, intent: intent('SOL', SOL_2, OTHER)}]);
    expect(await buy(w, view.id)).toMatchObject({ok: false});
    expect(w.deps.broadcasts).toEqual([]);
  });

  it('assertPurchaseMessage: a registration where none is expected, none where one is → an engine bug, thrown', () => {
    const user = new PublicKey(ACCOUNT);
    const m0 = new TransactionMessage({payerKey: user, recentBlockhash: BLOCKHASH, instructions: []}).compileToV0Message();
    const plain = compile(m0, buildBuyInstructions(user, 7n, 0, {referrerAllocation: new PublicKey(R_ALLOCATION), registerReferrer: null}, new PublicKey(TREASURY_ADDRESS)));
    const registering = compile(m0, buildBuyInstructions(user, 7n, 0, {referrerAllocation: new PublicKey(R_ALLOCATION), registerReferrer: new PublicKey(R)}, new PublicKey(TREASURY_ADDRESS)));
    const i = {account: ACCOUNT, currency: 'SOL' as const, referrerAllocation: R_ALLOCATION, destination: TREASURY_ADDRESS, source: null, amount: 7n};
    expect(assertPurchaseMessage(registering, {...i, registerReferrer: R})).toBe(3);
    expect(assertPurchaseMessage(plain, {...i, registerReferrer: null})).toBe(2);
    expect(() => assertPurchaseMessage(registering, {...i, registerReferrer: null})).toThrow('unexpected instructions');
    expect(() => assertPurchaseMessage(plain, {...i, registerReferrer: R})).toThrow('unexpected instructions');
    expect(() => assertPurchaseMessage(registering, {...i, registerReferrer: OTHER})).toThrow('not this referrer');
  });
});

describe('#10 describes the referrer (§4.2, Q47)', () => {
  const ABOUT = {
    kind: 'presale-buy',
    account: ACCOUNT,
    currency: 'SOL',
    amount: SOL_2,
    stage: 0,
    priceTicks: '1501',
    nocBase: '2643837441705',
    spentCents: '39684',
    destination: TREASURY_ADDRESS,
    networkLamports: '11000',
    priorityLamports: '6000',
    rentLamports: '2189480',
    reasons: ['first-purchase'],
    thresholdCents: 10_000,
  };
  const rowsOf = (about: Record<string, unknown>) => describePresale(about)?.rows.map(r => [r.label, r.value, r.address]);

  it('a registration: "Referred by" with the whole address after "To", then Q47’s note; an on-chain referrer: the row without the note', () => {
    expect(rowsOf({...ABOUT, referrer: {address: R, registers: true}})?.slice(3, 6)).toEqual([
      ['To', 'Noctura presale', TREASURY_ADDRESS],
      ['Referred by', null, R],
      ["Saved to your presale account with this purchase. It can't be changed later.", null, null],
    ]);
    expect(rowsOf({...ABOUT, referrer: {address: R, registers: false}})?.slice(3, 5)).toEqual([
      ['To', 'Noctura presale', TREASURY_ADDRESS],
      ['Referred by', null, R],
    ]);
    expect(rowsOf({...ABOUT, referrer: {address: R, registers: false}})?.[5]?.[0]).toBe('Network fee');
    // Without one: B1d-1b's rows.
    expect(rowsOf(ABOUT)?.map(r => r[0])).toEqual(['You receive (est.)', 'Stage', 'Price', 'To', 'Network fee', 'Priority', 'Account setup (first purchase)']);
  });

  it('a referrer that does not read back describes nothing: a bad address, an extra key, registers not a boolean, a registration without the first-purchase reason', () => {
    for (const referrer of [{address: 'nope', registers: true}, {address: R, registers: true, extra: 1}, {address: R, registers: 'yes'}, [R], null]) {
      expect([referrer, describePresale({...ABOUT, referrer})]).toEqual([referrer, null]);
    }
    expect(describePresale({...ABOUT, reasons: ['over-5-percent'], referrer: {address: R, registers: true}})).toBeNull();
    expect(describePresale({...ABOUT, reasons: ['over-5-percent'], referrer: {address: R, registers: false}})).not.toBeNull();
  });

  it('the challenge store keeps the background’s own shape only: a registration without first-purchase, or a malformed referrer, is not issued', async () => {
    const w = await world();
    const deps = w.deps;
    const about = (referrer: unknown, reasons: string[] = ['first-purchase']) => ({...ABOUT, reasons, referrer}) as unknown as KindAbout;
    const issued = async (a: KindAbout) => challengeInfo(w.ext, deps.now(), await issueChallenge(w.ext, deps, 'd'.repeat(64), a));
    expect(await issued(about({address: R, registers: true}))).toMatchObject({referrer: {address: R, registers: true}});
    for (const a of [about({address: R, registers: true}, ['over-5-percent']), about({address: 'nope', registers: false}), about({address: R}), about(null)]) {
      await expect(issued(a)).rejects.toThrow();
    }
    expect(Object.keys((await w.ext.session.get(REAUTH_KEY)) as Record<string, unknown>)).toHaveLength(1);
  });
});

describe('an on-chain referrer still always wins (C7, D8)', () => {
  it('no referral address: the on-chain referrer is credited, nothing registered, as B1d-1b; with one: refused, the input never ignored', async () => {
    const chain = {...EXISTING, allocation: program(allocationData({referrer: OTHER}))};
    const plain = await world({chain});
    const view = await prepare(plain, intent('SOL', SOL_2));
    const m = messageOf(plain.wires[0] as string);
    expect([view.referrer, m.compiledInstructions.length, named(m, 2)[3]]).toEqual([{address: OTHER, registers: false}, 3, allocationOf(OTHER)]);
    expect(await refusal(prepare(await world({chain}), intent('SOL', SOL_2, R)))).toBe('referrer-not-applicable');
  });

  it('a prepare without the referral address after one with it replaces the entry: one per account (§1.3), the registration gone with it', async () => {
    const w = await world();
    await prepare(w, intent('SOL', SOL_2, R));
    const again = await prepare(w, intent('SOL', SOL_2));
    expect((await stored(w)).map(e => [e.id, e.intent.referrer ?? null, e.shown.view.referrer])).toEqual([[again.id, null, null]]);
  });
});
