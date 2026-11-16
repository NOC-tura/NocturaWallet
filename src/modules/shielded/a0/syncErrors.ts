/**
 * The A0 tree sync's refusals (spec §9: "On a mismatch, the sync refuses to build a path").
 * One class, one code per check, so a test can name the check that fired and a caller can tell
 * "the RPC is flaky" (no code here — the RPC's own error) from "the history does not reproduce
 * the chain's tree" (every code here).
 */
export type A0SyncErrorCode =
  /** the MerkleTree account is not 3352 bytes / not a MerkleTree / its fields are out of range */
  | 'E_A0_TREE_LAYOUT'
  /** the MerkleTree account does not exist on this cluster (e.g. a mainnet RPC) */
  | 'E_A0_TREE_MISSING'
  /** our zeros / empty root differ from the account's zeros @16 */
  | 'E_A0_ZEROS'
  /** the leaves are not exactly 0, 1, 2, … in chain order (a gap, a repeat, a reordering) */
  | 'E_A0_LEAF_ORDER'
  /** the incremental root after a leaf differs from that LeafInserted's root */
  | 'E_A0_LEAF_ROOT'
  /** a commitment or root is not a canonical BN254 field element */
  | 'E_A0_FIELD'
  /** more leaves synced than the account's nextLeafIndex */
  | 'E_A0_LEAF_COUNT'
  /** the final root is not in the account's rootHistory */
  | 'E_A0_ROOT_HISTORY'
  /** at the account's leaf count, the root at rootHistoryHead is not ours */
  | 'E_A0_ROOT_HEAD'
  /** at the account's leaf count, our filled subtrees differ from the account's @656 */
  | 'E_A0_SUBTREES'
  /** a LeafInserted / Withdraw blob from the pool's own instruction has the wrong length */
  | 'E_A0_EVENT_LENGTH'
  /** a pool instruction on this tree in a successful tx does not decode (§1 layout) */
  | 'E_A0_IX_DECODE'
  /** the RPC listed a signature it then did not return, or returned another transaction */
  | 'E_A0_TX_MISSING'
  /** the transaction's balances / keys are inconsistent (preBalances length, token entries) */
  | 'E_A0_TX_SHAPE';

export class A0SyncError extends Error {
  readonly code: A0SyncErrorCode;
  constructor(code: A0SyncErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'A0SyncError';
    this.code = code;
  }
}
