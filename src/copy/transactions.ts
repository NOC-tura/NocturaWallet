/**
 * post-M1d spec §5: the words of the transaction detail (#27). The direction is claimed only when it is
 * known for the account the detail was opened from; otherwise the neutral word.
 */
export const TX_SENT = 'Sent';
export const TX_RECEIVED = 'Received';
export const TX_NEUTRAL = 'Transaction';
/** Under an address that is a token account because the response named no owner wallet (R11) */
export const TX_TOKEN_ACCOUNT = 'token account';
/** The row shown instead of "From" when the transaction has no transfer (R12: the fee payer is not the sender) */
export const TX_FEE_PAYER = 'Fee payer';
/** An SPL transfer signed for by a key that is not the funds' owner (a delegate), or whose owner is not known */
export const TX_AUTHORIZED_BY = 'Authorized by';
