import {PublicKey} from '@solana/web3.js';
import {readPresaleConfig, readPresaleState, referrerAllocationOf, type PresaleSnapshot, type PresaleState} from '../state';
import {CONFIG_LAYOUT, PRESALE_ALLOCATION_LAYOUT, USER_ACCOUNT_LAYOUT} from '../layouts';
import {fakeReader} from '../../__tests__/fakeDeps';
import {MAINNET_ADMIN_ADDRESS, MAINNET_SOL_TREASURY, MAINNET_USDC_MINT, MAINNET_USDT_MINT, MAINNET_VAULT_USDC_ATA, MAINNET_VAULT_USDT_ATA} from '../../../../../core/presale/addresses';
import {derivePresalePdas, readSolTreasury} from '../../../../../core/presale/allocation';
import {PRESALE_HARD_CAP_BASE, TOKENS_PER_STAGE_BASE} from '../../../../../core/presale/limits';
import {SPL_TOKEN_PROGRAM} from '../../../../../core/solana/encoding';
import {RequestUnreachable, RpcCoolingDown, RpcForbidden, RpcHttpError, RpcMalformed, RpcResponseError, type AccountData} from '../../../../../core/solana/rpc';
import {
  ACCOUNT,
  CHAIN,
  CONFIG_PDA,
  NOW_MS,
  NOW_S,
  OTHER,
  REFERRER,
  TOKEN_2022,
  TREASURY,
  TREASURY_ADDRESS,
  USDC_VAULT,
  USDT_VAULT,
  allocationData,
  chainMap,
  chainReader,
  configData,
  program,
  userData,
  vault,
  type Chain,
} from './chain';
import {RequestTimedOut} from '../../deps';

// B1d §2.1, §6.1 "State (1a)": the presale opens only on a read where every rule holds; one refusal per rule, each a
// byte builder's single change from the valid fixture (never a hand-typed blob).

async function read(o: Partial<Chain> = {}): Promise<{state: PresaleState; calls: string[][]}> {
  const calls: string[][] = [];
  return {state: await readPresaleState(chainReader(chainMap(o), calls), ACCOUNT, NOW_MS), calls};
}
const stateOf = async (o: Partial<Chain> = {}) => (await read(o)).state;
const openSnapshot = async (o: Partial<Chain> = {}): Promise<PresaleSnapshot> => {
  const s = await stateOf(o);
  if (s.kind !== 'open') throw new Error(`not open: ${JSON.stringify(s, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v))}`);
  return s.snapshot;
};
const MALFORMED = {kind: 'unavailable', code: 'malformed'};
/** The discriminator with byte `k` flipped — one byte from the right one (review I1). */
const flipped = (d: readonly number[], k: number): number[] => d.map((b, i) => (i === k ? b ^ 1 : b));
// The rent-exempt minimums mainnet charges today (getMinimumBalanceForRentExemption, 5 080 lamports per byte: (128 +
// length) × 5 080): the snapshot's newPdaRent is an UPPER BOUND at the old rate, never below these (review I2).
const MEASURED_USER_ACCOUNT_RENT = 944_880n;
const MEASURED_ALLOCATION_RENT = 1_244_600n;

describe('readPresaleState — the valid read (positive control)', () => {
  it('opens, with every derived value from the program’s numbers', async () => {
    expect(await openSnapshot()).toEqual({
      stage: {stage: 0, priceTicks: 1501n, nextPriceTicks: 1723n, stageSoldBase: 1_312_240_123_017_711n, stageCapBase: 10_240_000_000_000_000n, raisedCents: 19_696_720n},
      limits: {minCents: 1_000n, maxTxCents: 5_000_000n, userRemainingCents: 20_000_000n, firstPurchase: true},
      allocation: {exists: false, totalBase: 0n, bonusBase: 0n, spentCents: 0n, purchaseCount: 0, referrer: null},
      userAccountExists: false,
      newPdaRent: 1_294_560n + 1_705_200n, // an upper bound — see the row below
      treasuryLamports: 48_288_800_000n,
      vaults: {USDC: {address: MAINNET_VAULT_USDC_ATA, amount: 172_099_207n}, USDT: {address: MAINNET_VAULT_USDT_ATA, amount: 0n}},
    });
  });

  it('newPdaRent is an upper bound (the old rate), never below what mainnet charges for the absent PDAs (review I2)', async () => {
    expect((await openSnapshot()).newPdaRent >= MEASURED_USER_ACCOUNT_RENT + MEASURED_ALLOCATION_RENT).toBe(true);
    expect((await openSnapshot({user: program(userData())})).newPdaRent >= MEASURED_ALLOCATION_RENT).toBe(true);
    expect((await openSnapshot({allocation: program(allocationData())})).newPdaRent >= MEASURED_USER_ACCOUNT_RENT).toBe(true);
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
    ['config’s discriminator but its last byte', {config: program(configData({discriminator: flipped(CONFIG_LAYOUT.discriminator, 7)}))}],
    ['config’s discriminator but its first byte', {config: program(configData({discriminator: flipped(CONFIG_LAYOUT.discriminator, 0)}))}],
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
    ['user account’s discriminator but its last byte', {user: program(userData({discriminator: flipped(USER_ACCOUNT_LAYOUT.discriminator, 7)}))}],
    ['user account’s discriminator but its first byte', {user: program(userData({discriminator: flipped(USER_ACCOUNT_LAYOUT.discriminator, 0)}))}],
    ['is_blocked = 2', {user: program(userData({blocked: 2}))}],
    // 6. the allocation
    ['allocation not the program’s', {allocation: wrongOwner(program(allocationData()))}],
    ['allocation 116 bytes', {allocation: program(allocationData({length: 116}))}],
    ['allocation 118 bytes', {allocation: program(allocationData({length: 118}))}],
    ['allocation with UserAccount’s discriminator', {allocation: program(allocationData({discriminator: USER_ACCOUNT_LAYOUT.discriminator}))}],
    ['allocation’s discriminator but its last byte', {allocation: program(allocationData({discriminator: flipped(PRESALE_ALLOCATION_LAYOUT.discriminator, 7)}))}],
    ['allocation’s discriminator but its first byte', {allocation: program(allocationData({discriminator: flipped(PRESALE_ALLOCATION_LAYOUT.discriminator, 0)}))}],
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

  it('an account that is not a key is malformed, never an exception out of the reader — and nothing is read (fail closed)', async () => {
    for (const account of ['', 'not a key', '0OIl', 'abc', `${ACCOUNT}1`]) {
      const calls: string[][] = [];
      const reader = fakeReader({
        getAccountsData: async addresses => {
          calls.push([...addresses]);
          return addresses.map(() => null);
        },
      });
      await expect(readPresaleState(reader, account, NOW_MS)).resolves.toEqual(MALFORMED);
      expect([account, calls]).toEqual([account, []]);
    }
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

// B1d-1b Task 1: presale.banner's config-only read (§1.4: "§2.1 rules 1–4") — the same rules as readPresaleState's, on
// the config account alone.
describe('readPresaleConfig — rules 1–4 on the config account alone', () => {
  const readConfig = async (config: AccountData | null, nowMs = NOW_MS) => {
    const calls: string[][] = [];
    return {state: await readPresaleConfig(chainReader(chainMap({config}), calls), nowMs), calls};
  };
  const STAGE_FACTS = {stage: 0, priceTicks: 1501n, nextPriceTicks: 1723n, stageSoldBase: 1_312_240_123_017_711n, stageCapBase: TOKENS_PER_STAGE_BASE, raisedCents: 19_696_720n};

  it('active, with the stage facts; one getAccountsData of the config PDA alone (positive control)', async () => {
    expect(await readConfig(CHAIN.config)).toEqual({state: {kind: 'active', stage: STAGE_FACTS}, calls: [[CONFIG_PDA]]});
  });

  it.each<[string, AccountData | null]>([
    ['absent', null],
    ['not the program’s', {...program(configData()), owner: OTHER}],
    ['369 bytes', program(configData({length: 369}))],
    ['371 bytes', program(configData({length: 371}))],
    ['a wrong discriminator', program(configData({discriminator: flipped(CONFIG_LAYOUT.discriminator, 7)}))],
    ['admin@8 moved', program(configData({admin: OTHER}))],
    ['sale_token@40 moved', program(configData({saleToken: OTHER}))],
    ['sol_treasury changed', program(configData({treasury: OTHER}))],
    ['usdc_address changed', program(configData({usdc: OTHER}))],
    ['usdt_address changed', program(configData({usdt: OTHER}))],
    ['presale_active = 2', program(configData({active: 2}))],
    ['stage 10', program(configData({stage: 10}))],
    ['stage_tokens_sold at a stage’s size while active', program(configData({stageSold: TOKENS_PER_STAGE_BASE}))],
  ])('%s → malformed', async (_name, config) => {
    expect((await readConfig(config)).state).toEqual(MALFORMED);
  });

  it.each<[string, AccountData]>([
    ['presale_active = 0', program(configData({active: 0}))],
    ['the start time one second ahead', program(configData({start: NOW_S + 1n}))],
    ['tokens_sold at the hard cap', program(configData({tokensSold: PRESALE_HARD_CAP_BASE}))],
    ['the hard cap with the stage total at the cap (the inactive test first)', program(configData({tokensSold: PRESALE_HARD_CAP_BASE, stage: 9, stageSold: TOKENS_PER_STAGE_BASE}))],
  ])('%s → inactive, with the stage', async (_name, config) => {
    expect((await readConfig(config)).state).toMatchObject({kind: 'inactive', stage: {priceTicks: expect.any(BigInt)}});
  });

  it('a reply of the wrong length is malformed', async () => {
    for (const reply of [[], [CHAIN.config, null]]) expect(await readPresaleConfig(fakeReader({getAccountsData: async () => reply}), NOW_MS)).toEqual(MALFORMED);
  });

  it.each<[string, Error, string]>([
    ['a 403', new RpcForbidden('getMultipleAccounts'), 'refused'],
    ['the latch’s cool-down', new RpcCoolingDown('getMultipleAccounts'), 'refused'],
    ['no answer', new RequestUnreachable('rpc', 'offline'), 'read-failed'],
    ['a malformed RPC answer', new RpcMalformed('getMultipleAccounts'), 'read-failed'],
  ])('%s → unavailable (%s)', async (_name, error, code) => {
    expect(await readPresaleConfig(fakeReader({getAccountsData: async () => Promise.reject(error)}), NOW_MS)).toEqual({kind: 'unavailable', code});
  });
});
