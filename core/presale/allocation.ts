import {Buffer} from 'buffer';
import {PublicKey} from '@solana/web3.js';
import {MAINNET_ADMIN_ADDRESS, MAINNET_PROGRAM_ID} from './addresses';

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
 * Config account layout: `tge_timestamp` is an i64 LE at byte offset 201 (after the
 * 8-byte disc + admin/sale/usdt/usdc 4×32 + 4×u64 prices/ratios + current_stage u8 +
 * 3×u64 sold/raised counters + presale_start_time i64 @193). The config PDA
 * (`["config", ADMIN]`) is user-independent, so any pubkey works for the derive.
 * Value: read live from the account, not restated here.
 */
export const CONFIG_TGE_TIMESTAMP_OFFSET = 201;

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
): Promise<{totalTokensBase: string; exists: boolean}> {
  const {userAllocation} = derivePresalePdas(user);
  const info = await reader.getAccountInfo(userAllocation);
  if (!info || !info.data || info.data.length < ALLOCATION_TOTAL_TOKENS_OFFSET + 8) {
    return {totalTokensBase: '0', exists: false};
  }
  return {
    totalTokensBase: readU64LE(info.data, ALLOCATION_TOTAL_TOKENS_OFFSET).toString(),
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
  return Number(readU64LE(info.data, CONFIG_TGE_TIMESTAMP_OFFSET));
}
