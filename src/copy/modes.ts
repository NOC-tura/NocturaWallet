/**
 * Shielded UX part B (spec docs/superpowers/specs/2026-11-20-shielded-ux-b-vocabulary-design.md
 * §2, decision B-1 "Public / Private"): every user-visible TERM of the two sides, in one place.
 * The screens import these. A sentence that only uses a term may stay in its screen, but never
 * with one of the words §2 removes (`src/copy/__tests__/bannedWords.test.ts`).
 *
 * Honesty (spec §2; memory project_shielded_privacy_guarantee): "Private" promises more than the
 * old word did — a deposit is public and signed by the main account, and an exit to the main
 * account is linkable to it. Nothing here may promise more (`FORBIDDEN_NEW` in
 * `src/copy/__testing__/copyScan.ts`), and the privacy-claims guard reads this file.
 *
 * Amounts arrive already formatted (`displayAmount`): this module holds words, never arithmetic.
 * Overline text is upper-cased by the `overline` variant, so terms are written in sentence case.
 */

/** The dashboard's mode toggle (§2 row 1). */
export const MODE_PUBLIC = 'Public';
export const MODE_PRIVATE = 'Private';

/** The two actions: #16's tabs and the dashboard's quick actions (§2 row 2). */
export const MAKE_PRIVATE = 'Make private';
export const MAKE_PUBLIC = 'Make public';

/** #16's title (§2 row 3). */
export const PRIVATE_PUBLIC_TITLE = 'Private ⇄ Public';

/** The balances (§2 row 4): "Public balance" is the Make private tab's one line (decision B-2). */
export const PRIVATE_BALANCE = 'Private balance';
export const PUBLIC_BALANCE = 'Public balance';

/** The dashboard's asset section ("PRIVATE ASSETS" on screen) and row suffix (§2 row 5). */
export const PRIVATE_ASSETS = 'Private assets';
export const PRIVATE_SUFFIX = ' · private';

/** The mode mark in the #18 / #21 headers ("PRIVATE · Make public", §2 row 6). */
export const PRIVATE_MARK = 'Private';

/** The run that makes a balance public (§2 row 6). */
export const MAKING_PUBLIC = 'Making public…';
export const NOW_PUBLIC = 'Now public';

/** The deposit run (§2 row 7). */
export const MAKING_PRIVATE = 'Making private…';
export const NOW_PRIVATE = 'Now private';

/** The dashboard's Private balance card (§2 row 8): it keeps "Deposits are public on chain." */
export const PRIVATE_CARD_BODY = 'Make private moves tokens in with a proof made on this device. Deposits are public on chain.';

/**
 * The native confirmation (§2 row 9). Android cannot import this module: the resource
 * `android/app/src/main/res/values/a0_confirm_strings.xml` holds the same words, and
 * `src/copy/__tests__/nativeStrings.test.ts` (Task 6) holds the two equal.
 */
export const NATIVE_CONFIRM_TITLE = 'Confirm making public';
export const NATIVE_FEE_LINE = 'Relayer fee %1$s %2$s, taken from your private balance';
export const NATIVE_PROMPT_TITLE = 'Approve making this public';
export const NATIVE_PROMPT_SUBTITLE = 'Confirm it is you to authorize this one transfer to public';

/** `DetailsDisclosure`'s label (spec §3.2). */
export const DETAILS = 'Details';

/** `DestinationRow` (spec §3.3). */
export const DESTINATION_FRESH = 'A new account';
export const DESTINATION_MAIN = 'My main account';
export const DESTINATION_EXTERNAL = 'Another address';
export const DESTINATION_EXTERNAL_SUB = 'A wallet address outside this wallet';
export const RECOMMENDED = ' (recommended)';
export const CHANGE = 'Change';
/** Change's accessibility label (a screen reader hears what it changes). */
export const CHANGE_DESTINATION = 'Change destination';
/** Nothing chosen yet (owner decision A1, 2026-11-20): no quote yet, or the fresh account is not offered (S9 / S11). */
export const DESTINATION_NONE = 'Choose a destination';
/** Why there is no new account when the wallet's key scheme could not be read (Task 3 fix round 1). */
export const DESTINATION_FRESH_SCHEME_UNREADABLE = "A new account is not available: this wallet's account type could not be read.";

/** "To: {selected}" — the collapsed destination row; "To: Choose a destination" while nothing is chosen. */
export function destinationSummary(name: string | null): string {
  return `To: ${name ?? DESTINATION_NONE}`;
}

/** The CTAs (§2 row 2), with an amount. */
export function makePublicCta(amount: string, sym: string): string {
  return `Make ${amount} ${sym} public`;
}

export function makePrivateCta(amount: string, sym: string): string {
  return `Make ${amount} ${sym} private`;
}

/** The disabled CTAs (§2 row 2), without an amount. */
export function makePublicCtaIdle(sym: string): string {
  return `Make ${sym} public`;
}

export function makePrivateCtaIdle(sym: string): string {
  return `Make ${sym} private`;
}

/** `AmountLimitHint` on Make public (spec §3.4). */
export function makePublicLimit(max: string, sym: string): string {
  return `You can make up to ${max} ${sym} public at once.`;
}
