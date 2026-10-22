import {PublicKey} from '@solana/web3.js';
import {readPresaleState, referrerAllocationOf, type PresaleSnapshot, type PresaleState} from '../state';
import {CONFIG_LAYOUT, PRESALE_ALLOCATION_LAYOUT, USER_ACCOUNT_LAYOUT} from '../layouts';
import {fakeReader} from '../../__tests__/fakeDeps';
import {ACCOUNT as SESSION_ACCOUNT, HOLDING_SMALL, RECIPIENT} from '../../__tests__/fixtures';
import {
  MAINNET_ADMIN_ADDRESS,
  MAINNET_NOC_MINT,
  MAINNET_PROGRAM_ID,
  MAINNET_SOL_TREASURY,
  MAINNET_USDC_MINT,
  MAINNET_USDT_MINT,
  MAINNET_VAULT_USDC_ATA,
  MAINNET_VAULT_USDT_ATA,
} from '../../../../../core/presale/addresses';
import {derivePresalePdas, readSolTreasury} from '../../../../../core/presale/allocation';
import {PRESALE_HARD_CAP_BASE, TOKENS_PER_STAGE_BASE} from '../../../../../core/presale/limits';
import {SPL_TOKEN_PROGRAM} from '../../../../../core/solana/encoding';
import {
  RequestUnreachable,
  RpcCoolingDown,
  RpcForbidden,
  RpcHttpError,
  RpcMalformed,
  RpcResponseError,
  SYSTEM_PROGRAM_ID,
  type AccountData,
} from '../../../../../core/solana/rpc';
import {RequestTimedOut} from '../../deps';

// B1d §2.1, §6.1 "State (1a)": the presale opens only on a read where every rule holds; one refusal per rule, each a
// byte builder's single change from the valid fixture (never a hand-typed blob).
const ACCOUNT = SESSION_ACCOUNT.publicKey;
const REFERRER = RECIPIENT;
const OTHER = HOLDING_SMALL;
const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const NOW_MS = 1_760_000_000_000;
const NOW_S = 1_760_000_000n;

type Field = {offset: number};
const putKey = (d: Uint8Array, f: Field, address: string) => d.set(new PublicKey(address).toBytes(), f.offset);
const putU64 = (d: Uint8Array, f: Field, v: bigint) => {
  let x = BigInt.asUintN(64, v);
  for (let i = 0; i < 8; i++) {
    d[f.offset + i] = Number(x & 0xffn);
    x >>= 8n;
  }
};
const putU32 = (d: Uint8Array, f: Field, v: number) => {
  for (let i = 0; i < 4; i++) d[f.offset + i] = (v >>> (8 * i)) & 0xff;
};

interface ConfigBytes {
  length: number;
  discriminator: readonly number[];
  admin: string;
  saleToken: string;
  usdt: string;
  usdc: string;
  stage: number;
  stageSold: bigint;
  tokensSold: bigint;
  raised: bigint;
  start: bigint;
  active: number;
  maxPerUser: bigint;
  minPurchase: bigint;
  treasury: string;
}
const CONFIG: ConfigBytes = {
  length: CONFIG_LAYOUT.length,
  discriminator: CONFIG_LAYOUT.discriminator,
  admin: MAINNET_ADMIN_ADDRESS,
  saleToken: MAINNET_NOC_MINT,
  usdt: MAINNET_USDT_MINT,
  usdc: MAINNET_USDC_MINT,
  stage: 0,
  stageSold: 1_312_240_123_017_711n,
  tokensSold: 1_312_240_123_017_711n,
  raised: 19_696_720n,
  start: NOW_S - 86_400n,
  active: 1,
  maxPerUser: 0n,
  minPurchase: 1_000n,
  treasury: MAINNET_SOL_TREASURY,
};
function configData(o: Partial<ConfigBytes> = {}): Uint8Array {
  const c = {...CONFIG, ...o};
  const F = CONFIG_LAYOUT.fields;
  const d = new Uint8Array(Math.max(c.length, CONFIG_LAYOUT.length));
  d.set(c.discriminator, 0);
  putKey(d, F.admin, c.admin);
  putKey(d, F.sale_token, c.saleToken);
  putKey(d, F.usdt_address, c.usdt);
  putKey(d, F.usdc_address, c.usdc);
  d[F.current_stage.offset] = c.stage;
  putU64(d, F.stage_tokens_sold, c.stageSold);
  putU64(d, F.tokens_sold, c.tokensSold);
  putU64(d, F.total_usd_raised_cents, c.raised);
  putU64(d, F.presale_start_time, c.start);
  d[F.presale_active.offset] = c.active;
  putU64(d, F.max_per_user_usd, c.maxPerUser);
  putU64(d, F.min_purchase_usd, c.minPurchase);
  putKey(d, F.sol_treasury, c.treasury);
  return d.subarray(0, c.length);
}

interface UserBytes {
  length: number;
  discriminator: readonly number[];
  blocked: number;
}
function userData(o: Partial<UserBytes> = {}): Uint8Array {
  const u = {length: USER_ACCOUNT_LAYOUT.length, discriminator: USER_ACCOUNT_LAYOUT.discriminator, blocked: 0, ...o};
  const d = new Uint8Array(Math.max(u.length, USER_ACCOUNT_LAYOUT.length));
  d.set(u.discriminator, 0);
  d[USER_ACCOUNT_LAYOUT.fields.is_blocked.offset] = u.blocked;
  return d.subarray(0, u.length);
}

interface AllocationBytes {
  length: number;
  discriminator: readonly number[];
  user: string;
  totalTokens: bigint;
  spent: bigint;
  count: number;
  bonus: bigint;
  referrer: string | null;
  claimed: number;
}
function allocationData(o: Partial<AllocationBytes> = {}): Uint8Array {
  const a: AllocationBytes = {
    length: PRESALE_ALLOCATION_LAYOUT.length,
    discriminator: PRESALE_ALLOCATION_LAYOUT.discriminator,
    user: ACCOUNT,
    totalTokens: 1_998_667_554_963n,
    spent: 30_000n,
    count: 2,
    bonus: 16_142_571_618n,
    referrer: null,
    claimed: 0,
    ...o,
  };
  const F = PRESALE_ALLOCATION_LAYOUT.fields;
  const d = new Uint8Array(Math.max(a.length, PRESALE_ALLOCATION_LAYOUT.length));
  d.set(a.discriminator, 0);
  putKey(d, F.user, a.user);
  putU64(d, F.total_tokens, a.totalTokens);
  putU64(d, F.total_spent_cents, a.spent);
  putU32(d, F.purchase_count, a.count);
  putU64(d, F.referral_bonus_tokens, a.bonus);
  if (a.referrer !== null) putKey(d, F.referrer, a.referrer);
  d[F.claimed.offset] = a.claimed;
  return d.subarray(0, a.length);
}

/** An SPL Token account (165 bytes): mint 0, owner 32, amount 64, delegate tag 72, state 108, is_native tag 109, close authority tag 129. */
function tokenAccountData(o: {mint: string; owner?: string; amount?: bigint; state?: number}): Uint8Array {
  const d = new Uint8Array(165);
  putKey(d, {offset: 0}, o.mint);
  putKey(d, {offset: 32}, o.owner ?? MAINNET_SOL_TREASURY);
  putU64(d, {offset: 64}, o.amount ?? 0n);
  d[108] = o.state ?? 1;
  return d;
}

const program = (data: Uint8Array): AccountData => ({lamports: 3_466_080n, owner: MAINNET_PROGRAM_ID, data});
const TREASURY: AccountData = {lamports: 48_288_800_000n, owner: SYSTEM_PROGRAM_ID, data: new Uint8Array(0)};
const vault = (o: {mint: string; owner?: string; amount?: bigint; state?: number}, programId = SPL_TOKEN_PROGRAM): AccountData => ({
  lamports: 1_488_440n,
  owner: programId,
  data: tokenAccountData(o),
});

interface Chain {
  config: AccountData | null;
  user: AccountData | null;
  allocation: AccountData | null;
  treasury: AccountData | null;
  usdc: AccountData | null;
  usdt: AccountData | null;
}
const CHAIN: Chain = {
  config: program(configData()),
  user: null,
  allocation: null,
  treasury: TREASURY,
  usdc: vault({mint: MAINNET_USDC_MINT, amount: 172_099_207n}),
  usdt: vault({mint: MAINNET_USDT_MINT, amount: 0n}),
};

// The chain answers by address — the spec's literals (§2.1), whole — so a reader that asks for the wrong account gets
// that account's bytes, not the slot it expected.
const CONFIG_PDA = '8MwasPrRzsCDuH78PJSDdWhdjFXT15MX7pHs3iE4b7Gx';
const TREASURY_ADDRESS = '6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd';
const USDC_VAULT = 'DNMn9dt7sqLoKZ27ms2U7kyBJPJUL9dvtqgTavVNDGW3';
const USDT_VAULT = '8mk9WSfsioRXUv2VtMjMmbGC3baXqTs4CZqseD8cvsRp';

async function read(o: Partial<Chain> = {}): Promise<{state: PresaleState; calls: string[][]}> {
  const c = {...CHAIN, ...o};
  const pdas = derivePresalePdas(new PublicKey(ACCOUNT));
  const chain = new Map<string, AccountData | null>([
    [CONFIG_PDA, c.config],
    [pdas.userAccount.toBase58(), c.user],
    [pdas.userAllocation.toBase58(), c.allocation],
    [TREASURY_ADDRESS, c.treasury],
    [USDC_VAULT, c.usdc],
    [USDT_VAULT, c.usdt],
  ]);
  const calls: string[][] = [];
  const reader = fakeReader({
    getAccountsData: async addresses => {
      calls.push([...addresses]);
      return addresses.map(a => {
        const account = chain.get(a);
        if (account === undefined) throw new Error(`unexpected address ${a}`);
        return account;
      });
    },
  });
  return {state: await readPresaleState(reader, ACCOUNT, NOW_MS), calls};
}
const stateOf = async (o: Partial<Chain> = {}) => (await read(o)).state;
const openSnapshot = async (o: Partial<Chain> = {}): Promise<PresaleSnapshot> => {
  const s = await stateOf(o);
  if (s.kind !== 'open') throw new Error(`not open: ${JSON.stringify(s, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v))}`);
  return s.snapshot;
};
const MALFORMED = {kind: 'unavailable', code: 'malformed'};

describe('readPresaleState — the valid read (positive control)', () => {
  it('opens, with every derived value from the program’s numbers', async () => {
    expect(await openSnapshot()).toEqual({
      stage: {stage: 0, priceTicks: 1501n, nextPriceTicks: 1723n, stageSoldBase: 1_312_240_123_017_711n, stageCapBase: 10_240_000_000_000_000n, raisedCents: 19_696_720n},
      limits: {minCents: 1_000n, maxTxCents: 5_000_000n, userRemainingCents: 20_000_000n, firstPurchase: true},
      allocation: {exists: false, totalBase: 0n, bonusBase: 0n, spentCents: 0n, purchaseCount: 0, referrer: null},
      userAccountExists: false,
      newPdaRent: 1_294_560n + 1_705_200n,
      treasuryLamports: 48_288_800_000n,
      vaults: {USDC: {address: MAINNET_VAULT_USDC_ATA, amount: 172_099_207n}, USDT: {address: MAINNET_VAULT_USDT_ATA, amount: 0n}},
    });
  });

  it('one getAccountsData for the six accounts, in order: config, user, allocation, treasury, the two vault ATAs', async () => {
    const {calls} = await read();
    const pdas = derivePresalePdas(new PublicKey(ACCOUNT));
    expect(calls).toEqual([[CONFIG_PDA, pdas.userAccount.toBase58(), pdas.userAllocation.toBase58(), TREASURY_ADDRESS, USDC_VAULT, USDT_VAULT]]);
    expect([pdas.config.toBase58(), MAINNET_SOL_TREASURY, MAINNET_VAULT_USDC_ATA, MAINNET_VAULT_USDT_ATA]).toEqual([CONFIG_PDA, TREASURY_ADDRESS, USDC_VAULT, USDT_VAULT]);
  });

  it('the builder’s config is one core’s hand-written reader accepts (two derivations of the layout agree)', () => {
    expect(readSolTreasury(configData()).toBase58()).toBe(MAINNET_SOL_TREASURY);
  });

  it('an existing allocation and user account: the totals, the remainder, the referrer, no new-PDA rent', async () => {
    const s = await openSnapshot({user: program(userData()), allocation: program(allocationData({spent: 300_000n, referrer: REFERRER}))});
    expect(s.allocation).toEqual({exists: true, totalBase: 1_998_667_554_963n, bonusBase: 16_142_571_618n, spentCents: 300_000n, purchaseCount: 2, referrer: REFERRER});
    expect(s.limits).toEqual({minCents: 1_000n, maxTxCents: 5_000_000n, userRemainingCents: 19_700_000n, firstPurchase: false});
    expect([s.userAccountExists, s.newPdaRent]).toEqual([true, 0n]);
  });

  it('firstPurchase (C21): absent, or purchase_count 0 — not 1; newPdaRent counts each absent PDA', async () => {
    expect((await openSnapshot({allocation: program(allocationData({count: 0}))})).limits.firstPurchase).toBe(true);
    expect((await openSnapshot({allocation: program(allocationData({count: 1}))})).limits.firstPurchase).toBe(false);
    expect((await openSnapshot({allocation: program(allocationData({count: 0x0100_0000}))})).allocation.purchaseCount).toBe(16_777_216);
    expect((await openSnapshot({allocation: program(allocationData({count: 0x8000_0001}))})).allocation.purchaseCount).toBe(2_147_483_649);
    expect((await openSnapshot({user: program(userData())})).newPdaRent).toBe(1_705_200n);
    expect((await openSnapshot({allocation: program(allocationData())})).newPdaRent).toBe(1_294_560n);
  });

  it('the config’s limits are read (min_purchase_usd, max_per_user_usd), the program’s fallbacks for 0', async () => {
    const s = await openSnapshot({config: program(configData({minPurchase: 0n, maxPerUser: 4_000_000n}))});
    expect([s.limits.minCents, s.limits.maxTxCents]).toEqual([2_500n, 4_000_000n]);
  });

  it('stage 9: price 3499, no next price; claimed = 1 is a readable allocation', async () => {
    const s = await openSnapshot({config: program(configData({stage: 9})), allocation: program(allocationData({claimed: 1}))});
    expect([s.stage.stage, s.stage.priceTicks, s.stage.nextPriceTicks]).toEqual([9, 3499n, null]);
  });

  it('boundaries that stay open: start time = now, tokens_sold one below the hard cap, stage_tokens_sold one below a stage', async () => {
    expect((await stateOf({config: program(configData({start: NOW_S}))})).kind).toBe('open');
    expect((await stateOf({config: program(configData({tokensSold: PRESALE_HARD_CAP_BASE - 1n}))})).kind).toBe('open');
    expect((await stateOf({config: program(configData({stageSold: TOKENS_PER_STAGE_BASE - 1n}))})).kind).toBe('open');
  });

  it('referrerAllocationOf (C7): the on-chain referrer’s allocation PDA, or the default key’s', async () => {
    const withRef = await referrerAllocationOf(await openSnapshot({allocation: program(allocationData({referrer: REFERRER}))}), ACCOUNT);
    expect(withRef.referrerAllocation.toBase58()).toBe(derivePresalePdas(new PublicKey(REFERRER)).userAllocation.toBase58());
    expect([withRef.effectiveReferrerAddress, withRef.registerReferrer]).toEqual([REFERRER, null]);
    const none = await referrerAllocationOf(await openSnapshot(), ACCOUNT);
    expect(none.referrerAllocation.toBase58()).toBe('C6TE5HwdPxJhUcAdwt6DRr2ceoavWBPqfCqcyFVFAWkQ');
    expect(none.effectiveReferrerAddress).toBeNull();
  });

  it('an existing allocation whose referrer@84 is all zero has no referrer (§2.1 rule 6, review 1 M3): null, and the default key’s PDA', async () => {
    const zero = await openSnapshot({allocation: program(allocationData({referrer: null}))});
    expect(zero.allocation).toMatchObject({exists: true, referrer: null});
    const r = await referrerAllocationOf(zero, ACCOUNT);
    expect(r.referrerAllocation.toBase58()).toBe('C6TE5HwdPxJhUcAdwt6DRr2ceoavWBPqfCqcyFVFAWkQ');
    expect(r.effectiveReferrerAddress).toBeNull();
  });
});

describe('readPresaleState — closed, a valid read of a closed sale (rule 4, rule 5)', () => {
  const stage0 = {stage: 0, priceTicks: 1501n, nextPriceTicks: 1723n, stageSoldBase: 1_312_240_123_017_711n, stageCapBase: TOKENS_PER_STAGE_BASE, raisedCents: 19_696_720n};

  it.each([
    ['presale_active = 0', {active: 0}],
    ['the start time one second ahead', {start: NOW_S + 1n}],
    ['tokens_sold at the hard cap', {tokensSold: PRESALE_HARD_CAP_BASE}],
  ])('inactive: %s', async (_name, o) => {
    expect(await stateOf({config: program(configData(o))})).toEqual({kind: 'inactive', stage: stage0});
  });

  it('the inactive test comes first (review 2 L9): a stage total at the cap is malformed only while active', async () => {
    expect(await stateOf({config: program(configData({stageSold: TOKENS_PER_STAGE_BASE}))})).toEqual(MALFORMED);
    expect(await stateOf({config: program(configData({stageSold: TOKENS_PER_STAGE_BASE, tokensSold: PRESALE_HARD_CAP_BASE, stage: 9}))})).toEqual({
      kind: 'inactive',
      stage: {...stage0, stage: 9, priceTicks: 3499n, nextPriceTicks: null, stageSoldBase: TOKENS_PER_STAGE_BASE},
    });
  });

  it('blocked: is_blocked = 1 (Q14); is_blocked = 0 opens; an inactive sale says inactive whoever asks', async () => {
    expect(await stateOf({user: program(userData({blocked: 1}))})).toEqual({kind: 'blocked', stage: stage0});
    expect((await stateOf({user: program(userData({blocked: 0}))})).kind).toBe('open');
    expect((await stateOf({config: program(configData({active: 0})), user: program(userData({blocked: 1}))})).kind).toBe('inactive');
  });
});

describe('readPresaleState — every rule refuses on its own (never open on doubt)', () => {
  const wrongOwner = (a: AccountData | null): AccountData => ({...(a as AccountData), owner: OTHER});

  it.each<[string, Partial<Chain>]>([
    // 1. config
    ['config absent', {config: null}],
    ['config not the program’s', {config: wrongOwner(program(configData()))}],
    ['config 369 bytes', {config: program(configData({length: 369}))}],
    ['config 371 bytes', {config: program(configData({length: 371}))}],
    ['config with PresaleAllocation’s discriminator', {config: program(configData({discriminator: PRESALE_ALLOCATION_LAYOUT.discriminator}))}],
    ['admin@8 moved', {config: program(configData({admin: OTHER}))}],
    ['sale_token@40 moved', {config: program(configData({saleToken: OTHER}))}],
    // 2. C5's pins
    ['sol_treasury changed', {config: program(configData({treasury: MAINNET_ADMIN_ADDRESS}))}],
    [
      'sol_treasury changed, the vault ATAs claiming the new owner (the pin alone catches it)',
      {
        config: program(configData({treasury: MAINNET_ADMIN_ADDRESS})),
        usdc: vault({mint: MAINNET_USDC_MINT, owner: MAINNET_ADMIN_ADDRESS}),
        usdt: vault({mint: MAINNET_USDT_MINT, owner: MAINNET_ADMIN_ADDRESS}),
      },
    ],
    ['usdc_address changed', {config: program(configData({usdc: OTHER}))}],
    ['usdt_address changed', {config: program(configData({usdt: OTHER}))}],
    ['the two stablecoin mints swapped', {config: program(configData({usdc: MAINNET_USDT_MINT, usdt: MAINNET_USDC_MINT}))}],
    // 3. a Borsh bool and a known stage
    ['presale_active = 2', {config: program(configData({active: 2}))}],
    ['stage 10', {config: program(configData({stage: 10}))}],
    ['stage 255', {config: program(configData({stage: 255}))}],
    // 5. the user account
    ['user account not the program’s', {user: wrongOwner(program(userData()))}],
    ['user account 57 bytes', {user: program(userData({length: 57}))}],
    ['user account 59 bytes', {user: program(userData({length: 59}))}],
    ['user account with Config’s discriminator', {user: program(userData({discriminator: CONFIG_LAYOUT.discriminator}))}],
    ['is_blocked = 2', {user: program(userData({blocked: 2}))}],
    // 6. the allocation
    ['allocation not the program’s', {allocation: wrongOwner(program(allocationData()))}],
    ['allocation 116 bytes', {allocation: program(allocationData({length: 116}))}],
    ['allocation 118 bytes', {allocation: program(allocationData({length: 118}))}],
    ['allocation with UserAccount’s discriminator', {allocation: program(allocationData({discriminator: USER_ACCOUNT_LAYOUT.discriminator}))}],
    ['allocation user@8 foreign', {allocation: program(allocationData({user: OTHER}))}],
    ['claimed = 2', {allocation: program(allocationData({claimed: 2}))}],
    // 7. the treasury
    ['treasury absent', {treasury: null}],
    ['treasury not System-owned', {treasury: {...TREASURY, owner: SPL_TOKEN_PROGRAM}}],
    ['treasury holding data', {treasury: {...TREASURY, data: new Uint8Array(1)}}],
    // 8. the vault ATAs
    ['USDC vault absent', {usdc: null}],
    ['USDT vault absent', {usdt: null}],
    ['USDC vault of the wrong mint', {usdc: vault({mint: MAINNET_USDT_MINT})}],
    ['USDT vault of the wrong mint', {usdt: vault({mint: MAINNET_USDC_MINT})}],
    ['USDC vault owned by someone else', {usdc: vault({mint: MAINNET_USDC_MINT, owner: MAINNET_ADMIN_ADDRESS})}],
    ['USDT vault owned by someone else', {usdt: vault({mint: MAINNET_USDT_MINT, owner: MAINNET_ADMIN_ADDRESS})}],
    ['USDC vault uninitialised', {usdc: vault({mint: MAINNET_USDC_MINT, state: 0})}],
    ['USDT vault uninitialised', {usdt: vault({mint: MAINNET_USDT_MINT, state: 0})}],
    ['USDC vault frozen', {usdc: vault({mint: MAINNET_USDC_MINT, state: 2})}],
    ['USDC vault under Token-2022', {usdc: vault({mint: MAINNET_USDC_MINT}, TOKEN_2022)}],
  ])('%s → unavailable (malformed)', async (_name, o) => {
    expect(await stateOf(o)).toEqual(MALFORMED);
  });

  // Every structural rule before any verdict (review 1 M3): a closed sale whose accounts break a rule is malformed, not
  // inactive or blocked (the valid closed reads are the positive controls above).
  const inactive = program(configData({active: 0}));
  const blocked = program(userData({blocked: 1}));
  it.each<[string, Partial<Chain>]>([
    ['inactive, the user account not the program’s (rule 5)', {config: inactive, user: wrongOwner(program(userData()))}],
    ['inactive, the allocation foreign (rule 6)', {config: inactive, allocation: program(allocationData({user: OTHER}))}],
    ['inactive, the treasury absent (rule 7)', {config: inactive, treasury: null}],
    ['inactive, the treasury holding data (rule 7)', {config: inactive, treasury: {...TREASURY, data: new Uint8Array(1)}}],
    ['inactive, the USDC vault absent (rule 8)', {config: inactive, usdc: null}],
    ['inactive, the USDT vault owned by someone else (rule 8)', {config: inactive, usdt: vault({mint: MAINNET_USDT_MINT, owner: MAINNET_ADMIN_ADDRESS})}],
    ['blocked, the allocation claimed = 2 (rule 6)', {user: blocked, allocation: program(allocationData({claimed: 2}))}],
    ['blocked, the treasury absent (rule 7)', {user: blocked, treasury: null}],
    ['blocked, the USDC vault absent (rule 8)', {user: blocked, usdc: null}],
  ])('%s → unavailable (malformed)', async (_name, o) => {
    expect(await stateOf(o)).toEqual(MALFORMED);
  });

  it('a reply of the wrong length is malformed — one short, or one extra', async () => {
    const six = [CHAIN.config, CHAIN.user, CHAIN.allocation, CHAIN.treasury, CHAIN.usdc, CHAIN.usdt];
    for (const reply of [six.slice(0, 5), [...six, null]]) {
      expect(await readPresaleState(fakeReader({getAccountsData: async () => reply}), ACCOUNT, NOW_MS)).toEqual(MALFORMED);
    }
  });

  it.each<[string, Error, string]>([
    ['a 403', new RpcForbidden('getMultipleAccounts'), 'refused'],
    ['the latch’s cool-down', new RpcCoolingDown('getMultipleAccounts'), 'refused'],
    ['a timeout', new RequestTimedOut('https://api.noc-tura.io/api/v1/rpc', 20_000), 'read-failed'],
    ['no answer', new RequestUnreachable('rpc', 'offline'), 'read-failed'],
    ['an HTTP 500', new RpcHttpError('rpc', 500), 'read-failed'],
    ['an RPC error', new RpcResponseError(-32005, 'node is behind'), 'read-failed'],
    ['a malformed RPC answer', new RpcMalformed('getMultipleAccounts'), 'read-failed'],
  ])('%s → unavailable (%s)', async (_name, error, code) => {
    const reader = fakeReader({
      getAccountsData: async () => {
        throw error;
      },
    });
    expect(await readPresaleState(reader, ACCOUNT, NOW_MS)).toEqual({kind: 'unavailable', code});
  });
});
