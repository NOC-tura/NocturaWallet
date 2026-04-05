/** Maximum depth of the Merkle tree (matches on-chain program). */
export const MERKLE_TREE_DEPTH = 20;

/** Number of leaves per batch fetched from the API. */
export const MERKLE_FETCH_BATCH_SIZE = 256;

/** On-chain note commitment (32-byte hash, hex-encoded). */
export type NoteCommitment = string;

/**
 * Persisted Merkle tree state, stored in mmkvPublic.
 * Keeps track of which leaves have been synced so incremental sync is cheap.
 */
export interface MerkleState {
  /** Index of the next leaf to fetch (0-based). */
  nextLeafIndex: number;
  /** Current on-chain Merkle root (hex). Empty string when no leaves synced. */
  currentRoot: string;
  /** ISO timestamp of the last successful sync. */
  lastSyncedAt: string | null;
  /** On-chain tree address (base58). Null until first sync. */
  treeAddress: string | null;
}

/** A single leaf entry returned by the API. */
export interface MerkleLeaf {
  index: number;
  commitment: NoteCommitment;
}

/** Response from the /merkle/leaves API endpoint. */
export interface MerkleLeavesResponse {
  leaves: MerkleLeaf[];
  treeAddress: string;
  /** Current canonical root as reported by the anchor program. */
  anchorRoot: string;
  /** Total number of leaves committed on-chain. */
  totalLeaves: number;
}

/** Result of a sync operation. */
export interface MerkleSyncResult {
  /** Number of new leaves appended this sync. */
  newLeaves: number;
  /** Updated root after appending. */
  root: string;
  /** Whether the local root matches the anchor-reported root. */
  rootVerified: boolean;
}

export class MerkleRootMismatchError extends Error {
  readonly code = 'E050';
  constructor(public localRoot: string, public anchorRoot: string) {
    super(`Merkle root mismatch: local=${localRoot} anchor=${anchorRoot}`);
    this.name = 'MerkleRootMismatchError';
  }
}

export class MerkleSyncError extends Error {
  readonly code = 'E051';
  readonly cause: Error;
  constructor(message: string, cause: Error) {
    super(message);
    this.name = 'MerkleSyncError';
    this.cause = cause;
  }
}
