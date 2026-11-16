/**
 * Killed between submit and confirmation (spec §5 steps 5 + 7, §14 "startup reconciliation, and
 * nextDepositIndex never lowered", §16 M1b checkpoint "kill the app between the deposit's submit and
 * its confirmation once: at the next start the note is reconciled, not lost").
 *
 * The flow runs against the live devnet fake until the send; then every request hangs forever —
 * the app is dead, its promise never settles and is abandoned. What survives is what survives on
 * the phone: the encrypted store (the same MMKV instance re-opened) and the chain. The "next
 * start" is a new Connection over that chain and `runA0Startup` (the app's startup step).
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
import {PublicKey} from '@solana/web3.js';
import {clearAllStores, initSecureMmkv} from '../../../../store/mmkv/instances';
import {TEST_SEED, offlineDepositProver, offlineKeys, seedBytes} from '../__testing__/offlineA0';
import type {FakeProverNative} from '../__testing__/offlineA0';
import {chainFrom} from '../__testing__/recordedRpc';
import type {RecordedFixture} from '../__testing__/recordedRpc';
import {fundTokenAccount, liveDevnet} from '../__testing__/liveDevnet';
import type {LiveDevnet} from '../__testing__/liveDevnet';
import {deriveTransparentKeypair} from '../../../keyDerivation/transparent';
import type {AssetIO} from '../../../zkProver/provingAssets';
import {loadA0NoteStore} from '../noteStore';
import {clearA0SettleTimersForTests, prepareA0Deposit, reconcileA0PendingDeposits, submitA0Deposit} from '../depositFlow';
import type {A0DepositOutcome} from '../depositFlow';
import {ensureA0Startup, resetA0StartupForTests, runA0Startup} from '../startup';
import {resetA0ReadoutForTests, setA0ReadoutDefaultsForTests} from '../checkpointReadout';

const TREE = JSON.parse(readFileSync(join(__dirname, 'fixtures/devnet-tree-5URd.json'), 'utf8')) as RecordedFixture;
const fake = NativeModules.NocturaProver as unknown as FakeProverNative;
const own = offlineKeys(TEST_SEED);
const DEPOSITOR = new PublicKey(deriveTransparentKeypair(seedBytes(TEST_SEED)).publicKey).toBase58();
const AMOUNT = 1_000_000n;
const RECORDED_LEAVES = 17;

const io: AssetIO = {
  cachePath: (id, kind) => `/cache/${id}.${kind}`,
  exists: async () => true,
  download: async () => undefined,
  sha256: async p =>
    p.endsWith('.zkey')
      ? 'fef08f0217a44c8c1629f5f8d670047461205c1fced83d7ea6fe763420e53fe9'
      : '1d69d7f89792a31d4c7780afa52b2f11707a4347f61382e7b294f4848d7dfff1',
  remove: async () => undefined,
};

let net: LiveDevnet;

beforeEach(() => {
  clearAllStores();
  initSecureMmkv('test-key');
  fake.reset();
  fake.setProver(offlineDepositProver);
  net = liveDevnet(chainFrom(TREE));
  fundTokenAccount(net, DEPOSITOR, 5_000_000n);
  loadA0NoteStore();
});
afterEach(() => {
  clearA0SettleTimersForTests(); // R1-m7: no settle pause outlives its test
});


/** Deposit until the app dies right after the send (the flow's promise is abandoned, never awaited). */
async function depositAndKill(lands: boolean): Promise<{rho: string; flow: Promise<A0DepositOutcome>; lvbh: number}> {
  const p = await prepareA0Deposit(net.connection, seedBytes(TEST_SEED), AMOUNT, {io, sync: {useCache: false}});
  net.onSend = () => 'kill';
  net.killLands = lands;
  let submitted: () => void = () => undefined;
  const sent = new Promise<void>(r => {
    submitted = r;
  });
  const flow = submitA0Deposit(net.connection, p, seedBytes(TEST_SEED), {
    sync: {useCache: false},
    onStage: s => {
      if (s === 'submitted') {
        submitted();
      }
    },
  });
  await sent;
  await new Promise(r => setTimeout(r, 20)); // the flow is now stuck in its first status poll
  expect(net.killed).toBe(true);
  return {rho: p.rho, flow, lvbh: net.height.confirmed + 150};
}

/** The next start: the same store and chain, a fresh Connection, a fresh native session. */
function restart(): LiveDevnet {
  const next = liveDevnet(net.chain);
  next.accounts = net.accounts;
  next.statuses = net.statuses;
  next.height = net.height;
  next.tokenAccounts = net.tokenAccounts;
  initSecureMmkv('test-key'); // the same instance id: what was written survives
  fake.reset();
  return next;
}

describe('killed between submit and confirmation', () => {
  it('the pending note (with its lastValidBlockHeight) and the counter survive the kill', async () => {
    const {rho, lvbh} = await depositAndKill(false);
    restart();
    expect(loadA0NoteStore()).toEqual({
      nextDepositIndex: 1n,
      notes: [
        {
          commitment: own.commitment(AMOUNT, rho),
          amount: AMOUNT,
          rho,
          depositIndex: 0n,
          lastValidBlockHeight: lvbh,
          status: 'pending',
        },
      ],
    });
  });

  it('it LANDED: at the next start the rho PDA is present → the note is unspent at its leaf, not lost', async () => {
    const {rho} = await depositAndKill(true);
    const next = restart();
    const res = await runA0Startup(next.connection, seedBytes(TEST_SEED), {sync: {useCache: false}});
    expect(res.restoredBecause).toBeNull();
    expect(res.reconcile).toEqual({
      confirmed: [{rho, leafIndex: RECORDED_LEAVES, signature: net.sent[0]!.signature}],
      dropped: [],
      stillPending: [],
      skipped: 0,
    });
    expect(loadA0NoteStore()).toEqual({
      nextDepositIndex: 1n,
      notes: [{commitment: own.commitment(AMOUNT, rho), amount: AMOUNT, rho, depositIndex: 0n, leafIndex: RECORDED_LEAVES, status: 'unspent'}],
    });
    // the reconciliation needs no key: no native call at all, and no getTransaction of our signature outside the sync
    expect(fake.calls).toEqual([]);
    expect(next.requests.filter(r => r.method === 'getAccountInfo').map(r => r.params[0])).toEqual([
      PublicKey.findProgramAddressSync(
        [Buffer.from('rho'), Buffer.from(rho, 'hex')],
        new PublicKey('FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH'),
      )[0].toBase58(),
      '5URdh1uLKXPh28AbcXBK1oWYGpQjVbMSjrKiAkt1q1Gc',
    ]);
  });

  it('it did NOT land, still before its lastValidBlockHeight → kept pending', async () => {
    const {rho, lvbh} = await depositAndKill(false);
    const next = restart();
    next.height.finalized = lvbh; // not PAST it
    const res = await runA0Startup(next.connection, seedBytes(TEST_SEED));
    expect(res.reconcile).toEqual({confirmed: [], dropped: [], stillPending: [{rho, reason: 'not-expired'}], skipped: 0});
    expect(loadA0NoteStore().notes).toHaveLength(1);
  });

  it('it did NOT land and the finalized height is past its lastValidBlockHeight → dropped; the counter is NOT lowered', async () => {
    const {rho, lvbh} = await depositAndKill(false);
    const next = restart();
    next.height.finalized = lvbh + 1;
    const res = await runA0Startup(next.connection, seedBytes(TEST_SEED));
    expect(res.reconcile).toEqual({confirmed: [], dropped: [{rho, reason: 'expired'}], stillPending: [], skipped: 0});
    expect(loadA0NoteStore()).toEqual({nextDepositIndex: 1n, notes: []});
    // the next deposit takes counter 1, never the dropped 0 again
    fake.setProver(offlineDepositProver);
    const p = await prepareA0Deposit(next.connection, seedBytes(TEST_SEED), AMOUNT, {io});
    expect(p.depositIndex).toBe(1n);
    expect(p.rho).toBe(own.rho(1n));
  });

  it('the drop is decided on FINALIZED reads only: a confirmed-height past expiry is not enough', async () => {
    const {rho, lvbh} = await depositAndKill(false);
    const next = restart();
    next.height.confirmed = lvbh + 500;
    next.height.finalized = lvbh;
    const res = await reconcileA0PendingDeposits(next.connection);
    expect(res.stillPending).toEqual([{rho, reason: 'not-expired'}]);
    expect(next.requests.find(r => r.method === 'getBlockHeight')!.params).toEqual([{commitment: 'finalized'}]);
  });

  it('absent at the confirmed read, present at the finalized one (landed in between) → kept, never dropped', async () => {
    const {rho, lvbh} = await depositAndKill(false);
    const next = restart();
    next.height.finalized = lvbh + 1;
    const pda = PublicKey.findProgramAddressSync(
      [Buffer.from('rho'), Buffer.from(rho, 'hex')],
      new PublicKey('FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH'),
    )[0].toBase58();
    // the confirmed read misses it, the finalized one (made after the height) sees it
    let reads = 0;
    const realGet = next.accounts.get.bind(next.accounts);
    next.accounts.get = (k: string) => {
      if (k === pda) {
        reads += 1;
        return reads === 1 ? undefined : {owner: 'FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH', finalized: true};
      }
      return realGet(k);
    };
    const res = await reconcileA0PendingDeposits(next.connection);
    expect(res).toEqual({confirmed: [], dropped: [], stillPending: [{rho, reason: 'not-in-sync'}], skipped: 0});
    expect(loadA0NoteStore().notes).toHaveLength(1);
  });

  it('no pending deposit → the reconciliation makes no request', async () => {
    const res = await reconcileA0PendingDeposits(net.connection);
    expect(res).toEqual({confirmed: [], dropped: [], stillPending: [], skipped: 0});
    expect(net.requests).toEqual([]);
  });
});

/** The readout lines, re-assembled per id, as the desk script parses them. */
function readouts(lines: readonly string[]): Record<string, unknown>[] {
  const byId = new Map<string, string>();
  for (const l of lines) {
    const m = /^NOCTURA-A0-READOUT (\S+) \d+\/\d+ (.*)$/.exec(l)!;
    byId.set(m[1]!, (byId.get(m[1]!) ?? '') + m[2]!);
  }
  return [...byId.values()].map(t => JSON.parse(t) as Record<string, unknown>);
}

describe('the M1b checkpoint readout across the kill (what the desk sees on the phone)', () => {
  const lines: string[] = [];
  beforeEach(() => {
    lines.length = 0;
    resetA0ReadoutForTests();
    resetA0StartupForTests();
    setA0ReadoutDefaultsForTests({enabled: true, sink: l => lines.push(l)});
  });
  afterEach(() => {
    resetA0ReadoutForTests();
    resetA0StartupForTests();
  });

  it('killed session: "deposit-submitted" and NO outcome; next session\'s startup: the same signature confirmed at its leaf, the note unspent', async () => {
    const {rho} = await depositAndKill(true);
    const signature = net.sent[0]!.signature;
    const killed = readouts(lines);
    expect(killed.map(r => r.event)).toEqual(['deposit-submitted']);
    expect(killed[0]).toMatchObject({signature, depositor: DEPOSITOR, amount: AMOUNT.toString(), commitment: own.commitment(AMOUNT, rho)});
    const next = restart();
    const state = await ensureA0Startup(next.connection, seedBytes(TEST_SEED), {sync: {useCache: false}});
    expect(state.phase).toBe('ready');
    const after = readouts(lines).slice(1);
    expect(after.map(r => r.event)).toEqual(['startup']);
    expect(after[0]).toMatchObject({
      phase: 'ready',
      restoredBecause: null,
      restore: null,
      reconcile: {confirmed: [{leafIndex: RECORDED_LEAVES, signature}], dropped: [], stillPending: [], skipped: 0},
      notes: {
        pending: 0,
        unspent: 1,
        spent: 0,
        unspentBalance: AMOUNT.toString(),
        unspentNotes: [{leafIndex: RECORDED_LEAVES, commitment: own.commitment(AMOUNT, rho), amount: AMOUNT.toString()}],
      },
    });
    expect(lines.join('\n')).not.toContain(rho);
  });

  it('the kill window opens only once the send was ACCEPTED: a refused send reads out no "deposit-submitted", only its pending outcome', async () => {
    const p = await prepareA0Deposit(net.connection, seedBytes(TEST_SEED), AMOUNT, {io, sync: {useCache: false}});
    net.sendError = 'Transaction simulation failed';
    const out = await submitA0Deposit(net.connection, p, seedBytes(TEST_SEED), {sync: {useCache: false}, settleAttempts: 1});
    expect(out).toMatchObject({status: 'pending', reason: 'send-failed'});
    const r = readouts(lines);
    expect(r.map(x => x.event)).toEqual(['deposit-outcome']);
    expect(r[0]).toMatchObject({status: 'pending', reason: 'send-failed', signature: out.signature});
    expect(JSON.stringify(r[0])).not.toContain('simulation failed'); // the detail (an RPC message) is not read out
  });

  it('positive control: an unkilled deposit reads out "deposit-submitted" then "deposit-outcome" unspent at the same leaf', async () => {
    const p = await prepareA0Deposit(net.connection, seedBytes(TEST_SEED), AMOUNT, {io, sync: {useCache: false}});
    const out = await submitA0Deposit(net.connection, p, seedBytes(TEST_SEED), {sync: {useCache: false}, settleAttempts: 1});
    expect(out.status).toBe('unspent');
    const r = readouts(lines);
    expect(r.map(x => x.event)).toEqual(['deposit-submitted', 'deposit-outcome']);
    expect(r[1]).toMatchObject({signature: out.signature, status: 'unspent', leafIndex: RECORDED_LEAVES, commitment: p.commitment});
  });
});
