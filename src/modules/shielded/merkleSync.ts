import {PublicKey} from '@solana/web3.js';
import {getConnection} from '../solana/connection';
import {poolPda, merkleTreePda} from './poolPdas';
import {parseDepositEvents} from './depositEvents';
import type {DepositEvent} from './depositEvents';
import {bytesToHex} from './fieldCodec';
import {mmkvPublic} from '../../store/mmkv/instances';
import {computeMerklePath} from '../merkle/merkleModule';

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
/**
 * Merge leaf events into a leafIndex→commitment map, treating a same-index /
 * different-commitment collision as a HARD CONFLICT.
 *
 * The previous `byIndex.set(...)` was last-write-wins, so a contaminated leaf
 * set could reconstruct a correct-looking root purely by iteration order — the
 * real leaf happening to overwrite the foreign one. That is not a validation, it
 * is a coin flip, and it flips the other way as soon as ordering changes.
 * A collision means the leaf set is not exclusively ours; refuse it.
 */
export function mergeLeafEvents(
  byIndex: Map<number, string>,
  events: {leafIndex: number; commitment: string}[],
): void {
  for (const e of events) {
    const existing = byIndex.get(e.leafIndex);
    if (existing !== undefined && existing !== e.commitment) {
      throw new Error(
        `merkleSync: leaf conflict at index ${e.leafIndex} ` +
          `(${existing.slice(0, 8)}… vs ${e.commitment.slice(0, 8)}…) — ` +
          'the scanned leaf set is not exclusively this pool\'s',
      );
    }
    byIndex.set(e.leafIndex, e.commitment);
  }
}

/**
 * Require the rebuilt leaf set to reproduce a root the chain actually attests.
 *
 * This is the invariant everything else is defence-in-depth for. Scoping rules
 * (program id, discriminator, per-instruction merkle account) each close ONE way
 * a wrong leaf gets in or a right leaf gets dropped; this closes all of them at
 * once, including ways nobody has thought of yet, because it checks the RESULT
 * rather than the provenance.
 *
 * It matters that a filter which is too STRICT is as damaging as one that is too
 * loose: the tree is index-ordered, so a single dropped early leaf shifts every
 * later index and invalidates the root for the whole pool, not just that leaf.
 *
 * Membership in the 64-deep ring rather than equality with head, because leaves
 * can land between the signature scan and the account read. A wallet that has
 * been offline long enough for its rebuilt root to age out of the ring will fail
 * here — that is a resync-from-scratch path, not a corruption.
 */
export function assertLeafSetMatchesChain(leaves: string[], onChainRoots: string[]): void {
  if (leaves.length === 0) return;
  const {root} = computeMerklePath(leaves, 0);
  if (!onChainRoots.includes(root)) {
    throw new Error(
      `merkleSync: rebuilt root ${root.slice(0, 12)}… is not in the on-chain ` +
        `root history (${leaves.length} leaves) — the scanned leaf set does not ` +
        'match this pool on chain; refusing to use it',
    );
  }
}

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

  // Parse LeafInserted events from the NEW txs. Fetch in parallel chunks — a
  // sequential scan of a large pool over RPC is the withdraw's main latency;
  // densify is keyed by leaf_index, so fetch order does not matter.
  const newEvents: DepositEvent[] = [];
  const FETCH_CONCURRENCY = 20;
  for (let i = 0; i < newSigs.length; i += FETCH_CONCURRENCY) {
    const chunk = newSigs.slice(i, i + FETCH_CONCURRENCY);
    const txs = await Promise.all(
      chunk.map(sig =>
        connection.getTransaction(sig, {
          maxSupportedTransactionVersion: 0, commitment: 'confirmed',
        }),
      ),
    );
    for (const tx of txs) newEvents.push(...parseDepositEvents(tx, tree.toBase58()));
  }

  // Merge cached leaves (indices 0..N-1) with the new events (by leaf_index).
  const byIndex = new Map<number, string>();
  (cache?.leaves ?? []).forEach((c, i) => byIndex.set(i, c));
  mergeLeafEvents(byIndex, newEvents);

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

  // Fail closed BEFORE the caller can prove against a tree we cannot attest.
  // Previously a contaminated tree only surfaced as an on-chain proof rejection,
  // after a full prove and a burned fee, with an opaque error.
  assertLeafSetMatchesChain(leaves, onChainRoots);

  return {leaves, onChainRoots};
}
