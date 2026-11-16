/**
 * The A0 deposit carried across #18 → #19 → #20 → #21 (spec §5, §11 "#19–#21 tx flow for the
 * deposit"). A sibling of `TransferIntent`, not a variant of it: the transparent #19–#21 screens
 * REBUILD a transfer from their intent and re-sign it on expiry (TransactionStatusScreen's
 * MAX_ATTEMPTS), which a deposit must never do (one blockhash, one pending note, one send — Task 4).
 * The shield screens therefore take this intent and the prepared deposit it names; nothing in it
 * can make a transaction: the proof and the accounts are held in memory by
 * `shielded/a0/screenSupport.ts` under `preparedId`, and a forged or stale id finds nothing.
 */
export interface ShieldIntent {
  kind: 'shield';
  /** the held A0PreparedDeposit (screenSupport.holdPreparedA0Deposit) */
  preparedId: string;
  /** base units, decimal string (BigInt-safe; params must be serializable) */
  amount: string;
  tokenSymbol: string;
  decimals: number;
  /** base58 of the main transparent account that signs and pays */
  depositor: string;
}
