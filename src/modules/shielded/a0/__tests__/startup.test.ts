/**
 * The A0 startup step (the ledger's ruling (2)): no `v1_a0_notes` record → restore from the seed
 * BEFORE anything else reads the store (whose first read would write an empty record), then the
 * pending reconciliation; the session state that gates the shielded balance (Task 6).
 */
jest.mock('@solana/web3.js', () =>
  jest.requireActual<typeof import('../__testing__/realWeb3')>('../__testing__/realWeb3').loadRealWeb3(),
);
jest.mock('react-native', () => ({
  NativeModules: {
    NocturaProver: jest.requireActual<typeof import('../__testing__/offlineA0')>('../__testing__/offlineA0').createFakeProverNative(),
  },
  Platform: {OS: 'android', select: (o: {android?: unknown; default?: unknown}) => o.android ?? o.default},
}));
import {readFileSync} from 'fs';
import {join} from 'path';
import {NativeModules} from 'react-native';
import {clearAllStores, initSecureMmkv, mmkvSecure} from '../../../../store/mmkv/instances';
import {TEST_SEED, offlineKeys, seedBytes} from '../__testing__/offlineA0';
import type {FakeProverNative} from '../__testing__/offlineA0';
import {appendDeposit} from '../__testing__/ownHistory';
import {chainFrom} from '../__testing__/recordedRpc';
import type {RecordedChain, RecordedFixture} from '../__testing__/recordedRpc';
import {liveDevnet} from '../__testing__/liveDevnet';
import {a0UnspentBalance, hasA0NoteRecord, loadA0NoteStore} from '../noteStore';
import {
  a0StartupState,
  ensureA0Startup,
  resetA0StartupForTests,
  runA0Startup,
  subscribeA0Startup,
} from '../startup';

const TREE = JSON.parse(readFileSync(join(__dirname, 'fixtures/devnet-tree-5URd.json'), 'utf8')) as RecordedFixture;
const fake = NativeModules.NocturaProver as unknown as FakeProverNative;
const own = offlineKeys(TEST_SEED);
const KEY = 'v1_a0_notes';
const SYNC = {sync: {useCache: false}};

/** The chain with one deposit of ours at counter 0 (what a wiped phone must get back). */
function chainWithOwnDeposit(amount = 4_000_000n): RecordedChain {
  const chain = chainFrom(TREE);
  const rho = own.rho(0n);
  appendDeposit(chain, {amount, rho, commitment: own.commitment(amount, rho)});
  return chain;
}
const zeroed = (b: Uint8Array) => [...b].every(x => x === 0);

beforeEach(() => {
  clearAllStores();
  initSecureMmkv('test-key');
  fake.reset();
  resetA0StartupForTests();
});

describe('runA0Startup', () => {
  it('NO record (fresh install / wiped app) → restore from the seed: the shielded balance comes back from the chain', async () => {
    expect(hasA0NoteRecord()).toBe(false);
    const net = liveDevnet(chainWithOwnDeposit());
    const seed = seedBytes(TEST_SEED);
    const res = await runA0Startup(net.connection, seed, SYNC);
    expect(res.restoredBecause).toBe('no-record');
    expect(res.restore).toMatchObject({ownNotes: 1, treeTransactions: TREE.signatures.length + 1});
    expect(res.reconcile).toEqual({confirmed: [], dropped: [], stillPending: []});
    expect(a0UnspentBalance()).toBe(4_000_000n);
    expect(loadA0NoteStore().nextDepositIndex).toBe(1n);
    expect(callsOf('keysOpen')).toHaveLength(1);
    expect(zeroed(seed)).toBe(true);
  });

  it('a record exists → no restore (no key opened, no history walk), the seed wiped anyway', async () => {
    loadA0NoteStore(); // writes the (empty) record
    const net = liveDevnet(chainWithOwnDeposit());
    const seed = seedBytes(TEST_SEED);
    const res = await runA0Startup(net.connection, seed, SYNC);
    expect(res).toEqual({restoredBecause: null, restore: null, reconcile: {confirmed: [], dropped: [], stillPending: []}});
    expect(fake.calls).toEqual([]);
    expect(net.requests).toEqual([]);
    expect(zeroed(seed)).toBe(true);
    // negative control for the first case: with a record, the chain's note is NOT pulled in
    expect(a0UnspentBalance()).toBe(0n);
  });

  it('a record that does not decode → restored (only a recovery replaces a corrupt record)', async () => {
    mmkvSecure()!.set(KEY, '{"schema":99}');
    const net = liveDevnet(chainWithOwnDeposit(3n));
    const res = await runA0Startup(net.connection, seedBytes(TEST_SEED), SYNC);
    expect(res.restoredBecause).toBe('corrupt-record');
    expect(a0UnspentBalance()).toBe(3n);
  });

  it('a restore that fails writes nothing: the next start restores again', async () => {
    const chain = chainWithOwnDeposit();
    const broken = chainFrom({...TREE, account: {...TREE.account, value: null}} as RecordedFixture);
    await expect(runA0Startup(liveDevnet(broken).connection, seedBytes(TEST_SEED), SYNC)).rejects.toMatchObject({
      code: 'E_A0_TREE_MISSING',
    });
    expect(hasA0NoteRecord()).toBe(false);
    const res = await runA0Startup(liveDevnet(chain).connection, seedBytes(TEST_SEED), SYNC);
    expect(res.restoredBecause).toBe('no-record');
    expect(a0UnspentBalance()).toBe(4_000_000n);
  });

  it('no encrypted store → E_A0_STORE_LOCKED before any request', async () => {
    clearAllStores();
    const net = liveDevnet(chainFrom(TREE));
    const seed = seedBytes(TEST_SEED);
    await expect(runA0Startup(net.connection, seed, SYNC)).rejects.toMatchObject({code: 'E_A0_STORE_LOCKED'});
    expect(net.requests).toEqual([]);
    expect(zeroed(seed)).toBe(true);
  });
});

describe('ensureA0Startup — once per session, the state that gates the shielded balance', () => {
  it('idle → running → ready; a second call while running shares the run and wipes its seed', async () => {
    const seen: string[] = [];
    subscribeA0Startup(s => seen.push(s.phase));
    expect(a0StartupState()).toEqual({phase: 'idle'});
    const net = liveDevnet(chainWithOwnDeposit());
    const first = ensureA0Startup(net.connection, seedBytes(TEST_SEED), SYNC);
    expect(a0StartupState()).toEqual({phase: 'running'});
    const second = seedBytes(TEST_SEED);
    const again = ensureA0Startup(net.connection, second, SYNC);
    expect(zeroed(second)).toBe(true);
    const [a, b] = await Promise.all([first, again]);
    expect(a).toBe(b);
    expect(a.phase).toBe('ready');
    expect(seen).toEqual(['running', 'ready']);
    expect(callsOf('keysOpen')).toHaveLength(1);
    // after ready: no second run
    await ensureA0Startup(net.connection, seedBytes(TEST_SEED), SYNC);
    expect(callsOf('keysOpen')).toHaveLength(1);
  });

  it('a failure is a state (never a rejection, never a 0 balance); the next call retries', async () => {
    const broken = chainFrom({...TREE, account: {...TREE.account, value: null}} as RecordedFixture);
    const state = await ensureA0Startup(liveDevnet(broken).connection, seedBytes(TEST_SEED), SYNC);
    expect(state).toMatchObject({phase: 'error', code: 'E_A0_TREE_MISSING'});
    expect(hasA0NoteRecord()).toBe(false);
    const retry = await ensureA0Startup(liveDevnet(chainWithOwnDeposit()).connection, seedBytes(TEST_SEED), SYNC);
    expect(retry.phase).toBe('ready');
    expect(a0UnspentBalance()).toBe(4_000_000n);
  });
});

function callsOf(m: string) {
  return fake.calls.filter(c => c.method === m);
}
