import {Buffer} from 'buffer';
import {PublicKey} from '@solana/web3.js';
import {base58} from '@scure/base';
import {MAINNET_PROGRAM_ID} from './addresses';
import {derivePresalePdas, type AccountReader} from './allocation';

const PROGRAM = new PublicKey(MAINNET_PROGRAM_ID);

// PresaleAllocation layout (117 bytes): purchase_count (u32 LE) @56, referrer
// (32 bytes) @84. See spec §"PresaleAllocation layout".
const ALLOC_PURCHASE_COUNT_OFFSET = 56;
const ALLOC_REFERRER_OFFSET = 84;
const ALLOCATION_MIN_LEN = 116;

export interface AllocationRef {
  exists: boolean;
  referrer: string | null;
  purchaseCount: number;
}

export interface ResolvedReferrer {
  referrerAllocation: PublicKey;
  registerReferrer: PublicKey | null;
  effectiveReferrerAddress: string | null;
}

/**
 * Read the buyer's on-chain `PresaleAllocation` referral fields: whether the account
 * exists, its current `referrer` (null when the 32 bytes are all zero / the default
 * key), and `purchase_count`.
 */
export async function fetchAllocationRef(
  reader: AccountReader,
  user: PublicKey,
): Promise<AllocationRef> {
  const {userAllocation} = derivePresalePdas(user);
  const info = await reader.getAccountInfo(userAllocation);
  if (!info || !info.data || info.data.length < ALLOCATION_MIN_LEN) {
    return {exists: false, referrer: null, purchaseCount: 0};
  }
  const data = info.data;
  // u32 LE — `* 2**24` (not `<< 24`) so the high byte never flips the sign.
  const purchaseCount =
    (data[ALLOC_PURCHASE_COUNT_OFFSET] as number) |
    ((data[ALLOC_PURCHASE_COUNT_OFFSET + 1] as number) << 8) |
    ((data[ALLOC_PURCHASE_COUNT_OFFSET + 2] as number) << 16) |
    (data[ALLOC_PURCHASE_COUNT_OFFSET + 3] as number) * 2 ** 24;
  const referrerBytes = data.subarray(ALLOC_REFERRER_OFFSET, ALLOC_REFERRER_OFFSET + 32);
  let allZero = true;
  for (let i = 0; i < 32; i++) {
    if (referrerBytes[i] !== 0) {
      allZero = false;
      break;
    }
  }
  const referrer = allZero ? null : new PublicKey(referrerBytes).toBase58();
  return {exists: true, referrer, purchaseCount};
}

/**
 * Validate a captured referrer string as a real 32-byte base58 pubkey that is neither
 * the buyer (self-referral) nor the default/all-zero key.
 */
export function captureIsValid(captured: string | null, user: PublicKey): boolean {
  if (captured === null) return false;
  let decoded: Uint8Array;
  try {
    decoded = base58.decode(captured);
  } catch {
    return false;
  }
  if (decoded.length !== 32) return false;
  return captured !== user.toBase58() && captured !== PublicKey.default.toBase58();
}

/**
 * Decide how a presale buy applies a referrer.
 *
 * CORRECTNESS: `referrerAllocation` is ALWAYS the PDA of the SAME effective referrer
 * that `registerReferrer` sets, because the program validates `referrer_allocation`
 * against `["allocation", user_allocation.referrer]` — a mismatch makes the transaction
 * fail. Deriving it from the BUYER, as an earlier draft of the web client did, breaks
 * every purchase by anyone who has ever bought with a referrer.
 *
 * Takes the fetcher rather than calling one, so the app can keep spying on its own
 * `fetchAllocationRef` and its existing tests still prove this behaviour.
 */
export async function resolveReferrerWith(
  fetchRef: (user: PublicKey) => Promise<AllocationRef>,
  user: PublicKey,
  capturedReferrer: string | null,
): Promise<ResolvedReferrer> {
  const a = await fetchRef(user);
  const onChainReferrer = a.exists && a.referrer ? a.referrer : null;
  const capturedValid = captureIsValid(capturedReferrer, user);
  const isFirstPurchase = !a.exists || a.purchaseCount === 0;

  const registerReferrer =
    !onChainReferrer && capturedValid && isFirstPurchase
      ? new PublicKey(capturedReferrer as string)
      : null;
  const effective: PublicKey | null =
    registerReferrer ?? (onChainReferrer ? new PublicKey(onChainReferrer) : null);

  const [referrerAllocation] = PublicKey.findProgramAddressSync(
    [Buffer.from('allocation'), (effective ?? PublicKey.default).toBytes()],
    PROGRAM,
  );
  return {
    referrerAllocation,
    registerReferrer,
    effectiveReferrerAddress: effective?.toBase58() ?? null,
  };
}

/** Convenience wrapper that reads the allocation itself. */
export async function resolveReferrer(
  reader: AccountReader,
  user: PublicKey,
  capturedReferrer: string | null,
): Promise<ResolvedReferrer> {
  return resolveReferrerWith(u => fetchAllocationRef(reader, u), user, capturedReferrer);
}
