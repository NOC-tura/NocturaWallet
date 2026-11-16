/* eslint-disable no-bitwise -- the incremental Merkle insert is bit arithmetic on the leaf index */
/**
 * The A0 tree sync (spec §9): the pool's whole history, read the same way by every client, and
 * verified against the chain before any path is built from it.
 *
 * SOURCE. Every transaction that touches MerkleTree 5URd…: one `getSignaturesForAddress` page
 * walk (newest first, `before` = the last signature of a full page, `until` = the cache's
 * cursor) and one `getTransaction` per listed signature the list does not mark failed. Nothing
 * in these requests depends on which notes are ours (I-3); incremental sync only shortens the
 * walk, and is still the same request for everyone.
 *
 * CHECKS — on any mismatch the sync throws an `A0SyncError` and returns nothing, so no caller
 * can build a path from a history it could not reproduce:
 *   1. zeros: ours (Z[0] = 0, Z[i] = Poseidon2(Z[i-1], Z[i-1]), `fieldEquations.emptySubtreeRoots`)
 *      equal the account's zeros @16, all twenty; the empty root is one level above;
 *   2. order: in chain order (slot ascending), the admitted LeafInserted events carry leaf
 *      indices exactly 0, 1, 2, … — no gap, no repeat, no reordering;
 *   3. every commitment and root is a canonical field element (< r);
 *   4. the incremental root after each leaf (the program's own insert: filled subtrees, untagged
 *      Poseidon2 nodes, depth 20) equals that event's root;
 *   5. no more leaves than the account's nextLeafIndex, and the final root (the empty root when
 *      there is no leaf) is in the account's 64-entry rootHistory;
 *   6. when our leaf count equals nextLeafIndex (no leaf landed between the walk and the account
 *      read), the root at rootHistoryHead is ours and the account's filled subtrees @656 equal
 *      ours — the snapshot then pins the whole insert state, not only one root.
 *
 * CACHE. A run starts from the encrypted cache (syncCache.ts) when there is one. If a run that
 * used the cache fails a check, the cache is cleared and ONE full run follows; if that fails
 * too, the error stands.
 */
import {PublicKey} from '@solana/web3.js';
import type {Connection, ConfirmedSignatureInfo} from '@solana/web3.js';
import {computeMerklePath} from '../../merkle/merkleModule';
import {withTimeout} from '../../solana/withTimeout';
import {A0, A0_MERKLE_TREE} from './constants';
import {FIELD_MODULUS, emptySubtreeRoots, merkleNode, toBe32Hex} from './fieldEquations';
import {clearA0SyncCache, loadA0SyncCache, saveA0SyncCache} from './syncCache';
import type {A0SyncCache} from './syncCache';
import {parseA0SyncedTx} from './syncedTx';
import type {A0SyncedTx} from './syncedTx';
import {A0SyncError} from './syncErrors';
import {parseA0TreeAccount} from './treeAccount';
import type {A0TreeAccount} from './treeAccount';

declare const verifiedBrand: unique symbol;

/** A history that passed every check of §9 against one account snapshot. Only `verifyA0Tree` makes one. */
export interface A0VerifiedTree {
  /** the successful transactions touching the tree, in chain order (oldest first) */
  readonly txs: readonly A0SyncedTx[];
  /** commitments, 64-char BE hex, index = leaf index */
  readonly leaves: readonly string[];
  /** our root after the last leaf (the empty root when there is none) — in the account's rootHistory */
  readonly root: string;
  readonly emptyRoot: string;
  readonly account: A0TreeAccount;
  /** the slot of the account snapshot the history was checked against */
  readonly accountSlot: number;
  readonly [verifiedBrand]: true;
}

/** A Merkle path for one leaf of a verified tree (the witness's `merkleRoot`, `pathElements`, `pathIndices`). */
export interface A0MerklePath {
  leafIndex: number;
  /** the leaf's commitment */
  leaf: string;
  /** = the verified tree's root */
  root: string;
  /** 20 siblings, level 0 first, 64-char BE hex */
  pathElements: string[];
  /** 20 bits, level 0 first: 0 = the node is a left child */
  pathIndices: number[];
}

/** R13's numbers and what the run did. */
export interface A0SyncStats {
  /** signatures listed by this run's walk (newer than the cursor) */
  listedSignatures: number;
  /** getSignaturesForAddress pages walked */
  pages: number;
  /** getTransaction requests made */
  fetchedTransactions: number;
  /** listed signatures the list marked failed (not fetched) plus fetched ones whose meta.err was set */
  failedTransactions: number;
  /** successful transactions taken from the cache */
  cachedTransactions: number;
  /** successful transactions in the verified history */
  totalTransactions: number;
  /** true when a cached run failed a check and a full run replaced it */
  fullResync: boolean;
  durationMs: number;
}

export interface A0TreeSync {
  tree: A0VerifiedTree;
  stats: A0SyncStats;
}

export interface A0SyncOptions {
  /** getSignaturesForAddress page size (the RPC's maximum is 1000) */
  pageLimit?: number;
  /** getTransaction requests in flight at once */
  concurrency?: number;
  /** per-request timeout (React Native's fetch has none) */
  timeoutMs?: number;
  /** false: neither read nor write the cache */
  useCache?: boolean;
}

const fe = (h: string, what: string): bigint => {
  const v = BigInt(`0x${h}`);
  if (v >= FIELD_MODULUS) {
    throw new A0SyncError('E_A0_FIELD', `${what} ${h} is not below the BN254 scalar field order`);
  }
  return v;
};

/** Order successful records by slot, keeping the given order within a slot (stable sort). */
const chainOrder = (txs: readonly A0SyncedTx[]): A0SyncedTx[] =>
  txs
    .map((tx, i) => ({tx, i}))
    .sort((a, b) => a.tx.slot - b.tx.slot || a.i - b.i)
    .map(x => x.tx);

/**
 * Check a history against one account snapshot (the checks 1–6 above). Pure; throws
 * `A0SyncError` on the first mismatch. `txs` may come in any order; the result is in chain order.
 */
export function verifyA0Tree(
  txs: readonly A0SyncedTx[],
  account: A0TreeAccount,
  accountSlot: number,
): A0VerifiedTree {
  const depth = A0_MERKLE_TREE.depth;
  const z = emptySubtreeRoots(depth);
  for (let i = 0; i < depth; i++) {
    if (account.zeros[i] !== toBe32Hex(z[i]!)) {
      throw new A0SyncError(
        'E_A0_ZEROS',
        `zeros[${i}]: ours ${toBe32Hex(z[i]!)}, the account's ${account.zeros[i]}`,
      );
    }
  }
  const emptyRoot = toBe32Hex(z[depth]!);

  const ordered = chainOrder(txs);
  const seen = new Set<string>();
  const filled: bigint[] = z.slice(0, depth);
  const leaves: string[] = [];
  let root = emptyRoot;
  for (const tx of ordered) {
    if (seen.has(tx.signature)) {
      throw new A0SyncError('E_A0_LEAF_ORDER', `${tx.signature} appears twice in the history`);
    }
    seen.add(tx.signature);
    for (const ev of tx.leafInserted) {
      if (ev.leafIndex !== leaves.length) {
        throw new A0SyncError(
          'E_A0_LEAF_ORDER',
          `${tx.signature}: leaf_index ${ev.leafIndex} where ${leaves.length} comes next`,
        );
      }
      let cur = fe(ev.commitment, 'commitment');
      const eventRoot = fe(ev.root, 'root');
      let idx = ev.leafIndex;
      for (let i = 0; i < depth; i++) {
        if ((idx & 1) === 0) {
          filled[i] = cur;
          cur = merkleNode(cur, z[i]!);
        } else {
          cur = merkleNode(filled[i]!, cur);
        }
        idx >>= 1;
      }
      if (cur !== eventRoot) {
        throw new A0SyncError(
          'E_A0_LEAF_ROOT',
          `${tx.signature}: after leaf ${ev.leafIndex} our root is ${toBe32Hex(cur)}, the event's ${ev.root}`,
        );
      }
      leaves.push(ev.commitment);
      root = ev.root;
    }
  }

  if (leaves.length > account.nextLeafIndex) {
    throw new A0SyncError(
      'E_A0_LEAF_COUNT',
      `${leaves.length} leaves synced, the account has inserted ${account.nextLeafIndex}`,
    );
  }
  if (!account.rootHistory.includes(root)) {
    throw new A0SyncError(
      'E_A0_ROOT_HISTORY',
      `our root ${root} (${leaves.length} leaves) is not in the account's rootHistory`,
    );
  }
  if (leaves.length === account.nextLeafIndex) {
    if (account.rootHistory[account.rootHistoryHead] !== root) {
      throw new A0SyncError(
        'E_A0_ROOT_HEAD',
        `at ${leaves.length} leaves the account's newest root is ${account.rootHistory[account.rootHistoryHead]}, ours ${root}`,
      );
    }
    for (let i = 0; i < depth; i++) {
      if (account.filledSubtrees[i] !== toBe32Hex(filled[i]!)) {
        throw new A0SyncError(
          'E_A0_SUBTREES',
          `filled_subtrees[${i}]: ours ${toBe32Hex(filled[i]!)}, the account's ${account.filledSubtrees[i]}`,
        );
      }
    }
  }

  return Object.freeze({
    txs: Object.freeze(ordered),
    leaves: Object.freeze(leaves),
    root,
    emptyRoot,
    account,
    accountSlot,
  }) as unknown as A0VerifiedTree;
}

/**
 * The path of `leafIndex` in a verified tree, from the kept dense-layer builder
 * (`merkleModule.computeMerklePath`, depth 20, untagged Poseidon2) and refused unless it reaches
 * the verified root — and unless folding the leaf up its own path with `fieldEquations.merkleNode`
 * reaches it too.
 */
export function a0MerklePath(tree: A0VerifiedTree, leafIndex: number): A0MerklePath {
  if (!Number.isInteger(leafIndex) || leafIndex < 0 || leafIndex >= tree.leaves.length) {
    throw new RangeError(`a0MerklePath: leaf ${leafIndex} is not in the tree (${tree.leaves.length} leaves)`);
  }
  const {root, siblings, pathIndices} = computeMerklePath([...tree.leaves], leafIndex);
  let cur = BigInt(`0x${tree.leaves[leafIndex]}`);
  for (let i = 0; i < siblings.length; i++) {
    const s = BigInt(`0x${siblings[i]}`);
    cur = pathIndices[i] === 1 ? merkleNode(s, cur) : merkleNode(cur, s);
  }
  if (root !== tree.root || toBe32Hex(cur) !== tree.root || siblings.length !== A0_MERKLE_TREE.depth) {
    throw new A0SyncError(
      'E_A0_LEAF_ROOT',
      `the path of leaf ${leafIndex} reaches ${root} / ${toBe32Hex(cur)}, not the verified root ${tree.root}`,
    );
  }
  return {
    leafIndex,
    leaf: tree.leaves[leafIndex]!,
    root: tree.root,
    pathElements: siblings,
    pathIndices,
  };
}

interface RunResult {
  sync: A0TreeSync;
  /** what to cache, or null when nothing new is finalized */
  cache: A0SyncCache | null;
}

async function run(
  connection: Connection,
  cache: A0SyncCache | null,
  o: Required<A0SyncOptions>,
  started: number,
): Promise<RunResult> {
  const tree = new PublicKey(A0.merkleTree);
  const timed = <T>(p: Promise<T>, label: string) => withTimeout(p, o.timeoutMs, label);

  // 1. The walk, newest first.
  const listed: ConfirmedSignatureInfo[] = [];
  let before: string | undefined;
  let pages = 0;
  for (;;) {
    const page = await timed(
      connection.getSignaturesForAddress(
        tree,
        {
          limit: o.pageLimit,
          ...(before ? {before} : {}),
          ...(cache ? {until: cache.cursor} : {}),
        },
        'confirmed',
      ),
      'getSignaturesForAddress',
    );
    pages++;
    listed.push(...page);
    if (page.length < o.pageLimit) {
      break;
    }
    before = page[page.length - 1]!.signature;
  }

  // 2. Every listed signature the list does not mark failed, fetched in full.
  const wanted = listed.filter(s => s.err === null);
  const fetched: (A0SyncedTx | null)[] = [];
  for (let i = 0; i < wanted.length; i += o.concurrency) {
    const chunk = wanted.slice(i, i + o.concurrency);
    const answers = await Promise.all(
      chunk.map(s =>
        timed(
          connection.getTransaction(s.signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
          }),
          'getTransaction',
        ),
      ),
    );
    answers.forEach((tx, j) => {
      const sig = chunk[j]!.signature;
      if (!tx) {
        throw new A0SyncError('E_A0_TX_MISSING', `${sig} was listed but getTransaction returned nothing`);
      }
      fetched.push(parseA0SyncedTx(sig, tx));
    });
  }
  const newTxs = fetched.filter((t): t is A0SyncedTx => t !== null).reverse();

  // 3. The account, after the walk: a leaf landing in between leaves our root older, still in the ring.
  const info = await timed(connection.getAccountInfoAndContext(tree, 'confirmed'), 'getAccountInfo');
  if (!info.value) {
    throw new A0SyncError('E_A0_TREE_MISSING', `${A0.merkleTree} does not exist on this cluster`);
  }
  if (info.value.owner.toBase58() !== A0.programId) {
    throw new A0SyncError('E_A0_TREE_LAYOUT', `${A0.merkleTree} is owned by ${info.value.owner.toBase58()}`);
  }
  const account = parseA0TreeAccount(new Uint8Array(info.value.data));
  const verified = verifyA0Tree([...(cache?.txs ?? []), ...newTxs], account, info.context.slot);

  // 4. The finalized prefix becomes the cache: walk the list from its oldest end.
  let k = listed.length;
  while (k > 0 && listed[k - 1]!.confirmationStatus === 'finalized') {
    k--;
  }
  let nextCache: A0SyncCache | null = null;
  if (k < listed.length) {
    const unsettled = new Set(listed.slice(0, k).map(s => s.signature));
    nextCache = {
      cursor: listed[k]!.signature,
      txs: verified.txs.filter(t => !unsettled.has(t.signature)),
    };
  }

  return {
    sync: {
      tree: verified,
      stats: {
        listedSignatures: listed.length,
        pages,
        fetchedTransactions: wanted.length,
        failedTransactions: listed.length - newTxs.length,
        cachedTransactions: cache?.txs.length ?? 0,
        totalTransactions: verified.txs.length,
        fullResync: false,
        durationMs: Date.now() - started,
      },
    },
    cache: nextCache,
  };
}

/**
 * Sync and verify the A0 tree (spec §9). `connection` is the app's (`getConnection()`); the
 * devnet build's points at devnet — on another cluster the tree account is absent and the sync
 * refuses (`E_A0_TREE_MISSING`).
 */
export async function syncA0Tree(
  connection: Connection,
  options: A0SyncOptions = {},
): Promise<A0TreeSync> {
  const o: Required<A0SyncOptions> = {
    pageLimit: options.pageLimit ?? 1000,
    concurrency: options.concurrency ?? 8,
    timeoutMs: options.timeoutMs ?? 20_000,
    useCache: options.useCache ?? true,
  };
  const started = Date.now();
  const cache = o.useCache ? loadA0SyncCache() : null;
  let result: RunResult;
  let fullResync = false;
  try {
    result = await run(connection, cache, o, started);
  } catch (err) {
    if (!(cache && err instanceof A0SyncError)) {
      throw err;
    }
    clearA0SyncCache();
    fullResync = true;
    result = await run(connection, null, o, started);
  }
  if (o.useCache && result.cache) {
    saveA0SyncCache(result.cache);
  }
  result.sync.stats.fullResync = fullResync;
  result.sync.stats.durationMs = Date.now() - started;
  return result.sync;
}
