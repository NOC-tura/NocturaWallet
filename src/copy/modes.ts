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

/**
 * The two actions (§2 row 2): the dashboard's quick actions and #16's title — #16 is two screens,
 * one per action, with no tabs (owner phone pass 2026-11-21; it replaced the old combined
 * title and its two tabs).
 */
export const MAKE_PRIVATE = 'Make private';
export const MAKE_PUBLIC = 'Make public';

/** The Make public warning's title (owner phone pass 2026-11-21); the relayed sentence sits under it. */
export const WHAT_STAYS_PUBLIC = 'What stays public';
/** The deposit's on-chain record costs SOL to store; "rent" is Solana jargon (owner 2026-11-21). */
export const DEPOSIT_RECORD_STORAGE = 'Deposit record storage';
/** Under WHAT_STAYS_PUBLIC on Make public: every exit's destination is public (phone-fix review I-1). */
export const DESTINATION_IS_PUBLIC = 'The destination address is public on chain.';

/** The balances (§2 row 4): "Public balance" is the Make private screen's one line (decision B-2). */
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
export const PRIVATE_CARD_BODY = 'When you make tokens private, a proof is made on this device. Deposits are public on chain.';

/**
 * The deposit's honest sentence on Make private (spec §2; owner phone pass 2, 2026-11-21, item 2):
 * only an exit to the MAIN account is linkable to a deposit (memory project_shielded_privacy_guarantee)
 * — an exit to a new account of this wallet is not, so the sentence names the main account.
 */
export const DEPOSIT_PUBLIC_SENTENCE =
  'Your main account signs this deposit. The amount, the time and your address are public on chain, and making it public later to your main account can link the two.';

/** The card heading on Make private and Make public (owner phone pass 2, item 3): it holds more than fees. */
export const SUMMARY = 'Summary';

/**
 * The private balance after a run (owner phone pass 2, items 1 and 6): the TOTAL as the dashboard
 * reads it (`a0PrivateBalanceNow`), never arithmetic. Said only when that total is known. ONE
 * sentence for Now private and Now public, directly under the title (fix round 1, I-1).
 */
export function yourPrivateBalanceIsNow(total: string, sym: string): string {
  return `Your private balance is now ${total} ${sym}.`;
}

/** Now public's Details row: the spent note's change (owner phone pass 2, item 1) — not the balance. */
export const LEFT_IN_THIS_NOTE = 'Left in this note';

/**
 * #19 / #20 for a deposit, plain words (owner phone pass 2, items 4 and 5). The technical lines
 * (compute units, instruction count and names) move behind Details; a check that does not pass
 * keeps its own words and is never moved there.
 */
export const SIMULATION_PASSED = 'Simulation passed';
export const CHECK_KNOWN_PROGRAMS_TITLE = 'Only known programs';
export const CHECK_KNOWN_PROGRAMS_BODY = 'Noctura and Solana programs only';
export const CHECK_NO_ACCESS_TITLE = 'No one gets access to your tokens';
export const CHECK_NO_ACCESS_BODY = 'No approval or authority change';
export const YOUR_BALANCE_CHANGES = 'Your balance changes';
export const PROOF_FEE = 'Proof fee';
export const PROOF_FEE_NONE = 'None · made on this device';
/** #19's Details rows for a deposit: the technical lines the plain rows replaced (item 4). */
export const DETAIL_COMPUTE_UNITS = 'Compute units';
export const DETAIL_PROGRAMS = 'Programs';
export const DETAIL_APPROVALS = 'Approvals';

/** Now private's explorer button (owner phone pass 2, item 6): it opens the explorer, so it says so. */
export const VIEW_ON_EXPLORER = 'View on explorer';

/** Make public, when the relayer fee is more than half the amount (owner phone pass 2, item 8). */
export const FEE_IS_HIGH = 'The fee is high for this amount.';

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

/** The import's account choice (decision B-6, spec §4 "Import, smart account choice"; part B Task 7). */
export const ACCOUNT_FOUND = 'We found your wallet';
export const ACCOUNT_NONE_FUNDED = 'No funds found yet. You can receive to this address.';
export const ACCOUNT_DIFFERENT = 'Use a different account';
/** The import's warning when a balance (SOL or NOC) could not be read: the person chooses, nothing is preselected (Task 7 fix round 1, review I-1). */
export const ACCOUNT_BALANCES_UNCHECKED = "Couldn't check balances right now. Pick the account you want to use, or try again.";
/** The import's one sentence when there is nothing to pick: detection threw, or the phrase was empty (final review M-2). */
export const ACCOUNT_CHECK_FAILED = "Couldn't check this recovery phrase right now. Try again, or go back.";
