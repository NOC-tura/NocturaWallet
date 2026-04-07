import {poseidon2} from 'poseidon-lite';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {API_BASE} from '../../constants/programs';
import {pinnedFetch} from '../sslPinning/pinnedFetch';
import {
  MerkleState,
  MerkleLeaf,
  MerkleLeavesResponse,
  MerkleSyncResult,
  MerkleRootMismatchError,
  MerkleSyncError,
  MERKLE_TREE_DEPTH,
  MERKLE_FETCH_BATCH_SIZE,
} from './types';

// ---- BN254 field validation ------------------------------------------------

/**
 * BN254 (alt_bn128) scalar field prime.
 * All Poseidon inputs MUST be valid field elements (< this prime).
 * Inputs >= F would be silently reduced by poseidon-lite, producing
 * a hash that differs from what the on-chain circuit computes with
 * explicit range checking.
 */
export const BN254_FIELD_PRIME = BigInt(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617',
);

function toFieldElement(hex: string): bigint {
  const bn = BigInt('0x' + hex.padStart(64, '0'));
  if (bn >= BN254_FIELD_PRIME) {
    throw new Error(`Merkle: value is not a valid BN254 field element (>= F): 0x${hex.slice(0, 8)}...`);
  }
  return bn;
}

// ---- Minimal in-memory Merkle tree (Poseidon) ---------------------------

/**
 * Hash two 32-byte hex values using Poseidon2(left, right).
 * Inputs are validated as BN254 field elements before hashing.
 * Output is always a valid field element (< F) as a 64-char hex string.
 *
 * ZERO_LEAF = 0 in the field. Must match the on-chain program's zero-leaf
 * constant at PROGRAM_ID 6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt.
 */
function hashPair(left: string, right: string): string {
  const leftBn = toFieldElement(left);
  const rightBn = toFieldElement(right);
  const result = poseidon2([leftBn, rightBn]);
  return result.toString(16).padStart(64, '0');
}

const ZERO_LEAF = '0'.repeat(64);
const ZERO_HASHES: string[] = (() => {
  const zeros = [ZERO_LEAF];
  for (let i = 1; i <= MERKLE_TREE_DEPTH; i++) {
    zeros.push(hashPair(zeros[i - 1]!, zeros[i - 1]!));
  }
  return zeros;
})();

/**
 * Compute Merkle root from an ordered list of leaf commitments.
 * Uses an incremental approach: only processes actual leaves plus zero-hash
 * siblings, avoiding allocation of the full 2^DEPTH tree.
 */
export function computeMerkleRoot(leaves: string[]): string {
  if (leaves.length === 0) {
    return ZERO_HASHES[MERKLE_TREE_DEPTH]!;
  }

  // Work with only the populated portion at each level.
  // At each depth, pair nodes with their sibling (or the zero hash if absent).
  let layer = leaves.slice();

  for (let depth = 0; depth < MERKLE_TREE_DEPTH; depth++) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]!;
      const right = i + 1 < layer.length ? layer[i + 1]! : ZERO_HASHES[depth]!;
      next.push(hashPair(left, right));
    }
    // If the previous layer had an odd count, the last parent was paired with
    // a zero hash.  But we also need to account for the case where the parent
    // layer itself is shorter than what the full tree would need — subsequent
    // parents would be hash(parent, ZERO_HASHES[depth]).  We only need to
    // keep going until we converge to a single root, filling missing siblings
    // with the appropriate zero hash at each level.
    layer = next;
  }

  return layer[0]!;
}

// ---- Persistence helpers -------------------------------------------------

const LEAVES_STORAGE_KEY = (treeAddress: string) =>
  `${MMKV_KEYS.SHIELDED_MERKLE_LEAVES_PREFIX}${treeAddress}`;

function loadState(): MerkleState {
  const raw = mmkvPublic.getString(MMKV_KEYS.SHIELDED_MERKLE_STATE);
  if (!raw) {
    return {nextLeafIndex: 0, currentRoot: '', lastSyncedAt: null, treeAddress: null};
  }
  try {
    return JSON.parse(raw) as MerkleState;
  } catch {
    return {nextLeafIndex: 0, currentRoot: '', lastSyncedAt: null, treeAddress: null};
  }
}

function saveState(state: MerkleState): void {
  mmkvPublic.set(MMKV_KEYS.SHIELDED_MERKLE_STATE, JSON.stringify(state));
}

function loadLeaves(treeAddress: string): string[] {
  const raw = mmkvPublic.getString(LEAVES_STORAGE_KEY(treeAddress));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function saveLeaves(treeAddress: string, leaves: string[]): void {
  mmkvPublic.set(LEAVES_STORAGE_KEY(treeAddress), JSON.stringify(leaves));
}

// ---- MerkleModule --------------------------------------------------------

export class MerkleModule {
  /**
   * Returns the persisted local Merkle state.
   */
  getState(): MerkleState {
    return loadState();
  }

  /**
   * Clears all persisted state (useful for account switch / full reset).
   */
  reset(): void {
    const state = loadState();
    if (state.treeAddress) {
      mmkvPublic.remove(LEAVES_STORAGE_KEY(state.treeAddress));
    }
    mmkvPublic.remove(MMKV_KEYS.SHIELDED_MERKLE_STATE);
  }

  /**
   * Incremental sync: fetches only leaves after `state.nextLeafIndex`.
   * Verifies the local root against the anchor-reported root after each batch.
   * Throws MerkleRootMismatchError if the roots diverge.
   */
  async sync(): Promise<MerkleSyncResult> {
    let state = loadState();
    let allNewLeaves: MerkleLeaf[] = [];
    let anchorRoot = '';
    let treeAddress = state.treeAddress ?? '';
    let totalLeaves = 0;

    try {
      // Paginate until we have caught up
      let from = state.nextLeafIndex;

      do {
        const url = `${API_BASE}/merkle/leaves?from=${from}&limit=${MERKLE_FETCH_BATCH_SIZE}`;
        const resp = await pinnedFetch(url);
        const data = (await resp.json()) as MerkleLeavesResponse;

        treeAddress = data.treeAddress;
        anchorRoot = data.anchorRoot;
        totalLeaves = data.totalLeaves;

        if (data.leaves.length > 0) {
          allNewLeaves = allNewLeaves.concat(data.leaves);
          from += data.leaves.length;
        }

        // Stop if this batch is smaller than the limit (we've caught up)
        if (data.leaves.length < MERKLE_FETCH_BATCH_SIZE) {
          break;
        }
      } while (from < totalLeaves);

      // Append new leaves to persisted leaf list
      const existingLeaves = state.treeAddress ? loadLeaves(state.treeAddress) : [];
      const updatedLeaves = existingLeaves.concat(
        allNewLeaves.map(l => l.commitment),
      );

      if (treeAddress) {
        saveLeaves(treeAddress, updatedLeaves);
      }

      // Recompute root
      const localRoot = computeMerkleRoot(updatedLeaves);

      // Verify against anchor root.
      // Empty anchor with zero new leaves is valid: the tree doesn't exist yet on-chain.
      // Empty anchor WITH new leaves is suspicious and must be rejected.
      const rootVerified =
        (anchorRoot === '' && allNewLeaves.length === 0) || localRoot === anchorRoot;

      if (!rootVerified) {
        throw new MerkleRootMismatchError(localRoot, anchorRoot);
      }

      // Persist updated state
      const newState: MerkleState = {
        nextLeafIndex: state.nextLeafIndex + allNewLeaves.length,
        currentRoot: localRoot,
        lastSyncedAt: new Date().toISOString(),
        treeAddress: treeAddress || state.treeAddress,
      };
      saveState(newState);

      return {
        newLeaves: allNewLeaves.length,
        root: localRoot,
        rootVerified: true,
      };
    } catch (err) {
      if (err instanceof MerkleRootMismatchError) {
        throw err;
      }
      const cause = err instanceof Error ? err : new Error(String(err));
      throw new MerkleSyncError('Merkle sync failed', cause);
    }
  }
}

export const merkleModule = new MerkleModule();
