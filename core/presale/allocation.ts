import {Buffer} from 'buffer';
import {PublicKey} from '@solana/web3.js';
import {MAINNET_ADMIN_ADDRESS, MAINNET_NOC_MINT, MAINNET_PROGRAM_ID} from './addresses';

/**
 * `Buffer` is imported rather than assumed global. React Native provides one through a
 * polyfill and Node has it built in, but a Vite bundle has neither — the page would
 * throw `ReferenceError: Buffer is not defined` on the first PDA derivation while every
 * test stayed green, because the tests run in Node.
 */

/** The narrowest chain read this module needs: no `Connection`, so no two-copies problem. */
export interface AccountReader {
  getAccountInfo(address: PublicKey): Promise<{data: Uint8Array} | null>;
}

const PROGRAM = new PublicKey(MAINNET_PROGRAM_ID);
const ADMIN = new PublicKey(MAINNET_ADMIN_ADDRESS);

/**
 * PresaleAllocation account layout: 8-byte Anchor discriminator + user Pubkey (32) →
 * `total_tokens` (u64 LE) at offset 40. This is the AUTHORITATIVE, claimable allocation
 * (it already includes any referral bonus) — the value the website reads. The
 * coordinator's recorded-purchase sum is only approximate.
 */
export const ALLOCATION_TOTAL_TOKENS_OFFSET = 40;

/**
 * The rest of PresaleAllocation, from the program's own struct:
 * disc(8) + user(32) + total_tokens(8) + total_spent_cents(8) + purchase_count(4)
 * + first_purchase_at(8) + last_purchase_at(8) + referral_bonus_tokens(8)
 * + referrer(32) + claimed(1) = 117 bytes, which is exactly what mainnet accounts are.
 *
 * `referral_bonus_tokens` is read because the page shows a buyer their allocation next
 * to their purchases, and those two numbers do not add up without it: a bonus is credited
 * by SOMEONE ELSE's first purchase, so it appears in the total with no row of its own.
 * The coordinator's referral endpoint reports zero for a wallet the chain credited
 * 16.142571618 NOC, so this is read from the chain like the total it is part of.
 */
export const ALLOCATION_REFERRAL_BONUS_OFFSET = 76;
export const ALLOCATION_ACCOUNT_LENGTH = 117;

/**
 * Config account layout: `tge_timestamp` is an i64 LE at byte offset 201 (after the
 * 8-byte disc + admin/sale/usdt/usdc 4×32 + 4×u64 prices/ratios + current_stage u8 +
 * 3×u64 sold/raised counters + presale_start_time i64 @193). The config PDA
 * (`["config", ADMIN]`) is user-independent, so any pubkey works for the derive.
 * Value: read live from the account, not restated here.
 */
export const CONFIG_TGE_TIMESTAMP_OFFSET = 201;

/**
 * `sol_treasury` is the LAST field of Config — a Pubkey at byte offset 338 of a
 * 370-byte account. Both numbers confirmed from chain on 2026-09-22, with the known
 * `tge_timestamp` at 201 used as the control that the offset arithmetic was right.
 *
 * WHY THIS IS READ AND NOT A CONSTANT. On 2026-09-21 the program gained
 * `stablecoin_ata_for_admin.owner == config.sol_treasury`. Both the website and this
 * wallet were still deriving that account from the ADMIN address, so every stablecoin
 * purchase began failing with InvalidTokenAccountOwner the moment the upgrade landed —
 * the account LIST had not changed, so both sides concluded nothing had to change, and
 * the value inside one of its slots was what moved.
 *
 * A shipped constant repeats that failure by construction: an installed APK cannot be
 * corrected in five minutes. Reading the destination from the same account the program
 * checks it against means the two cannot drift apart at all.
 */
export const CONFIG_SOL_TREASURY_OFFSET = 338;
export const CONFIG_ACCOUNT_LENGTH = 370;

/**
 * Read `sol_treasury` out of a Config account's bytes.
 *
 * Throws on a short account rather than returning a key built from whatever follows,
 * because a Pubkey read past the end of the data is still 32 valid-looking bytes — it
 * would become a real address that nobody controls, and the purchase would send money
 * there. Fail closed.
 */
export function readSolTreasury(data: Uint8Array): PublicKey {
  const end = CONFIG_SOL_TREASURY_OFFSET + 32;
  if (data.length < end) {
    throw new Error(
      `Config account is ${data.length} bytes, needs at least ${end} to hold sol_treasury`,
    );
  }

  // POSITIONAL CONTROL, before trusting the offset we actually care about.
  //
  // Config's length alone cannot tell a harmless change from a dangerous one: a field
  // appended at the end leaves 8, 40 and 338 valid, while a field INSERTED shifts all
  // three, and both look identical as a byte count. So instead of guessing from the
  // length, two fields whose values we already know are read at their own offsets. If
  // the layout moved, they stop matching — and the read that would have sent money to
  // an address nobody controls fails instead.
  const admin = new PublicKey(data.subarray(8, 40));
  const saleToken = new PublicKey(data.subarray(40, 72));
  if (admin.toBase58() !== MAINNET_ADMIN_ADDRESS || saleToken.toBase58() !== MAINNET_NOC_MINT) {
    throw new Error(
      'Config layout check failed: admin@8 or sale_token@40 is not what this build expects. ' +
        'The account layout has changed and every offset here — 8, 40, 201, 338 — is suspect.',
    );
  }

  return new PublicKey(data.subarray(CONFIG_SOL_TREASURY_OFFSET, end));
}

/** Fetch the treasury the program will validate against. Throws if it cannot be read. */
export async function fetchSolTreasury(reader: AccountReader): Promise<PublicKey> {
  const {config} = derivePresalePdas(PublicKey.default);
  const info = await reader.getAccountInfo(config);
  if (!info) {
    throw new Error('Presale config account not found — cannot resolve the treasury');
  }
  return readSolTreasury(info.data);
}

export interface PresalePdas {
  config: PublicKey;
  userAccount: PublicKey;
  userAllocation: PublicKey;
  referrerAllocation: PublicKey;
}

/**
 * Read a little-endian u64 by hand.
 *
 * `buffer@5.7.1`, which React Native ships, has no `readBigUInt64LE`: the accessor
 * works under Jest on Node and does not exist on Hermes, so the tidy version is a
 * defect that only appears on a device.
 */
export function readU64LE(data: Uint8Array, offset: number): bigint {
  let value = 0n;
  for (let i = 7; i >= 0; i--) {
    value = (value << 8n) | BigInt(data[offset + i] as number);
  }
  return value;
}

/** Derive the four PDAs the purchase instruction needs. */
export function derivePresalePdas(user: PublicKey): PresalePdas {
  const [config] = PublicKey.findProgramAddressSync([Buffer.from('config'), ADMIN.toBytes()], PROGRAM);
  const [userAccount] = PublicKey.findProgramAddressSync([Buffer.from('user'), user.toBytes()], PROGRAM);
  const [userAllocation] = PublicKey.findProgramAddressSync(
    [Buffer.from('allocation'), user.toBytes()],
    PROGRAM,
  );
  // No referrer in B1: the program skips the bonus when the referrer allocation
  // is the PDA of the default (all-zero) pubkey.
  const [referrerAllocation] = PublicKey.findProgramAddressSync(
    [Buffer.from('allocation'), PublicKey.default.toBytes()],
    PROGRAM,
  );
  return {config, userAccount, userAllocation, referrerAllocation};
}

/**
 * Read the user's authoritative on-chain presale allocation (`total_tokens`, 9-dec base
 * units) from the `["allocation", user]` PDA. Returns 0 / exists:false when the user has
 * no allocation account — the caller must distinguish those, because "no allocation" and
 * "we could not read it" mean opposite things to someone checking their money.
 */
export async function fetchOnChainAllocation(
  reader: AccountReader,
  user: PublicKey,
): Promise<{totalTokensBase: string; referralBonusBase: string | null; exists: boolean}> {
  const {userAllocation} = derivePresalePdas(user);
  const info = await reader.getAccountInfo(userAllocation);
  if (!info || !info.data || info.data.length < ALLOCATION_TOTAL_TOKENS_OFFSET + 8) {
    return {totalTokensBase: '0', referralBonusBase: null, exists: false};
  }

  // POSITIONAL CONTROL. `user` sits at offset 8 and we derived this very PDA from it,
  // so it is a value we already know — if the layout ever shifts, it stops matching and
  // every offset below is suspect. Throwing is deliberate: the caller renders a throw as
  // "could not be read", while returning exists:false would say "you have no allocation",
  // which is the one sentence this module exists to never say by accident.
  const owner = new PublicKey(info.data.subarray(8, 40));
  if (!owner.equals(user)) {
    throw new Error(
      `Allocation layout check failed: the pubkey at offset 8 is ${owner.toBase58()}, ` +
        `not the ${user.toBase58()} this PDA was derived from.`,
    );
  }

  // null, not 0: an account too short to hold the field means we do not know the bonus,
  // and "no bonus" is a different statement from "not readable".
  const hasBonus = info.data.length >= ALLOCATION_REFERRAL_BONUS_OFFSET + 8;
  return {
    totalTokensBase: readU64LE(info.data, ALLOCATION_TOTAL_TOKENS_OFFSET).toString(),
    referralBonusBase: hasBonus
      ? readU64LE(info.data, ALLOCATION_REFERRAL_BONUS_OFFSET).toString()
      : null,
    exists: true,
  };
}

/**
 * Read the on-chain TGE timestamp (`config.tge_timestamp`) in unix seconds, or null when
 * the config account is missing / too short. The stored value is positive, so an
 * unsigned LE read is fine.
 */
export async function fetchTgeTimestamp(reader: AccountReader): Promise<number | null> {
  const {config} = derivePresalePdas(PublicKey.default);
  const info = await reader.getAccountInfo(config);
  if (!info || !info.data || info.data.length < CONFIG_TGE_TIMESTAMP_OFFSET + 8) {
    return null;
  }
  const seconds = Number(readU64LE(info.data, CONFIG_TGE_TIMESTAMP_OFFSET));
  // Zero means the date has not been set. Returning it would make every consumer
  // count from 1970 — the app's countdown renders "now" for it — so absence is
  // reported as absence, the same answer an unreadable account gives.
  return seconds > 0 ? seconds : null;
}
