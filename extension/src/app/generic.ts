/**
 * B1d Q42 (C19, §1.3 "Screens that read intent"): the words for the wallet's own record of a kind this build cannot show
 * (`intent: null` — a purchase, while no kind renderer exists). Only the transaction's own facts go beside them: never an
 * amount, a recipient or anything from `extra.data`.
 */
export const GENERIC_TEXT = {
  pending: 'Transaction · pending',
  slow: 'Transaction · taking longer than usual',
  line: 'Transaction',
} as const;
