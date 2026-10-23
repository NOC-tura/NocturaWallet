import {PublicKey} from '@solana/web3.js';
import {base58} from '@scure/base';
import {
  MAINNET_ADMIN_ADDRESS,
  MAINNET_NOC_MINT,
  MAINNET_PROGRAM_ID,
  MAINNET_SOL_TREASURY,
  MAINNET_USDC_MINT,
  MAINNET_USDT_MINT,
  MAINNET_VAULT_USDC_ATA,
  MAINNET_VAULT_USDT_ATA,
} from '../../../../core/presale/addresses';
import {derivePresalePdas, readU64LE} from '../../../../core/presale/allocation';
import {
  PRESALE_ALLOCATION_RENT_LAMPORTS,
  PRESALE_HARD_CAP_BASE,
  PRESALE_USER_ACCOUNT_RENT_LAMPORTS,
  STAGE_PRICE_TICKS,
  TOKENS_PER_STAGE_BASE,
  purchaseLimits,
  type PurchaseLimits,
} from '../../../../core/presale/limits';
import {resolveReferrerWith, type AllocationRef, type ResolvedReferrer} from '../../../../core/presale/referrer';
import {RpcForbidden, SYSTEM_PROGRAM_ID, type AccountData, type SolanaReader} from '../../../../core/solana/rpc';
import {tokenAccountInfo} from '../dapp/tokenState';
import {CONFIG_LAYOUT, PRESALE_ALLOCATION_LAYOUT, USER_ACCOUNT_LAYOUT} from './layouts';

/**
 * B1d §2.1 (D4, C5, C6, C21, C28): the presale's state, read from the chain — the config account and the account's two
 * PDAs, parsed with the layouts generated from the pinned IDL, plus the three pinned destinations, all in ONE
 * `getAccountsData` through the proxy. The presale is open only when every rule below holds; anything else is closed,
 * and a failed or doubtful read is `unavailable`, never open.
 */
export type UnavailableCode = 'read-failed' | 'refused' | 'malformed';

/** The stage as the program holds it (`current_stage`, 0-indexed) and what it costs. Amounts as bigint. */
export interface StageFacts {
  stage: number;
  priceTicks: bigint;
  nextPriceTicks: bigint | null;
  stageSoldBase: bigint;
  stageCapBase: bigint;
  raisedCents: bigint;
}

export interface AllocationFacts {
  exists: boolean;
  totalBase: bigint;
  bonusBase: bigint;
  spentCents: bigint;
  purchaseCount: number;
  /** The referrer registered on chain, or null (absent, or 32 zero bytes). */
  referrer: string | null;
}

export interface PresaleSnapshot {
  stage: StageFacts;
  limits: PurchaseLimits & {firstPurchase: boolean};
  allocation: AllocationFacts;
  userAccountExists: boolean;
  /**
   * An UPPER BOUND, never the exact value, on the rent of the PDAs a purchase now would create (`init_if_needed`): the
   * user account and the allocation, each if absent, at core's old-rate constants (mainnet charges less; limits.ts).
   * Never use it for an exact outflow check.
   */
  newPdaRent: bigint;
  /** C28's "before" of each destination, from this same read. */
  treasuryLamports: bigint;
  vaults: {USDC: {address: string; amount: bigint}; USDT: {address: string; amount: bigint}};
}

export type PresaleState =
  | {kind: 'unavailable'; code: UnavailableCode}
  | {kind: 'inactive' | 'blocked'; stage: StageFacts}
  | {kind: 'open'; snapshot: PresaleSnapshot};

type Field = {readonly offset: number};

const pubkeyAt = (data: Uint8Array, f: Field): string => base58.encode(data.subarray(f.offset, f.offset + 32));
const u64At = (data: Uint8Array, f: Field): bigint => readU64LE(data, f.offset);
const i64At = (data: Uint8Array, f: Field): bigint => BigInt.asIntN(64, readU64LE(data, f.offset));
// `* 2 ** 24`, not `<< 24`: the high byte never flips the sign.
const u32At = (data: Uint8Array, f: Field): number =>
  ((data[f.offset] as number) | ((data[f.offset + 1] as number) << 8) | ((data[f.offset + 2] as number) << 16)) + (data[f.offset + 3] as number) * 2 ** 24;
/** A Borsh bool: 0 or 1; any other byte is null (malformed). */
const boolAt = (data: Uint8Array, f: Field): boolean | null => {
  const b = data[f.offset];
  return b === 0 ? false : b === 1 ? true : null;
};
const isZero = (bytes: Uint8Array): boolean => bytes.every(b => b === 0);

/** The account is the program's, exactly `length` long, and starts with `discriminator`. */
function isProgramAccount(a: AccountData, layout: {readonly length: number; readonly discriminator: readonly number[]}): boolean {
  if (a.owner !== MAINNET_PROGRAM_ID || a.data.length !== layout.length) return false;
  return layout.discriminator.every((b, i) => a.data[i] === b);
}

/** A pinned vault ATA (rule 8): an initialized SPL Token account of `mint` owned by the treasury, or null. */
function vaultAmount(a: AccountData | null, mint: string, treasury: string): bigint | null {
  if (a === null) return null;
  const info = tokenAccountInfo(a.data, a.owner);
  if (info === null || info.program !== 'token' || info.state !== 'initialized') return null;
  return info.mint === mint && info.owner === treasury ? info.amount : null;
}

const unavailable = (code: UnavailableCode): PresaleState => ({kind: 'unavailable', code});

/**
 * Read the presale's state for `account` (a base58 key) at `nowMs` (UTC milliseconds). One `getAccountsData` for six
 * accounts: config, the user account and the allocation of `account`, the treasury and its two vault ATAs.
 */
export async function readPresaleState(reader: SolanaReader, account: string, nowMs: number): Promise<PresaleState> {
  // A key that does not parse is a doubtful read like any other: unavailable, never an exception (fail closed).
  let me: PublicKey;
  let pdas: ReturnType<typeof derivePresalePdas>;
  try {
    me = new PublicKey(account);
    pdas = derivePresalePdas(me);
  } catch {
    return unavailable('malformed');
  }
  const addresses = [
    pdas.config.toBase58(),
    pdas.userAccount.toBase58(),
    pdas.userAllocation.toBase58(),
    MAINNET_SOL_TREASURY,
    MAINNET_VAULT_USDC_ATA,
    MAINNET_VAULT_USDT_ATA,
  ];
  let accounts: (AccountData | null)[];
  try {
    accounts = await reader.getAccountsData(addresses);
  } catch (e) {
    return unavailable(e instanceof RpcForbidden ? 'refused' : 'read-failed');
  }
  if (accounts.length !== addresses.length) return unavailable('malformed');
  const [config, user, allocation, treasury, usdcVault, usdtVault] = accounts;

  // 1. Config: the program's, 370 bytes, Config's discriminator; the positional controls admin@8 and sale_token@40.
  const C = CONFIG_LAYOUT.fields;
  if (config === null || config === undefined || !isProgramAccount(config, CONFIG_LAYOUT)) return unavailable('malformed');
  const c = config.data;
  if (pubkeyAt(c, C.admin) !== MAINNET_ADMIN_ADDRESS || pubkeyAt(c, C.sale_token) !== MAINNET_NOC_MINT) return unavailable('malformed');
  // 2. C5's pins: a moved treasury or mint closes the presale.
  if (pubkeyAt(c, C.sol_treasury) !== MAINNET_SOL_TREASURY) return unavailable('malformed');
  if (pubkeyAt(c, C.usdc_address) !== MAINNET_USDC_MINT || pubkeyAt(c, C.usdt_address) !== MAINNET_USDT_MINT) return unavailable('malformed');
  // 3. A Borsh bool and a known stage.
  const activeFlag = boolAt(c, C.presale_active);
  const stage = c[C.current_stage.offset] as number;
  const priceTicks = STAGE_PRICE_TICKS[stage];
  if (activeFlag === null || priceTicks === undefined) return unavailable('malformed');
  // 4. Active as the program decides it — the inactive test first; while active, the stage total below a stage's size.
  const stageSold = u64At(c, C.stage_tokens_sold);
  const active = activeFlag && i64At(c, C.presale_start_time) <= BigInt(Math.floor(nowMs / 1000)) && u64At(c, C.tokens_sold) < PRESALE_HARD_CAP_BASE;
  if (active && stageSold >= TOKENS_PER_STAGE_BASE) return unavailable('malformed');

  // 5. The user account: absent, or the program's UserAccount with a Borsh bool for is_blocked.
  let blocked = false;
  if (user !== null && user !== undefined) {
    if (!isProgramAccount(user, USER_ACCOUNT_LAYOUT)) return unavailable('malformed');
    const b = boolAt(user.data, USER_ACCOUNT_LAYOUT.fields.is_blocked);
    if (b === null) return unavailable('malformed');
    blocked = b;
  }

  // 6. The allocation: absent, or the program's PresaleAllocation of this very account (user@8) with a Borsh bool claimed.
  const A = PRESALE_ALLOCATION_LAYOUT.fields;
  let facts: AllocationFacts = {exists: false, totalBase: 0n, bonusBase: 0n, spentCents: 0n, purchaseCount: 0, referrer: null};
  if (allocation !== null && allocation !== undefined) {
    const d = allocation.data;
    if (!isProgramAccount(allocation, PRESALE_ALLOCATION_LAYOUT) || pubkeyAt(d, A.user) !== me.toBase58() || boolAt(d, A.claimed) === null) {
      return unavailable('malformed');
    }
    const referrer = d.subarray(A.referrer.offset, A.referrer.offset + 32);
    facts = {
      exists: true,
      totalBase: u64At(d, A.total_tokens),
      bonusBase: u64At(d, A.referral_bonus_tokens),
      spentCents: u64At(d, A.total_spent_cents),
      purchaseCount: u32At(d, A.purchase_count),
      referrer: isZero(referrer) ? null : base58.encode(referrer),
    };
  }

  // 7. The treasury: a plain System account with no data.
  if (treasury === null || treasury === undefined || treasury.owner !== SYSTEM_PROGRAM_ID || treasury.data.length !== 0) return unavailable('malformed');
  // 8. Each vault ATA: an initialized SPL Token account of its mint, owned by config.sol_treasury.
  const solTreasury = pubkeyAt(c, C.sol_treasury);
  const usdc = vaultAmount(usdcVault ?? null, MAINNET_USDC_MINT, solTreasury);
  const usdt = vaultAmount(usdtVault ?? null, MAINNET_USDT_MINT, solTreasury);
  if (usdc === null || usdt === null) return unavailable('malformed');

  const stageFacts: StageFacts = {
    stage,
    priceTicks,
    nextPriceTicks: STAGE_PRICE_TICKS[stage + 1] ?? null,
    stageSoldBase: stageSold,
    stageCapBase: TOKENS_PER_STAGE_BASE,
    raisedCents: u64At(c, C.total_usd_raised_cents),
  };
  if (!active) return {kind: 'inactive', stage: stageFacts};
  if (blocked) return {kind: 'blocked', stage: stageFacts};

  const userAccountExists = user !== null && user !== undefined;
  return {
    kind: 'open',
    snapshot: {
      stage: stageFacts,
      limits: {
        ...purchaseLimits({minPurchaseUsd: u64At(c, C.min_purchase_usd), maxPerUserUsd: u64At(c, C.max_per_user_usd)}, facts.spentCents),
        firstPurchase: !facts.exists || facts.purchaseCount === 0,
      },
      allocation: facts,
      userAccountExists,
      newPdaRent: (userAccountExists ? 0n : PRESALE_USER_ACCOUNT_RENT_LAMPORTS) + (facts.exists ? 0n : PRESALE_ALLOCATION_RENT_LAMPORTS),
      treasuryLamports: treasury.lamports,
      vaults: {USDC: {address: MAINNET_VAULT_USDC_ATA, amount: usdc}, USDT: {address: MAINNET_VAULT_USDT_ATA, amount: usdt}},
    },
  };
}

/** The allocation as `resolveReferrerWith` takes it, from the snapshot (no second read). */
export function allocationRefOf(snapshot: PresaleSnapshot): AllocationRef {
  const a = snapshot.allocation;
  return {exists: a.exists, referrer: a.referrer, purchaseCount: a.purchaseCount};
}

/**
 * The referrer allocation a purchase by `account` passes (C7): the on-chain referrer's `["allocation", referrer]` PDA,
 * or the default key's when there is none. No captured referrer before B1d-2.
 */
export function referrerAllocationOf(snapshot: PresaleSnapshot, account: string): Promise<ResolvedReferrer> {
  return resolveReferrerWith(async () => allocationRefOf(snapshot), new PublicKey(account), null);
}
