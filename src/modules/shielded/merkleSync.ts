import {PublicKey} from '@solana/web3.js';
import {getConnection} from '../solana/connection';
import {poolPda, merkleTreePda} from './poolPdas';
import {parseDepositEvents, orderedLeaves} from './depositEvents';
import type {DepositEvent} from './depositEvents';
import {bytesToHex} from './fieldCodec';

// MerkleTree account layout (zero-copy, #[repr(C)]), see programs/shielded-pool
// state.rs: 8 disc + 8 next_leaf_index + 640 zeros([[u8;32];20]) +
// 640 filled_subtrees([[u8;32];20]) + 64*32 root_history + u16 head + 6 pad.
const ROOT_HISTORY_OFFSET = 8 + 8 + 640 + 640; // 1296
const ROOT_HISTORY_LEN = 64;

/** Extract the 64-entry root_history ring (hex strings) from raw account data. */
export function parseRootHistory(data: Uint8Array): string[] {
  const end = ROOT_HISTORY_OFFSET + ROOT_HISTORY_LEN * 32;
  if (data.length < end) {
    throw new Error(`parseRootHistory: account too small (${data.length} < ${end})`);
  }
  const roots: string[] = [];
  for (let i = 0; i < ROOT_HISTORY_LEN; i++) {
    const start = ROOT_HISTORY_OFFSET + i * 32;
    roots.push(bytesToHex(data.subarray(start, start + 32)));
  }
  return roots;
}

export interface MerkleSyncResult {
  leaves: string[];       // hex commitments, dense by leaf index
  onChainRoots: string[]; // 64 hex roots from the tree's root_history
}

/**
 * Rebuild the pool's Merkle leaves by replaying Deposit events from RPC, and
 * read the on-chain root_history ring for membership verification. Self-contained
 * (no backend). Scans newest-first via getSignaturesForAddress on the merkle_tree
 * PDA (every deposit writes it), paginating with `before` until exhausted.
 */
export async function syncLeaves(mintBase58: string): Promise<MerkleSyncResult> {
  const connection = getConnection();
  const mint = new PublicKey(mintBase58);
  const tree = merkleTreePda(poolPda(mint));

  const signatures: string[] = [];
  let before: string | undefined;
  while (true) {
    const page = await connection.getSignaturesForAddress(tree, {before, limit: 1000});
    if (page.length === 0) break;
    for (const s of page) if (!s.err) signatures.push(s.signature);
    before = page[page.length - 1]!.signature;
    if (page.length < 1000) break;
  }

  const events: DepositEvent[] = [];
  for (const sig of signatures.reverse()) {
    const tx = await connection.getTransaction(sig, {
      maxSupportedTransactionVersion: 0, commitment: 'confirmed',
    });
    const logs = tx?.meta?.logMessages ?? [];
    events.push(...parseDepositEvents(logs));
  }

  const leaves = orderedLeaves(events);

  const info = await connection.getAccountInfo(tree);
  if (!info) throw new Error('merkleSync: merkle_tree account not found');
  const onChainRoots = parseRootHistory(info.data);

  return {leaves, onChainRoots};
}
