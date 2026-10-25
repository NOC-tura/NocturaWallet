import {PublicKey} from '@solana/web3.js';
import {CONFIG_LAYOUT, PRESALE_ALLOCATION_LAYOUT, USER_ACCOUNT_LAYOUT} from '../layouts';
import {fakeReader} from '../../__tests__/fakeDeps';
import {ACCOUNT as SESSION_ACCOUNT, HOLDING_SMALL, RECIPIENT} from '../../__tests__/fixtures';
import {MAINNET_ADMIN_ADDRESS, MAINNET_NOC_MINT, MAINNET_PROGRAM_ID, MAINNET_SOL_TREASURY, MAINNET_USDC_MINT, MAINNET_USDT_MINT} from '../../../../../core/presale/addresses';
import {derivePresalePdas} from '../../../../../core/presale/allocation';
import {SPL_TOKEN_PROGRAM} from '../../../../../core/solana/encoding';
import {SYSTEM_PROGRAM_ID, type AccountData, type SolanaReader} from '../../../../../core/solana/rpc';

// B1d §2.1: the presale's accounts as byte builders — the valid chain and one change at a time from it (never a
// hand-typed blob). Moved from state.test.ts (B1d-1b Task 1) so the state, the view and the purchase share one chain.
export const ACCOUNT = SESSION_ACCOUNT.publicKey;
export const REFERRER = RECIPIENT;
export const OTHER = HOLDING_SMALL;
export const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
export const NOW_MS = 1_760_000_000_000;
export const NOW_S = 1_760_000_000n;

export type Field = {offset: number};
export const putKey = (d: Uint8Array, f: Field, address: string) => d.set(new PublicKey(address).toBytes(), f.offset);
export const putU64 = (d: Uint8Array, f: Field, v: bigint) => {
  let x = BigInt.asUintN(64, v);
  for (let i = 0; i < 8; i++) {
    d[f.offset + i] = Number(x & 0xffn);
    x >>= 8n;
  }
};
export const putU32 = (d: Uint8Array, f: Field, v: number) => {
  for (let i = 0; i < 4; i++) d[f.offset + i] = (v >>> (8 * i)) & 0xff;
};

export interface ConfigBytes {
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
export const CONFIG: ConfigBytes = {
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
export function configData(o: Partial<ConfigBytes> = {}): Uint8Array {
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

export interface UserBytes {
  length: number;
  discriminator: readonly number[];
  blocked: number;
}
export function userData(o: Partial<UserBytes> = {}): Uint8Array {
  const u = {length: USER_ACCOUNT_LAYOUT.length, discriminator: USER_ACCOUNT_LAYOUT.discriminator, blocked: 0, ...o};
  const d = new Uint8Array(Math.max(u.length, USER_ACCOUNT_LAYOUT.length));
  d.set(u.discriminator, 0);
  d[USER_ACCOUNT_LAYOUT.fields.is_blocked.offset] = u.blocked;
  return d.subarray(0, u.length);
}

export interface AllocationBytes {
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
export function allocationData(o: Partial<AllocationBytes> = {}): Uint8Array {
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
export function tokenAccountData(o: {mint: string; owner?: string; amount?: bigint; state?: number}): Uint8Array {
  const d = new Uint8Array(165);
  putKey(d, {offset: 0}, o.mint);
  putKey(d, {offset: 32}, o.owner ?? MAINNET_SOL_TREASURY);
  putU64(d, {offset: 64}, o.amount ?? 0n);
  d[108] = o.state ?? 1;
  return d;
}

export const program = (data: Uint8Array): AccountData => ({lamports: 3_466_080n, owner: MAINNET_PROGRAM_ID, data});
export const TREASURY: AccountData = {lamports: 48_288_800_000n, owner: SYSTEM_PROGRAM_ID, data: new Uint8Array(0)};
export const vault = (o: {mint: string; owner?: string; amount?: bigint; state?: number}, programId = SPL_TOKEN_PROGRAM): AccountData => ({
  lamports: 1_488_440n,
  owner: programId,
  data: tokenAccountData(o),
});

export interface Chain {
  config: AccountData | null;
  user: AccountData | null;
  allocation: AccountData | null;
  treasury: AccountData | null;
  usdc: AccountData | null;
  usdt: AccountData | null;
}
export const CHAIN: Chain = {
  config: program(configData()),
  user: null,
  allocation: null,
  treasury: TREASURY,
  usdc: vault({mint: MAINNET_USDC_MINT, amount: 172_099_207n}),
  usdt: vault({mint: MAINNET_USDT_MINT, amount: 0n}),
};

// The chain answers by address — the spec's literals (§2.1), whole — so a reader that asks for the wrong account gets
// that account's bytes, not the slot it expected.
export const CONFIG_PDA = '8MwasPrRzsCDuH78PJSDdWhdjFXT15MX7pHs3iE4b7Gx';
export const TREASURY_ADDRESS = '6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd';
export const USDC_VAULT = 'DNMn9dt7sqLoKZ27ms2U7kyBJPJUL9dvtqgTavVNDGW3';
export const USDT_VAULT = '8mk9WSfsioRXUv2VtMjMmbGC3baXqTs4CZqseD8cvsRp';

/** The chain's six accounts by address — the spec's literals, whole — with `o` replacing any of them. */
export function chainMap(o: Partial<Chain> = {}): Map<string, AccountData | null> {
  const c = {...CHAIN, ...o};
  const pdas = derivePresalePdas(new PublicKey(ACCOUNT));
  return new Map<string, AccountData | null>([
    [CONFIG_PDA, c.config],
    [pdas.userAccount.toBase58(), c.user],
    [pdas.userAllocation.toBase58(), c.allocation],
    [TREASURY_ADDRESS, c.treasury],
    [USDC_VAULT, c.usdc],
    [USDT_VAULT, c.usdt],
  ]);
}

/** The slot the chain answers getAccountsDataAt at (B1d-1b Task 2) — below fixtures' SIMULATED_SLOT, as a live read is. */
export const SNAPSHOT_SLOT = 271_408_900;

/**
 * A reader whose getAccountsData answers from `chain` by address (an address it does not hold throws); each call's
 * addresses are pushed to `calls`. getAccountsDataAt is the same read at SNAPSHOT_SLOT unless overridden.
 */
export function chainReader(chain: Map<string, AccountData | null>, calls: string[][] = [], overrides: Partial<SolanaReader> = {}): SolanaReader {
  const reader = fakeReader({
    getAccountsData: async addresses => {
      calls.push([...addresses]);
      return addresses.map(a => {
        const account = chain.get(a);
        if (account === undefined) throw new Error(`unexpected address ${a}`);
        return account;
      });
    },
    ...overrides,
  });
  return {...reader, getAccountsDataAt: overrides.getAccountsDataAt ?? (async addresses => ({slot: SNAPSHOT_SLOT, accounts: await reader.getAccountsData(addresses)}))};
}
