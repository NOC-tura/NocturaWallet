import {PublicKey} from '@solana/web3.js';
import {getConnection} from '../solana/connection';
import {poolPda, merkleTreePda} from './poolPdas';
import {parseDepositEvents} from './depositEvents';
import type {DepositEvent} from './depositEvents';
import {bytesToHex} from './fieldCodec';
import {mmkvPublic} from '../../store/mmkv/instances';

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

// ---- Incremental sync cache ------------------------------------------------
// Leaves are PUBLIC commitments, so the cache lives in the unencrypted public
// MMKV. Keyed by mint. Re-scanning the whole pool history every unshield is slow
// on a rate-limited RPC and grows unbounded; caching the ordered leaves + the
// newest scanned signature lets each subsequent sync fetch only NEW events.
const SYNC_CACHE_PREFIX = 'shielded.syncCache.';

interface SyncCache {
  leaves: string[]; // dense by leaf index
  lastSig: string;  // newest signature already folded into `leaves`
}

function loadCache(mint: string): SyncCache | null {
  const raw = mmkvPublic.getString(SYNC_CACHE_PREFIX + mint);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SyncCache;
    if (!Array.isArray(parsed.leaves) || typeof parsed.lastSig !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(mint: string, cache: SyncCache): void {
  mmkvPublic.set(SYNC_CACHE_PREFIX + mint, JSON.stringify(cache));
}

function clearCache(mint: string): void {
  mmkvPublic.remove(SYNC_CACHE_PREFIX + mint);
}

/**
 * Densify a leafIndex→commitment map into a contiguous [0..max] array. Derives
 * the expected count from the MAX index (not the map size) so a duplicated index
 * cannot mask a real gap. Throws on any gap.
 */
export function densifyLeaves(byIndex: Map<number, string>): string[] {
  if (byIndex.size === 0) return [];
  const max = Math.max(...byIndex.keys());
  const leaves: string[] = [];
  for (let i = 0; i <= max; i++) {
    const c = byIndex.get(i);
    if (c === undefined) throw new Error(`merkleSync: gap at leaf index ${i}`);
    leaves.push(c);
  }
  return leaves;
}

/**
 * Rebuild the pool's Merkle leaves by replaying `LeafInserted` (formerly
 * `Deposit`) events from RPC, and read the on-chain root_history ring for
 * membership verification. Self-contained (no backend).
 *
 * INCREMENTAL: only signatures NEWER than the cached `lastSig` are fetched
 * (getSignaturesForAddress `until`), their events merged onto the cached leaves.
 * A first sync (no cache) scans the full history. A detected gap (corrupted
 * cache) clears the cache and does one full resync.
 */
export async function syncLeaves(mintBase58: string): Promise<MerkleSyncResult> {
  const connection = getConnection();
  const mint = new PublicKey(mintBase58);
  const tree = merkleTreePda(poolPda(mint));

  const cache = loadCache(mintBase58);

  // Collect signatures newer than the cached lastSig (full history if no cache),
  // newest-first across pages. The newest signature overall becomes the new cursor.
  const newSigs: string[] = [];
  let newestSig: string | undefined = cache?.lastSig;
  let capturedNewest = false;
  let before: string | undefined;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await connection.getSignaturesForAddress(tree, {
      before, until: cache?.lastSig, limit: 1000,
    });
    if (page.length === 0) break;
    if (!capturedNewest) {
      newestSig = page[0]!.signature; // newest scanned position (cursor for next time)
      capturedNewest = true;
    }
    for (const s of page) if (!s.err) newSigs.push(s.signature);
    before = page[page.length - 1]!.signature;
    if (page.length < 1000) break;
  }

  // Parse LeafInserted events from the NEW txs (oldest-first for stable order).
  const newEvents: DepositEvent[] = [];
  for (const sig of newSigs.reverse()) {
    const tx = await connection.getTransaction(sig, {
      maxSupportedTransactionVersion: 0, commitment: 'confirmed',
    });
    newEvents.push(...parseDepositEvents(tx?.meta?.logMessages ?? []));
  }

  // Merge cached leaves (indices 0..N-1) with the new events (by leaf_index).
  const byIndex = new Map<number, string>();
  (cache?.leaves ?? []).forEach((c, i) => byIndex.set(i, c));
  for (const e of newEvents) byIndex.set(e.leafIndex, e.commitment);

  let leaves: string[];
  try {
    leaves = densifyLeaves(byIndex);
  } catch (err) {
    // Inconsistent/corrupted cache → clear and do ONE full resync.
    if (cache) {
      clearCache(mintBase58);
      return syncLeaves(mintBase58);
    }
    throw err;
  }

  if (newestSig) saveCache(mintBase58, {leaves, lastSig: newestSig});

  const info = await connection.getAccountInfo(tree);
  if (!info) throw new Error('merkleSync: merkle_tree account not found');
  const onChainRoots = parseRootHistory(info.data);

  return {leaves, onChainRoots};
}
