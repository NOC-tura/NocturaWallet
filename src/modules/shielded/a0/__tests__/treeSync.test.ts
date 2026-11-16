/* eslint-disable no-bitwise -- byte edits of recorded transactions and the account */
/**
 * The A0 tree sync against the real 5URd… history (spec §9; §14 JS "the tree sync against the
 * real 5URd… account (a recorded fixture) with root, gap and order controls").
 *
 * The chain is fixtures/devnet-tree-5URd.json (15 transactions, 17 leaves, the account at slot
 * 522620135), served to the REAL web3.js Connection by __testing__/recordedRpc.ts. The roots the
 * sync must reproduce are the chain's: each LeafInserted's root and the account's ring — never a
 * value the code under test produced. Every negative control edits ONE recorded fact and names
 * the check that must fire; each has a positive twin (the unedited chain passes).
 */
import {poseidon2} from 'poseidon-lite';

jest.mock('@solana/web3.js', () =>
  jest.requireActual<typeof import('../__testing__/realWeb3')>('../__testing__/realWeb3').loadRealWeb3(),
);
import {readFileSync} from 'fs';
import {join} from 'path';
import {clearAllStores, initSecureMmkv, mmkvPublic, mmkvSecure} from '../../../../store/mmkv/instances';
import {
  accountBytes,
  appendTopLevelIx,
  blobsOf,
  cloneAsNewest,
  dropSignature,
  freshSignature,
  leafBlob,
  setAccountBytes,
  setBlob,
  txOf,
} from '../__testing__/chainEdits';
import {chainFrom, recordedConnection} from '../__testing__/recordedRpc';
import type {RecordedChain, RecordedFixture} from '../__testing__/recordedRpc';
import {A0, A0_MERKLE_TREE} from '../constants';
import {A0_SYNC_CACHE_SCHEMA, loadA0SyncCache} from '../syncCache';
import {a0MerklePath, syncA0Tree} from '../treeSync';
import type {A0SyncOptions} from '../treeSync';

const TREE = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/devnet-tree-5URd.json'), 'utf8'),
) as RecordedFixture;
const KEY = 'v1_a0_synced_tx';
const fresh = () => chainFrom(TREE);
const sync = (chain: RecordedChain, o: A0SyncOptions = {useCache: false}) =>
  syncA0Tree(recordedConnection(chain).connection, o);

/** The account's ring, decoded independently of treeAccount.ts. */
const ring = (chain: RecordedChain): string[] => {
  const b = accountBytes(chain);
  return Array.from({length: 64}, (_, i) =>
    Buffer.from(b.subarray(1296 + 32 * i, 1296 + 32 * (i + 1))).toString('hex'),
  );
};

/** All LeafInserted blobs of the recorded history, in chain order, decoded independently. */
const recordedLeaves = (chain: RecordedChain): {commitment: string; index: number; root: string}[] =>
  [...chain.signatures]
    .reverse()
    .flatMap(s => blobsOf(chain.transactions[s.signature]!))
    .filter(b => Buffer.from(b.bytes.subarray(0, 8)).toString('hex') === '59f3d408d7bfbb98')
    .map(b => ({
      commitment: Buffer.from(b.bytes.subarray(8, 40)).toString('hex'),
      index: b.bytes[40]!,
      root: Buffer.from(b.bytes.subarray(48, 80)).toString('hex'),
    }));

beforeEach(() => {
  clearAllStores();
});

describe('a full sync of the recorded history', () => {
  it('reproduces the chain: 15 txs, 17 leaves, every event root, the ring at 0..17', async () => {
    const chain = fresh();
    const {tree, stats} = await sync(chain);
    const leaves = recordedLeaves(chain);
    expect(leaves.map(l => l.index)).toEqual([...Array(17).keys()]);
    expect(tree.txs).toHaveLength(15);
    expect(tree.leaves).toEqual(leaves.map(l => l.commitment));
    expect(tree.root).toBe(leaves[16]!.root);
    // The program writes the root after leaf k at ring index k + 1 (head = 17), the empty root at 0.
    expect(ring(chain).slice(0, 18)).toEqual([tree.emptyRoot, ...leaves.map(l => l.root)]);
    expect(tree.account.rootHistory[tree.account.rootHistoryHead]).toBe(tree.root);
    expect(tree.accountSlot).toBe(522620135);
    expect(stats).toMatchObject({
      listedSignatures: 15,
      pages: 1,
      fetchedTransactions: 15,
      failedTransactions: 0,
      cachedTransactions: 0,
      totalTransactions: 15,
      fullResync: false,
    });
  });

  it('the history is in chain order (slot ascending), initialize_pool first', async () => {
    const {tree} = await sync(fresh());
    const slots = tree.txs.map(t => t.slot);
    expect(slots).toEqual([...slots].sort((a, b) => a - b));
    expect(tree.txs[0]!.signature.startsWith('5Yzqozdi')).toBe(true);
    expect(tree.txs[0]!.leafInserted).toEqual([]);
  });

  it('asks only for the tree\'s signatures, each listed tx, and the tree account', async () => {
    const chain = fresh();
    const {connection, requests} = recordedConnection(chain);
    await syncA0Tree(connection, {useCache: false});
    const listed = new Set(chain.signatures.map(s => s.signature));
    expect(new Set(requests.map(r => r.method))).toEqual(
      new Set(['getSignaturesForAddress', 'getTransaction', 'getAccountInfo']),
    );
    for (const r of requests) {
      if (r.method === 'getTransaction') {
        expect(listed.has(r.params[0] as string)).toBe(true);
      } else {
        expect(r.params[0]).toBe(A0.merkleTree);
      }
    }
    expect(requests.filter(r => r.method === 'getTransaction')).toHaveLength(15);
  });

  it('walks pages: limit 4 → 4 pages, `before` = the last signature of the previous page, same tree', async () => {
    const chain = fresh();
    const {connection, requests} = recordedConnection(chain);
    const {tree, stats} = await syncA0Tree(connection, {useCache: false, pageLimit: 4});
    const walks = requests.filter(r => r.method === 'getSignaturesForAddress');
    expect(stats.pages).toBe(4);
    expect(walks.map(w => (w.params[1] as {before?: string}).before)).toEqual([
      undefined,
      chain.signatures[3]!.signature,
      chain.signatures[7]!.signature,
      chain.signatures[11]!.signature,
    ]);
    expect(tree.root).toBe((await sync(fresh())).tree.root);
  });

  it('a page walk ending exactly on a full page asks once more and stops on the empty page', async () => {
    const {stats} = await sync(fresh(), {useCache: false, pageLimit: 5});
    expect(stats.pages).toBe(4); // 5, 5, 5, 0
  });
});

describe('a0MerklePath', () => {
  it('every leaf\'s path folds to the verified root — checked here with poseidon-lite directly', async () => {
    const {tree} = await sync(fresh());
    for (let i = 0; i < tree.leaves.length; i++) {
      const p = a0MerklePath(tree, i);
      expect(p.root).toBe(tree.root);
      expect(p.leaf).toBe(tree.leaves[i]);
      expect(p.pathElements).toHaveLength(20);
      expect(p.pathIndices).toEqual(Array.from({length: 20}, (_, k) => (i >> k) & 1));
      let cur = BigInt(`0x${p.leaf}`);
      p.pathElements.forEach((s, k) => {
        const sib = BigInt(`0x${s}`);
        cur = p.pathIndices[k] ? poseidon2([sib, cur]) : poseidon2([cur, sib]);
      });
      expect(cur.toString(16).padStart(64, '0')).toBe(tree.root);
    }
  });

  it('refuses a leaf outside the tree', async () => {
    const {tree} = await sync(fresh());
    expect(() => a0MerklePath(tree, 17)).toThrow(RangeError);
    expect(() => a0MerklePath(tree, -1)).toThrow(RangeError);
  });
});

describe('negative controls — each refused with its own check', () => {
  const refused = (chain: RecordedChain, code: string) => expect(sync(chain)).rejects.toMatchObject({code});

  it('positive twin: the unedited chain passes', async () => {
    await expect(sync(fresh())).resolves.toBeTruthy();
  });

  it('a reordered leaf (two deposits\' slots swapped) → E_A0_LEAF_ORDER', async () => {
    const chain = fresh();
    const a = txOf(chain, '34PZJ1vg').tx; // leaf 5
    const b = txOf(chain, '2Pis4qYC').tx; // leaf 7
    [a.slot, b.slot] = [b.slot, a.slot];
    await refused(chain, 'E_A0_LEAF_ORDER');
  });

  it('a gap (one deposit missing from the list) → E_A0_LEAF_ORDER', async () => {
    const chain = fresh();
    dropSignature(chain, txOf(chain, 'a7wDRKqv').sig); // leaf 2
    await refused(chain, 'E_A0_LEAF_ORDER');
  });

  it('a wrong event root on a middle leaf (the final root still in the ring) → E_A0_LEAF_ROOT', async () => {
    const chain = fresh();
    const tx = txOf(chain, '34PZJ1vg').tx;
    const [b] = blobsOf(tx);
    const bytes = Uint8Array.from(b!.bytes);
    bytes[79] ^= 1;
    setBlob(tx, b!.line, bytes);
    await refused(chain, 'E_A0_LEAF_ROOT');
  });

  it('a changed commitment → E_A0_LEAF_ROOT', async () => {
    const chain = fresh();
    const tx = txOf(chain, '3DR6F7oW').tx;
    const [b] = blobsOf(tx);
    const bytes = Uint8Array.from(b!.bytes);
    bytes[39] ^= 1;
    setBlob(tx, b!.line, bytes);
    await refused(chain, 'E_A0_LEAF_ROOT');
  });

  it('a commitment ≥ r → E_A0_FIELD', async () => {
    const chain = fresh();
    const tx = txOf(chain, '3DR6F7oW').tx;
    const [b] = blobsOf(tx);
    const bytes = Uint8Array.from(b!.bytes);
    bytes.fill(0xff, 8, 40);
    setBlob(tx, b!.line, bytes);
    await refused(chain, 'E_A0_FIELD');
  });

  it('the final root not in the ring → E_A0_ROOT_HISTORY', async () => {
    const chain = fresh();
    const b = accountBytes(chain);
    b.fill(0, 1296 + 32, 1296 + 64 * 32); // keep only the empty root
    setAccountBytes(chain, b);
    await refused(chain, 'E_A0_ROOT_HISTORY');
  });

  it('the final root not in the ring while a later leaf landed (count 18: the head check does not apply) → E_A0_ROOT_HISTORY', async () => {
    const chain = fresh();
    const b = accountBytes(chain);
    b[8] = 18;
    b.fill(0, 1296 + 32, 1296 + 64 * 32);
    setAccountBytes(chain, b);
    await refused(chain, 'E_A0_ROOT_HISTORY');
  });

  it('the root in the ring but not at its head, at the account\'s leaf count → E_A0_ROOT_HEAD', async () => {
    const chain = fresh();
    const b = accountBytes(chain);
    b[3344] = 16; // head one back
    setAccountBytes(chain, b);
    await refused(chain, 'E_A0_ROOT_HEAD');
  });

  it('filled subtrees that differ from ours, at the account\'s leaf count → E_A0_SUBTREES', async () => {
    const chain = fresh();
    const b = accountBytes(chain);
    b[656 + 31] ^= 1;
    setAccountBytes(chain, b);
    await refused(chain, 'E_A0_SUBTREES');
  });

  it.each([0, 5, 19])('zeros[%i] differing from ours → E_A0_ZEROS', async i => {
    const chain = fresh();
    const b = accountBytes(chain);
    b[16 + i * 32 + 31] ^= 1;
    setAccountBytes(chain, b);
    await refused(chain, 'E_A0_ZEROS');
  });

  it('more leaves than the account has inserted → E_A0_LEAF_COUNT', async () => {
    const chain = fresh();
    const b = accountBytes(chain);
    b[8] = 16;
    setAccountBytes(chain, b);
    await refused(chain, 'E_A0_LEAF_COUNT');
  });

  it('POSITIVE: a leaf landed after the walk (account at 18, ring unchanged) is accepted, checks 1–5 only', async () => {
    const chain = fresh();
    const b = accountBytes(chain);
    b[8] = 18;
    b.fill(0, 656, 656 + 640); // subtrees moved on; not compared below the account's count
    setAccountBytes(chain, b);
    await expect(sync(chain)).resolves.toBeTruthy();
  });

  it('a truncated LeafInserted from the pool → E_A0_EVENT_LENGTH', async () => {
    const chain = fresh();
    const tx = txOf(chain, '5rUv5E31').tx;
    const [b] = blobsOf(tx);
    setBlob(tx, b!.line, b!.bytes.subarray(0, 79));
    await refused(chain, 'E_A0_EVENT_LENGTH');
  });

  it('the tree account absent (another cluster) → E_A0_TREE_MISSING; owned by another program → E_A0_TREE_LAYOUT', async () => {
    const gone = fresh();
    gone.account.value = null;
    await refused(gone, 'E_A0_TREE_MISSING');
    const foreign = fresh();
    foreign.account.value!.owner = 'Stake11111111111111111111111111111111111111';
    await refused(foreign, 'E_A0_TREE_LAYOUT');
  });

  it('R1-I1 probe: a FeGSS… ix on 5vWuKtLF… with accounts [vault, pool, 5URd…] and a LeafInserted at leaf 0 — not admitted, the sync verifies', async () => {
    const chain = fresh();
    const {sig, tx} = txOf(chain, '5vWuKtLF');
    appendTopLevelIx(tx, {
      program: A0.programId,
      accounts: [A0.vault, A0.pool, A0.merkleTree],
      data: new Uint8Array(8),
      blobs: [leafBlob('59f3d408d7bfbb98', '01'.repeat(32), 0, '02'.repeat(32))],
    });
    const {tree} = await sync(chain);
    expect(tree.txs.find(t => t.signature === sig)!.leafInserted.map(l => l.leafIndex)).toEqual([14]);
    expect(tree.leaves).toHaveLength(17);
  });

  it('R1-I1 POSITIVE CONTROL: the same blob from [pool, 5URd…, vault] is admitted — and its leaf 0 refuses the sync', async () => {
    const chain = fresh();
    appendTopLevelIx(txOf(chain, '5vWuKtLF').tx, {
      program: A0.programId,
      accounts: [A0.pool, A0.merkleTree, A0.vault],
      data: new Uint8Array(8),
      blobs: [leafBlob('59f3d408d7bfbb98', '01'.repeat(32), 0, '02'.repeat(32))],
    });
    await refused(chain, 'E_A0_LEAF_ORDER');
  });

  it('a listed signature the RPC does not return → E_A0_TX_MISSING', async () => {
    const chain = fresh();
    delete chain.transactions[txOf(chain, '2Pis4qYC').sig];
    await refused(chain, 'E_A0_TX_MISSING');
  });
});

describe('failed transactions are not kept', () => {
  /** A copy of the last deposit landing as the newest tx, its leaf forged as leaf 17. */
  const forgedNewest = (meta: unknown, listErr: unknown) => {
    const chain = fresh();
    const tx = cloneAsNewest(chain, txOf(chain, '5vWuKtLF').tx, freshSignature(1), 530000000, listErr);
    tx.meta.err = meta;
    const [b] = blobsOf(tx);
    const bytes = Uint8Array.from(b!.bytes);
    bytes[40] = 17;
    setBlob(tx, b!.line, bytes);
    return chain;
  };
  const FAILED = {InstructionError: [1, {Custom: 1}]};

  it('POSITIVE CONTROL: the same tx as a success is admitted — its forged leaf 17 then refuses the sync', async () => {
    await expect(sync(forgedNewest(null, null))).rejects.toMatchObject({code: 'E_A0_LEAF_ROOT'});
  });

  it('failed per meta.err (the list says success): fetched, not kept, the sync passes', async () => {
    const {tree, stats} = await sync(forgedNewest(FAILED, null));
    expect(tree.leaves).toHaveLength(17);
    expect(tree.txs).toHaveLength(15);
    expect(stats.fetchedTransactions).toBe(16);
    expect(stats.failedTransactions).toBe(1);
  });

  it('failed per the list: not even fetched', async () => {
    const chain = forgedNewest(FAILED, FAILED);
    const {connection, requests} = recordedConnection(chain);
    const {tree} = await syncA0Tree(connection, {useCache: false});
    expect(tree.leaves).toHaveLength(17);
    expect(requests.some(r => r.method === 'getTransaction' && r.params[0] === chain.signatures[0]!.signature)).toBe(false);
  });

  it('a recorded deposit marked failed loses its leaf → the gap refuses (meta.err is honoured)', async () => {
    const chain = fresh();
    txOf(chain, '4vConh8x').tx.meta.err = FAILED; // leaf 10
    await expect(sync(chain)).rejects.toMatchObject({code: 'E_A0_LEAF_ORDER'});
  });
});

describe('incremental sync and the encrypted cache', () => {
  /** The chain as it was after its oldest `n` signatures (the account as recorded: a later ring holds older roots). */
  const upTo = (n: number) => {
    const chain = fresh();
    chain.signatures = chain.signatures.slice(chain.signatures.length - n);
    return chain;
  };

  it('caches in the ENCRYPTED instance, schema 1, nothing in the public one', async () => {
    initSecureMmkv('test-key');
    await sync(fresh(), {});
    const raw = mmkvSecure()!.getString(KEY)!;
    expect(JSON.parse(raw)).toMatchObject({schema: A0_SYNC_CACHE_SCHEMA, programId: A0.programId, tree: A0.merkleTree});
    expect(mmkvPublic.getAllKeys()).toEqual([]);
    expect(loadA0SyncCache()!.txs).toHaveLength(15);
    expect(loadA0SyncCache()!.cursor).toBe(TREE.signatures[0]!.signature);
  });

  it('the cache round-trips every field (BigInt included)', async () => {
    initSecureMmkv('test-key');
    const {tree} = await sync(fresh(), {});
    expect(loadA0SyncCache()!.txs).toEqual(tree.txs);
  });

  it('without the encrypted instance: a full sync, nothing written anywhere', async () => {
    await sync(fresh(), {});
    expect(mmkvSecure()).toBeNull();
    expect(mmkvPublic.getAllKeys()).toEqual([]);
  });

  it('second run: only the newer signatures (`until` = the cursor), same verified tree', async () => {
    initSecureMmkv('test-key');
    await sync(upTo(9), {});
    expect(loadA0SyncCache()!.cursor).toBe(TREE.signatures[6]!.signature);
    const chain = fresh();
    const {connection, requests} = recordedConnection(chain);
    const {tree, stats} = await syncA0Tree(connection, {});
    expect((requests[0]!.params[1] as {until?: string}).until).toBe(TREE.signatures[6]!.signature);
    expect(requests.filter(r => r.method === 'getTransaction').map(r => r.params[0])).toEqual(
      TREE.signatures.slice(0, 6).map(s => s.signature),
    );
    expect(stats).toMatchObject({listedSignatures: 6, fetchedTransactions: 6, cachedTransactions: 9, totalTransactions: 15});
    expect(tree.root).toBe((await sync(fresh())).tree.root);
    expect(loadA0SyncCache()!.cursor).toBe(TREE.signatures[0]!.signature);
  });

  it('a confirmed-but-not-finalized tail is never cached, and is fetched again next time', async () => {
    initSecureMmkv('test-key');
    const chain = fresh();
    chain.signatures[0]!.confirmationStatus = 'confirmed';
    chain.signatures[1]!.confirmationStatus = 'confirmed';
    await sync(chain, {});
    const c = loadA0SyncCache()!;
    expect(c.cursor).toBe(TREE.signatures[2]!.signature);
    expect(c.txs.map(t => t.signature)).not.toContain(TREE.signatures[0]!.signature);
    expect(c.txs).toHaveLength(13);
    const {connection, requests} = recordedConnection(fresh());
    await syncA0Tree(connection, {});
    expect(requests.filter(r => r.method === 'getTransaction')).toHaveLength(2);
  });

  it('a cache of another schema, or one that does not decode, is ignored (a full walk, no `until`)', async () => {
    initSecureMmkv('test-key');
    for (const bad of [
      JSON.stringify({schema: 2, programId: A0.programId, tree: A0.merkleTree, cursor: TREE.signatures[0]!.signature, txs: []}),
      '{"schema":1,',
      JSON.stringify({schema: 1, programId: A0.programId, tree: A0.merkleTree, cursor: TREE.signatures[0]!.signature, txs: [{signature: 'x'}]}),
    ]) {
      mmkvSecure()!.set(KEY, bad);
      const {connection, requests} = recordedConnection(fresh());
      const {stats} = await syncA0Tree(connection, {});
      expect((requests[0]!.params[1] as {until?: string}).until).toBeUndefined();
      expect(stats.totalTransactions).toBe(15);
    }
  });

  it('a cached leaf that no longer reproduces the chain: the cache is cleared and ONE full sync replaces it', async () => {
    initSecureMmkv('test-key');
    await sync(upTo(9), {});
    const raw = JSON.parse(mmkvSecure()!.getString(KEY)!) as {txs: {leafInserted: {commitment: string}[]}[]};
    const withLeaf = raw.txs.find(t => t.leafInserted.length > 0)!;
    withLeaf.leafInserted[0]!.commitment = '00'.repeat(31) + '01';
    mmkvSecure()!.set(KEY, JSON.stringify(raw));
    const {connection, requests} = recordedConnection(fresh());
    const {tree, stats} = await syncA0Tree(connection, {});
    expect(stats.fullResync).toBe(true);
    expect(tree.leaves).toHaveLength(17);
    const walks = requests.filter(r => r.method === 'getSignaturesForAddress');
    expect((walks[0]!.params[1] as {until?: string}).until).toBeDefined();
    expect((walks[walks.length - 1]!.params[1] as {until?: string}).until).toBeUndefined();
    expect(loadA0SyncCache()!.txs).toEqual(tree.txs);
  });

  it('useCache: false neither reads nor writes', async () => {
    initSecureMmkv('test-key');
    await sync(fresh(), {useCache: false});
    expect(mmkvSecure()!.getString(KEY)).toBeUndefined();
  });

  it('the depth / ring constants the sync uses are the program side\'s facts', () => {
    expect(A0_MERKLE_TREE).toMatchObject({size: 3352, depth: 20, rootHistoryLen: 64});
  });
});
