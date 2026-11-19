/**
 * The unshield's copy (spec §11 "Copy", owner-delegated D27, R10, R11), in ONE place so the screens
 * and their tests say exactly the same words and the privacy-claims guard reads them (this
 * directory is in its scope). §11's strings are the rules: shortened, never widened.
 *
 * Shortenings, each listed for the owner's visual pass:
 *   - the fresh-account default drops "(Account N+1)": the index is decided only when the flow
 *     reserves it (the registry's lowest free index, skipping indices with history — a request the
 *     screen does not make), so a number shown before that could be wrong;
 *   - "NOC" is the pool token's symbol: on the devnet pool that is the test token (TEST).
 */
import {formatTokenAmount} from '../../../utils/parseTokenAmount';
import {SOL_DECIMALS, displayAmount} from '../../../modules/shielded/a0/screenSupport';
import type {A0FreshUnavailable} from '../../../modules/shielded/a0/unshieldFlow';
import type {A0VerifyRefusal} from '../../../modules/shielded/a0/landedVerifier';

/** Any relayed unshield (§11, verbatim). */
export const A0_RELAYED_COPY =
  'The relayer pays for and submits this transaction, so no key of yours signs it. Amounts and timing are public.';

/** The fresh-account default (§11, shortened: no account number). */
export function a0FreshDefaultCopy(grantLamports: bigint): string {
  return `A new account of this wallet receives it. The relayer also sends it ${formatTokenAmount(grantLamports, SOL_DECIMALS)} SOL so it can pay for its own transactions.`;
}

/** Why the fresh account is disabled (§11, verbatim: S11's no-grant string and S9's cli string). */
export const A0_FRESH_UNAVAILABLE_COPY: Record<A0FreshUnavailable, string> = {
  'no-grant':
    'A new account is not available yet: the relayer cannot send it SOL for its own fees, and funding it from your other accounts would link them.',
  cli: 'This wallet uses the Solana CLI key scheme, which has a single account, so no new account can be created for this exit.',
};

/** "My main account" (§11, verbatim). */
export const A0_MAIN_ACCOUNT_WARNING = 'This links your exit to your deposit: your main account made the deposit.';

/** "Another address" (§11, verbatim). */
export const A0_EXTERNAL_WARNING = 'This is a payment from your shielded balance. The recipient sees the amount.';

/** The amount line (§11; the token's symbol for "NOC"). */
export function a0AmountLine(amount: bigint, fee: bigint, decimals: number, symbol: string): string {
  return `The destination receives exactly ${displayAmount(amount, decimals)} ${symbol}. The relayer fee of ${displayAmount(fee, decimals)} ${symbol} comes out of your shielded balance.`;
}

/** The one-note limit (§11; the token's symbol for "NOC"). */
export function a0OneNoteLimit(max: bigint, decimals: number, symbol: string): string {
  return `You can unshield up to ${displayAmount(max, decimals)} ${symbol} from one note at a time; combining notes comes in a later version.`;
}

/**
 * What each verifier refusal means, said from its CODE alone (M1c Task 8 carry 4): the verifier's
 * `detail` names keys of this seed, so it never reaches the screen — the loud line is
 * `a0LandedUnverifiedText(code, A0_VERIFY_REFUSAL_COPY[code])`. Every code is listed (the compiler
 * holds the record complete).
 */
export const A0_VERIFY_REFUSAL_COPY: Record<A0VerifyRefusal, string> = {
  E_A0_VERIFY_ARGS: 'this wallet could not check it against what you approved',
  E_A0_VERIFY_SIGNATURE: 'it is not the transaction the relayer named',
  E_A0_VERIFY_SEED_SIGNER: 'a key of this wallet signed it',
  E_A0_VERIFY_SIGNERS: 'it was not signed by the relayer alone',
  E_A0_VERIFY_FEE_PAYER: "its fee payer is not the relayer's",
  E_A0_VERIFY_PROGRAMS: 'it calls a program outside the relayed unshield',
  E_A0_VERIFY_WITHDRAW: 'it is not exactly one withdrawal from the pool',
  E_A0_VERIFY_NULLIFIER: "its spend is not this note's",
  E_A0_VERIFY_CHANGE_LEAF: 'its change note is not the one you approved',
  E_A0_VERIFY_FEE_DESTINATION: "its relayer fee goes to an account that is not the relayer's",
  E_A0_VERIFY_FEE: 'its relayer fee is not the one you approved',
  E_A0_VERIFY_DESTINATION: 'its destination is not the one you approved',
  E_A0_VERIFY_AMOUNT: 'its amount is not the one you approved',
  E_A0_VERIFY_CREATE_ATA: 'its token account creation is not the expected one',
  E_A0_VERIFY_SEED_KEY: 'it names another account of this wallet',
  E_A0_VERIFY_GRANT_COUNT: 'it sends SOL more than once',
  E_A0_VERIFY_GRANT_TERMS: "its SOL grant is not the relayer's quoted one",
  E_A0_VERIFY_GRANT_PRE_BALANCE: 'it sent SOL to an account that already held some',
  E_A0_VERIFY_GRANT_OFF_CURVE: 'it sent SOL to an address that is not a wallet',
};
