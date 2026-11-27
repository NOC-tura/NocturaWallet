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
import {liveDevnet} from '../__testing__/liveDevnet';
import {
  chainFrom,
  RECORDED_MAX_TX_VERSION,
  recordedConnection,
  UNSUPPORTED_V1_ERROR,
} from '../__testing__/recordedRpc';
import type {RecordedChain, RecordedFixture, RecordedTx} from '../__testing__/recordedRpc';
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

/**
 * Version-1 transactions. The node refuses one (error -32015) to a client that asks with
 * `maxSupportedTransactionVersion: 0`, and anyone can land a successful v1 transaction that
 * lists 5URd… — so a sync asking with 0 would be stopped for every wallet by one stranger's tx.
 *
 * fixtures/devnet-v1-tx-4T9Juo9P.json is a real devnet v1 transaction, both answers verbatim:
 * `max0` (the -32015 error) and `max1` (the transaction, `version: 1`, a `transactionConfig` in
 * the message, no address table lookups). No v1 transaction naming 5URd… was looked for on
 * chain, so the two cases below are CONSTRUCTED from recorded answers, each with the stated
 * edits and nothing else:
 *   - foreign: the real v1 answer with static key 1 replaced by the tree's address (what makes
 *     `getSignaturesForAddress(5URd…)` list it), listed as the newest signature;
 *   - ours: the recorded legacy deposit 5vWuKtLF… re-declared as a v1 message — `version: 1`
 *     plus the real v1 answer's `transactionConfig` — every other field as recorded (the JSON
 *     answer of a v1 message has the legacy fields plus that one, as the fixture shows). No
 *     real v1 deposit exists to record: the wallet and the relayer build legacy messages.
 */
describe('version-1 transactions', () => {
  const V1 = JSON.parse(readFileSync(join(__dirname, 'fixtures/devnet-v1-tx-4T9Juo9P.json'), 'utf8')) as {
    signature: string;
    max0: {response: {error: {code: number; message: string}}};
    max1: {response: {result: RecordedTx}};
  };
  const v1Answer = () => JSON.parse(JSON.stringify(V1.max1.response.result)) as RecordedTx;
  const V1_FEE_PAYER = '2dbChKurXcZj4iDQPdEPyYHJGaiAqJno2omaPjHCQ7EN';
  const V1_PROGRAM = 'BiSoNHVpsVZW2F7rx2eQ59yQwKxzU5NvBcmKshCSUypi';

  /** The real v1 tx, naming the tree at static key 1, listed newest. `edit` runs before it is listed. */
  const withForeign = (edit?: (tx: RecordedTx) => void): RecordedChain => {
    const chain = fresh();
    const tx = v1Answer();
    tx.transaction.message.accountKeys[1] = A0.merkleTree;
    edit?.(tx);
    chain.transactions[V1.signature] = tx;
    chain.signatures.unshift({
      signature: V1.signature,
      slot: tx.slot,
      err: null,
      memo: null,
      blockTime: tx.blockTime,
      confirmationStatus: 'finalized',
    });
    return chain;
  };

  /** The recorded deposit 5vWuKtLF… (leaf 14) re-declared as a v1 message. */
  const withOurDepositAsV1 = (): {chain: RecordedChain; sig: string} => {
    const chain = fresh();
    const {sig, tx} = txOf(chain, '5vWuKtLF');
    expect(tx.version).toBe('legacy');
    tx.version = 1;
    tx.transaction.message.transactionConfig = v1Answer().transaction.message.transactionConfig;
    return {chain, sig};
  };

  const getTx = (chain: RecordedChain, sig: string, max: number) =>
    recordedConnection(chain).connection.getTransaction(sig, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: max,
    });

  it('the fixture is a v1 answer, and the recording refuses it at max 0 with the node\'s own error', async () => {
    expect(V1.max1.response.result.version).toBe(1);
    expect(V1.max1.response.result.transaction.signatures[0]).toBe(V1.signature);
    expect(V1.max0.response.error).toEqual(UNSUPPORTED_V1_ERROR);
    const chain = withForeign();
    // through the real web3.js: asked with 0 the v1 tx is an RPC error, asked with 1 it is a MessageV1
    await expect(getTx(chain, V1.signature, 0)).rejects.toMatchObject({code: -32015});
    const tx = await getTx(chain, V1.signature, RECORDED_MAX_TX_VERSION);
    expect(tx!.version).toBe(1);
    expect(tx!.transaction.message.version).toBe(1);
  });

  it('liveDevnet passes the node\'s -32015 on as a JSON-RPC error too (it answers getTransaction from the same recording)', async () => {
    const {connection} = liveDevnet(withForeign());
    await expect(
      connection.getTransaction(V1.signature, {commitment: 'confirmed', maxSupportedTransactionVersion: 0}),
    ).rejects.toMatchObject({name: 'SolanaJSONRPCError', code: -32015});
    const tx = await connection.getTransaction(V1.signature, {commitment: 'confirmed', maxSupportedTransactionVersion: 1});
    expect(tx!.version).toBe(1);
  });

  it('every getTransaction of the sync asks with maxSupportedTransactionVersion 1', async () => {
    const {connection, requests} = recordedConnection(fresh());
    await syncA0Tree(connection, {useCache: false});
    const configs = requests.filter(r => r.method === 'getTransaction').map(r => r.params[1]);
    expect(configs).toHaveLength(15);
    for (const c of configs) {
      expect(c).toEqual({commitment: 'confirmed', maxSupportedTransactionVersion: 1});
    }
  });

  it('a foreign v1 tx that lists the tree does not stop the sync: read, kept without leaves, the tree unchanged', async () => {
    const base = await sync(fresh());
    const {tree, stats} = await sync(withForeign());
    expect(stats).toMatchObject({
      listedSignatures: 16,
      fetchedTransactions: 16,
      failedTransactions: 0,
      totalTransactions: 16,
    });
    expect(tree.leaves).toEqual(base.tree.leaves);
    expect(tree.root).toBe(base.tree.root);
    expect(tree.txs.slice(0, 15)).toEqual(base.tree.txs);
    expect(tree.txs[15]).toEqual({
      signature: V1.signature,
      slot: 526720765,
      blockTime: 1795747138,
      signers: [V1_FEE_PAYER],
      feePayer: V1_FEE_PAYER,
      topLevelPrograms: [V1_PROGRAM],
      leafInserted: [],
      withdrawNullifiers: [],
      deposits: [],
      withdrawals: [],
      systemTransfers: [],
      createAtaIdempotent: [],
      preBalances: [
        {address: V1_FEE_PAYER, lamports: 710700000n},
        {address: A0.merkleTree, lamports: 15144960n},
        {address: 'SysvarC1ock11111111111111111111111111111111', lamports: 1169280n},
        {address: V1_PROGRAM, lamports: 1141440n},
      ],
      vaultTokenDelta: 0n,
    });
  });

  it('the foreign v1 tx is kept exactly as the same tx declared legacy is', async () => {
    const asLegacy = await sync(
      withForeign(tx => {
        tx.version = 'legacy';
        delete tx.transaction.message.transactionConfig;
      }),
    );
    const asV1 = await sync(withForeign());
    expect(asV1.tree.txs).toHaveLength(16);
    expect(asV1.tree.txs).toEqual(asLegacy.tree.txs);
  });

  it('our own deposit in a v1 message is decoded as in a legacy one: same record, same leaf, same root', async () => {
    const base = await sync(fresh());
    const {chain, sig} = withOurDepositAsV1();
    // POSITIVE CONTROL: the sync below really reads a MessageV1 for this signature
    const tx = await getTx(chain, sig, RECORDED_MAX_TX_VERSION);
    expect(tx!.transaction.message.version).toBe(1);
    await expect(getTx(chain, sig, 0)).rejects.toMatchObject({code: -32015});

    const {tree} = await sync(chain);
    const record = tree.txs.find(t => t.signature === sig)!;
    expect(record.leafInserted.map(l => l.leafIndex)).toEqual([14]);
    expect(record.deposits).toHaveLength(1);
    expect(record.topLevelPrograms).toEqual(['ComputeBudget111111111111111111111111111111', A0.programId]);
    expect(tree.txs).toEqual(base.tree.txs);
    expect(tree.leaves).toEqual(base.tree.leaves);
    expect(tree.root).toBe(base.tree.root);
  });

  it('a pool leaf forged into the foreign v1 tx from [pool, 5URd…] is admitted like any other — and refuses the sync', async () => {
    // a MessageV1 goes through the same admission as a legacy message: the R1-I1 positive control, on v1
    const chain = withForeign(tx => {
      const msg = tx.transaction.message;
      msg.accountKeys.push(A0.pool);
      (msg.header as {numReadonlyUnsignedAccounts: number}).numReadonlyUnsignedAccounts += 1;
      tx.meta.preBalances.push(1);
      (tx.meta.postBalances as number[]).push(1);
      appendTopLevelIx(tx, {
        program: A0.programId,
        accounts: [A0.pool, A0.merkleTree],
        data: new Uint8Array(8),
        blobs: [leafBlob('59f3d408d7bfbb98', '01'.repeat(32), 0, '02'.repeat(32))],
      });
    });
    await expect(sync(chain)).rejects.toMatchObject({code: 'E_A0_LEAF_ORDER'});
  });
});
