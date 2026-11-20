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
import {a0LandedUnverifiedText} from '../../../modules/shielded/a0/unshieldFlow';
import type {A0FreshUnavailable, A0OwnAccountRefused, A0UnshieldErrorCode} from '../../../modules/shielded/a0/unshieldFlow';
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

/**
 * Why an unshield stopped before anything was sent, said from its CODE alone (final review M-4,
 * the secure default: an error's own message may carry the RPC endpoint's URL, which holds an API
 * key, and #21 is not FLAG_SECURE). Every code of the flow is listed; any other code (the keychain,
 * the sync, the prover, the relayer client) takes `A0_STOPPED_ON_DEVICE`. A message is shown only
 * when there is no code at all.
 */
export const A0_UNSHIELD_REFUSAL_COPY: Record<A0UnshieldErrorCode, string> = {
  E_A0_UNSHIELD_BUSY: 'Another unshield is still running on this device.',
  E_A0_UNSHIELD_AMOUNT: 'This note cannot pay that amount with the relayer fee on top.',
  E_A0_UNSHIELD_UNSUPPORTED: 'This device has no on-device prover.',
  E_A0_UNSHIELD_NOT_READY: 'Your shielded notes are not restored yet.',
  E_A0_UNSHIELD_CLUSTER: 'The network is not Solana devnet.',
  E_A0_UNSHIELD_NO_NOTE: 'No shielded note can pay the relayer fee.',
  E_A0_UNSHIELD_NOTE_LEAF: "Your note's place in the pool could not be verified.",
  E_A0_UNSHIELD_DESTINATION:
    "That destination cannot be used: a new account needs the relayer's SOL grant, and another address must be a wallet address outside this wallet.",
  E_A0_UNSHIELD_TERMS: "The relayer's new terms cannot be met from this note.",
  E_A0_UNSHIELD_CLOCK: "The chain's clock could not be read.",
  E_A0_UNSHIELD_ROUNDS: "The relayer's terms or the pool changed three times in a row.",
  E_A0_UNSHIELD_NEEDS_SEED: 'The keys of this wallet were not available.',
};

/** Any other code (the keychain, the sync, the prover, the relayer client). */
export const A0_STOPPED_ON_DEVICE = 'The unshield stopped on this device.';

/** The own-account refusal, by the role the flow names in its error's field (carry 3, M-7: never by the message). */
export const A0_OWN_ACCOUNT_REFUSAL_COPY: Record<A0OwnAccountRefused, string> = {
  main: 'That address is your main account: choose "My main account".',
  other: 'That address is an account of this wallet that is not offered as a destination.',
};

/** The fixed sentence for a code (final review M-4). */
export function a0UnshieldRefusalSentence(code: string): string {
  return Object.prototype.hasOwnProperty.call(A0_UNSHIELD_REFUSAL_COPY, code)
    ? A0_UNSHIELD_REFUSAL_COPY[code as A0UnshieldErrorCode]
    : A0_STOPPED_ON_DEVICE;
}

/** The loud line of a verifier refusal, from its CODE only (#21, #16, the dashboard; I-1). */
export function a0RefusalLoudText(code: A0VerifyRefusal): string {
  return a0LandedUnverifiedText(code, A0_VERIFY_REFUSAL_COPY[code]);
}
