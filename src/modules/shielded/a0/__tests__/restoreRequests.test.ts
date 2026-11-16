/**
 * I-3 (spec §14 JS, §7 "It makes no RPC request specific to one of our notes", §2 "Who sees what"):
 * a full restore from the seed makes ONLY the tree sync's requests — the same requests every
 * client makes — and no request names one of our notes.
 *
 * A recording Connection (the REAL web3.js Connection over recordedRpc.ts, which logs every
 * JSON-RPC method and its params) serves the recorded devnet history extended with the test
 * seed's own deposits and an unshield of one of them (ownHistory.ts). The assertions:
 *   1. the restore's request log is EXACTLY the log of a plain tree sync over the same chain;
 *   2. its methods are within getSignaturesForAddress(5URd…), getTransaction(<a listed pool tx>),
 *      getAccountInfo(5URd…) — stricter than §14's set, which also allows the registry's balance
 *      reads (M1b's restore makes none);
 *   3. no param, in any encoding (hex, base58, base64 of the 32 bytes), equals a commitment, rho,
 *      nullifier, rho-PDA or nullifier-PDA of the own notes.
 * POSITIVE controls: the same checker flags a restore variant that looks up one nullifier PDA, one
 * that lists one rho PDA's signatures, and one that filters accounts by one own commitment.
 *
 * WARM CACHE (R1-m3): a second restore starts from the encrypted sync cache, so its walk carries
 * `until` = the cache's cursor, the newest finalized tree signature. That signature MAY be one of
 * our own deposit txs (the row below builds exactly that case). It is not a note-specific request:
 * the signature is public — the RPC itself forwarded that tx and lists it to every client walking
 * 5URd… — and the cursor is the newest finalized tree tx whoever made it, the value any client
 * with a cache sends. The row pins that two restores make EXACTLY the requests of two plain cached
 * syncs, and the checker stays clean.
 */
jest.mock('@solana/web3.js', () =>
  jest.requireActual<typeof import('../__testing__/realWeb3')>('../__testing__/realWeb3').loadRealWeb3(),
);
jest.mock('react-native', () => ({
  NativeModules: {
    NocturaProver: jest.requireActual<typeof import('../__testing__/offlineA0')>('../__testing__/offlineA0').createFakeProverNative(),
  },
}));
import {readFileSync} from 'fs';
import {join} from 'path';
import {NativeModules} from 'react-native';
import {PublicKey} from '@solana/web3.js';
import type {Connection} from '@solana/web3.js';
import {base58} from '@scure/base';
import {clearAllStores, initSecureMmkv} from '../../../../store/mmkv/instances';
import {TEST_SEED, offlineKeys, seedBytes, strangerField} from '../__testing__/offlineA0';
import type {FakeProverNative} from '../__testing__/offlineA0';
import {appendDeposit, appendWithdraw, nullifierPda, rhoPda} from '../__testing__/ownHistory';
import {chainFrom, recordedConnection} from '../__testing__/recordedRpc';
import type {RecordedChain, RecordedFixture, RpcRequest} from '../__testing__/recordedRpc';
import {A0} from '../constants';
import {restoreA0FromSeed} from '../recovery';
import {syncA0Tree} from '../treeSync';

const TREE = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/devnet-tree-5URd.json'), 'utf8'),
) as RecordedFixture;
const fake = NativeModules.NocturaProver as unknown as FakeProverNative;
const own = offlineKeys(TEST_SEED);

/**
 * The recorded history + three own deposits (counters 0, 1, 2) + an unshield of the second —
 * appended after the third deposit, or (`ownDepositNewest`) before it, so that the newest tree tx
 * is our own deposit 2.
 */
function chainWithOwnNotes(ownDepositNewest = false): {
  chain: RecordedChain;
  ownValues: Map<string, string>;
  depositSignatures: string[];
} {
  const chain = chainFrom(TREE);
  const depositSignatures: string[] = [];
  const notes = [0n, 1n, 2n].map(i => ({rho: own.rho(i), amount: 10n + i}));
  const withNullifier = notes.map(n => ({...n, commitment: own.commitment(n.amount, n.rho), nullifier: own.nullifier(n.rho)}));
  const deposit = (k: number) => {
    const n = withNullifier[k]!;
    depositSignatures.push(appendDeposit(chain, {amount: n.amount, rho: n.rho, commitment: n.commitment}).signature);
  };
  const unshield = () => appendWithdraw(chain, {nullifier: withNullifier[1]!.nullifier, changeCommitment: strangerField(9)});
  deposit(0);
  deposit(1);
  if (ownDepositNewest) {
    unshield();
    deposit(2);
  } else {
    deposit(2);
    unshield();
  }
  // every own value, in every encoding a param could carry it → its label
  const ownValues = new Map<string, string>();
  const add = (label: string, bytes: Uint8Array) => {
    ownValues.set(Buffer.from(bytes).toString('hex'), label);
    ownValues.set(base58.encode(bytes), label);
    ownValues.set(Buffer.from(bytes).toString('base64'), label);
  };
  withNullifier.forEach((n, i) => {
    add(`rho[${i}]`, Buffer.from(n.rho, 'hex'));
    add(`commitment[${i}]`, Buffer.from(n.commitment, 'hex'));
    add(`nullifier[${i}]`, Buffer.from(n.nullifier, 'hex'));
    add(`rhoPda[${i}]`, new PublicKey(rhoPda(n.rho)).toBytes());
    add(`nullifierPda[${i}]`, new PublicKey(nullifierPda(n.nullifier)).toBytes());
  });
  return {chain, ownValues, depositSignatures};
}

/** Every string anywhere inside a value. */
const stringsIn = (v: unknown): string[] =>
  typeof v === 'string'
    ? [v]
    : Array.isArray(v)
      ? v.flatMap(stringsIn)
      : v !== null && typeof v === 'object'
        ? Object.values(v as Record<string, unknown>).flatMap(stringsIn)
        : [];

/** The I-3 checker: every request outside the sync's set, and every param that names an own note. */
function noteSpecificRequests(requests: RpcRequest[], chain: RecordedChain, ownValues: Map<string, string>): string[] {
  const listed = new Set(chain.signatures.map(s => s.signature));
  const out: string[] = [];
  requests.forEach((r, i) => {
    const first = r.params[0];
    const allowed =
      ((r.method === 'getSignaturesForAddress' || r.method === 'getAccountInfo') && first === A0.merkleTree) ||
      (r.method === 'getTransaction' && typeof first === 'string' && listed.has(first));
    if (!allowed) {
      out.push(`#${i} ${r.method}(${String(first)}) is not one of the sync's requests`);
    }
    for (const s of stringsIn(r.params)) {
      for (const [value, label] of ownValues) {
        if (s.includes(value)) {
          out.push(`#${i} ${r.method} carries ${label}`);
        }
      }
    }
  });
  return out;
}

beforeEach(() => {
  clearAllStores();
  initSecureMmkv('test-key');
  fake.reset();
});

it('the fixture has own notes to leak: 3 deposits, 1 spent, 15 distinct own values × 3 encodings', async () => {
  const {chain, ownValues} = chainWithOwnNotes();
  expect(new Set(ownValues.values()).size).toBe(15);
  expect(ownValues.size).toBe(45);
  const res = await restoreA0FromSeed(recordedConnection(chain).connection, seedBytes(TEST_SEED), {sync: {useCache: false}});
  expect(res.notes.map(n => n.status)).toEqual(['unspent', 'spent', 'unspent']);
});

it('a full restore makes exactly the tree sync\'s requests, none of them note-specific', async () => {
  const {chain, ownValues} = chainWithOwnNotes();
  const rec = recordedConnection(chain);
  await restoreA0FromSeed(rec.connection, seedBytes(TEST_SEED), {sync: {useCache: false}});

  const plain = recordedConnection(chain);
  await syncA0Tree(plain.connection, {useCache: false});
  expect(rec.requests).toEqual(plain.requests);
  expect(rec.requests).toHaveLength(1 + 19 + 1);

  expect([...new Set(rec.requests.map(r => r.method))].sort()).toEqual([
    'getAccountInfo',
    'getSignaturesForAddress',
    'getTransaction',
  ]);
  expect(noteSpecificRequests(rec.requests, chain, ownValues)).toEqual([]);
});

it('R1-m3: a warm-cache restore (two runs) makes exactly two plain cached syncs\' requests; `until` may be an own deposit\'s (public) signature', async () => {
  const {chain, ownValues, depositSignatures} = chainWithOwnNotes(true);
  const rec = recordedConnection(chain);
  const first = await restoreA0FromSeed(rec.connection, seedBytes(TEST_SEED));
  const second = await restoreA0FromSeed(rec.connection, seedBytes(TEST_SEED));
  expect(second.notes).toEqual(first.notes);
  expect(second.notes.map(n => n.status)).toEqual(['unspent', 'spent', 'unspent']);

  clearAllStores();
  initSecureMmkv('test-key');
  const plain = recordedConnection(chain);
  await syncA0Tree(plain.connection);
  await syncA0Tree(plain.connection);
  expect(rec.requests).toEqual(plain.requests);
  // run 1: the full walk (1 + 19 + 1); run 2: one page `until` the cursor (nothing newer) + the account
  expect(rec.requests).toHaveLength(21 + 2);
  const warm = rec.requests[21]!;
  expect(warm.method).toBe('getSignaturesForAddress');
  // the cursor is the newest tree tx — here OUR deposit 2's signature, which the RPC already
  // forwarded and lists to everyone (the file header)
  expect((warm.params[1] as {until?: string}).until).toBe(depositSignatures[2]);
  expect(rec.requests[22]!.method).toBe('getAccountInfo');
  expect(noteSpecificRequests(rec.requests, chain, ownValues)).toEqual([]);
});

describe('positive controls: the checker flags a restore that asks about one note', () => {
  const variant = async (lookUp: (c: Connection) => Promise<unknown>) => {
    const {chain, ownValues} = chainWithOwnNotes();
    const rec = recordedConnection(chain);
    await restoreA0FromSeed(rec.connection, seedBytes(TEST_SEED), {sync: {useCache: false}});
    await lookUp(rec.connection).catch(() => undefined);
    return noteSpecificRequests(rec.requests, chain, ownValues);
  };

  it('a lookup of one own nullifier PDA (the spent-check a restore must not make)', async () => {
    const pda = nullifierPda(own.nullifier(own.rho(0n)));
    expect(await variant(c => c.getAccountInfo(new PublicKey(pda)))).toEqual([
      `#21 getAccountInfo(${pda}) is not one of the sync's requests`,
      '#21 getAccountInfo carries nullifierPda[0]',
    ]);
  });

  it('a signature listing of one own rho PDA (the deposit-time pre-check, made at restore)', async () => {
    const pda = rhoPda(own.rho(2n));
    expect(await variant(c => c.getSignaturesForAddress(new PublicKey(pda), {limit: 1}))).toEqual([
      `#21 getSignaturesForAddress(${pda}) is not one of the sync's requests`,
      '#21 getSignaturesForAddress carries rhoPda[2]',
    ]);
  });

  it('an account filter on one own commitment', async () => {
    const cmBytes = Buffer.from(own.commitment(11n, own.rho(1n)), 'hex');
    const flagged = await variant(c =>
      c.getProgramAccounts(new PublicKey(A0.programId), {filters: [{memcmp: {offset: 8, bytes: base58.encode(cmBytes)}}]}),
    );
    expect(flagged).toEqual([
      `#21 getProgramAccounts(${A0.programId}) is not one of the sync's requests`,
      '#21 getProgramAccounts carries commitment[1]',
    ]);
  });
});
