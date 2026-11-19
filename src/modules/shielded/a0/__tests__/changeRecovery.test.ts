/**
 * Recovery of change notes and exit accounts from the seed (spec §7 "Change notes" and
 * "Accounts", §8 `spentTx`, R12, I6, S9; M1c Task 5).
 *
 * THE CHAIN is the recorded devnet history of tree 5URd… (fixtures/devnet-tree-5URd.json), served
 * to the REAL web3.js Connection (recordedRpc.ts) and verified by the real tree sync, extended
 * with the test seed's own deposits and RELAYED UNSHIELDS (ownHistory.ts: clones of the landed
 * 3DR6F7oW… and 3UfCx5TD…, the tree account advanced as the program advances it). Every rho,
 * commitment, nullifier and change value of an own note comes from the OFFLINE equations
 * (offlineA0.ts, held to a0-key-vectors.json, and — for the change equation — to the program side's
 * golden in changeCommitment.golden.test.ts); never from the code under test. The native core is
 * the offline fake behind the real bridge; every call it gets is logged.
 *
 * THE ACCOUNTS: `slip10:n` addresses and their ATAs come from fixtures/a0-exit-account-vectors.json,
 * written by scripts/a0-vectors/gen-exit-account-vectors.mjs from Node's own crypto (no web3.js,
 * no core/keys code), anchored to the extension's slip10:0 and to three published ATAs.
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
import {clearAllStores, initSecureMmkv, mmkvSecure} from '../../../../store/mmkv/instances';
import {storeTransparentScheme} from '../../../keyDerivation/derivationScheme';
import {OTHER_SEED, TEST_SEED, offlineKeys, seedBytes, strangerField} from '../__testing__/offlineA0';
import type {FakeProverNative} from '../__testing__/offlineA0';
import {appendDeposit, appendWithdraw, appendWithdrawPair} from '../__testing__/ownHistory';
import {chainFrom, recordedConnection} from '../__testing__/recordedRpc';
import type {RecordedChain, RecordedFixture} from '../__testing__/recordedRpc';
import {A0_ACCOUNT_DISCOVERY_GAP, loadA0AccountRegistry, reserveA0FreshAccount, resetA0ReservationsForTests} from '../accountRegistry';
import {a0AtaOf} from '../relayerClient';
import {addA0PendingDeposit, confirmA0Deposit, loadA0NoteStore, mergeA0RecoveredNotes} from '../noteStore';
import {A0RecoveryError, loadA0LastRestoreStats, restoreA0FromSeed} from '../recovery';

const TREE = JSON.parse(readFileSync(join(__dirname, 'fixtures/devnet-tree-5URd.json'), 'utf8')) as RecordedFixture;
interface ExitVectors {
  mint: string;
  seeds: {mnemonic: string; accounts: {scheme: string; address: string; ata: string}[]}[];
}
const EXIT = JSON.parse(readFileSync(join(__dirname, 'fixtures/a0-exit-account-vectors.json'), 'utf8')) as ExitVectors;
const fake = NativeModules.NocturaProver as unknown as FakeProverNative;
const own = offlineKeys(TEST_SEED);
const other = offlineKeys(OTHER_SEED);
const KEY = 'v1_a0_notes';
/** the template's amount and fee (3UfCx5TD…), used when a row gives none */
const T_AMOUNT = 400_000n;
const T_FEE = 10_000n;

/** slip10:n of the test seed (abandon … about) / of the other seed (zoo … wrong), from the offline vectors */
const acct = (n: number, seed = 0) => EXIT.seeds[seed]!.accounts[n]!;
/** an address outside both seeds ("Another address"): the relayer-landed P0's owner HV996… and its ATA */
const STRANGER = {owner: 'HV996fcQT193sXfh3fgCEDjxsWwWxQC6cVdb1EyZxdJR', ata: 'DzU8HkTy7b5jK8LvahytrsgimF9Navxc9HgzA7y167Zt'};
const to = (n: number, seed = 0) => ({owner: acct(n, seed).address, ata: acct(n, seed).ata});

const fresh = (): RecordedChain => chainFrom(TREE);
const restore = (chain: RecordedChain, seed: Uint8Array = seedBytes(TEST_SEED)) =>
  restoreA0FromSeed(recordedConnection(chain).connection, seed, {sync: {useCache: false}});
const callsOf = (m: string) => fake.calls.filter(c => c.method === m);

/** Our deposit at counter `i`. */
const ownDeposit = (chain: RecordedChain, i: bigint, amount: bigint) => {
  const rho = own.rho(i);
  const commitment = own.commitment(amount, rho);
  return {rho, amount, commitment, ...appendDeposit(chain, {amount, rho, commitment})};
};
/**
 * Our relayed unshield of the note `{rho, amount}` with OUR change (the offline equations: rho_change
 * = Poseidon3(0x13, nullifier, 0), changeAmount = input − amount − fee, commitment under d_self).
 */
const ownUnshield = (
  chain: RecordedChain,
  note: {rho: string; amount: bigint},
  o: {amount?: bigint; fee?: bigint; to?: {owner: string; ata: string}; changeOverride?: string} = {},
) => {
  const amount = o.amount ?? T_AMOUNT;
  const fee = o.fee ?? T_FEE;
  const nullifier = own.nullifier(note.rho);
  const rho = own.rhoChange(nullifier);
  const changeAmount = note.amount - amount - fee;
  const commitment = own.commitment(changeAmount, rho);
  const w = appendWithdraw(chain, {nullifier, changeCommitment: o.changeOverride ?? commitment, amount, fee, to: o.to});
  return {rho, amount: changeAmount, commitment, nullifier, ...w};
};

beforeEach(() => {
  clearAllStores();
  initSecureMmkv('test-key');
  storeTransparentScheme({kind: 'slip10', account: 0});
  resetA0ReservationsForTests();
  fake.reset();
});

describe('the vectors this suite stands on', () => {
  it('the exit-account vectors agree with the app\'s ATA derivation (a0AtaOf) for every slip10:0..30 of both seeds — and with the published anchors', () => {
    expect(EXIT.mint).toBe('ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs');
    expect(acct(0).address).toBe('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
    for (const s of EXIT.seeds) {
      expect(s.accounts.map(a => a.scheme)).toEqual([...Array(31).keys()].map(n => `slip10:${n}`));
      for (const a of s.accounts) {
        expect(a0AtaOf(new PublicKey(a.address)).toBase58()).toBe(a.ata);
      }
    }
    expect(a0AtaOf(new PublicKey(STRANGER.owner)).toBase58()).toBe(STRANGER.ata);
  });

  it('the offline change values are the golden composition (spot check: rhoChange = the key vectors\' row)', () => {
    const n = TEST_SEED.notes[0]!;
    expect(own.rho(BigInt(n.depositIndex))).toBe(n.rho);
    expect(own.nullifier(n.rho)).toBe(n.nullifier);
    expect(own.rhoChange(n.nullifier)).toBe(n.rhoChange);
  });
});

describe('change notes (§7 "Change notes")', () => {
  it('one deposit, one relayed unshield with our change: the deposit is spent naming its spending tx; the change note comes back with its leaf', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000n);
    const u = ownUnshield(chain, d0, {to: STRANGER});
    const res = await restore(chain);
    expect(res.notes).toEqual([
      {commitment: d0.commitment, amount: 1_000_000n, rho: d0.rho, depositIndex: 0n, leafIndex: d0.leafIndex, status: 'spent', spentTx: u.signature},
      {commitment: u.commitment, amount: 590_000n, rho: u.rho, leafIndex: u.leafIndex, status: 'unspent'},
    ]);
    expect([d0.leafIndex, u.leafIndex]).toEqual([17, 18]);
    expect(res.nextDepositIndex).toBe(1n);
    expect(loadA0NoteStore()).toEqual({nextDepositIndex: 1n, notes: res.notes});
    expect(res.stats).toMatchObject({ownNotes: 2, spentNotes: 1, changeNotes: 1, unmatchedChangeLeaves: 0});
    expect(loadA0LastRestoreStats()).toEqual(res.stats);
  });

  it('the native calls: the change commitment is Rust\'s commitment(input − amount − fee, rho_change) with rho_change computed in JS; the attribution asks one nullifier at a time', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000n);
    const u = ownUnshield(chain, d0, {amount: 123_456n, fee: 10_000n, to: STRANGER});
    await restore(chain);
    expect(callsOf('commitment').map(c => c.args.slice(1))).toEqual([
      ['1000000', d0.rho],
      ['866544', u.rho],
    ]);
    const ms = callsOf('matchSpent').map(c => c.args.slice(1));
    const all = ms[0]![0] as string[];
    expect(all[all.length - 1]).toBe(u.nullifier);
    // 1: spent-status of the deposits; 2…: attribution, [n] by [n] over the synced nullifiers; last: the change note's spent-status
    expect(ms[0]).toEqual([all, [d0.rho]]);
    expect(ms.slice(1, -1)).toEqual(all.map(n => [[n], [d0.rho]]));
    expect(ms[ms.length - 1]).toEqual([all, [u.rho]]);
  });

  it('the recursion: deposit → unshield (change c1) → unshield of c1 (change c2) → c2 unspent; each spent note names its own spending tx', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 5_000_000n);
    const u1 = ownUnshield(chain, d0, {to: STRANGER});
    const u2 = ownUnshield(chain, u1, {amount: 1_000_000n, to: STRANGER});
    const res = await restore(chain);
    expect(res.notes).toEqual([
      {commitment: d0.commitment, amount: 5_000_000n, rho: d0.rho, depositIndex: 0n, leafIndex: 17, status: 'spent', spentTx: u1.signature},
      {commitment: u1.commitment, amount: 4_590_000n, rho: u1.rho, leafIndex: 18, status: 'spent', spentTx: u2.signature},
      {commitment: u2.commitment, amount: 3_580_000n, rho: u2.rho, leafIndex: 19, status: 'unspent'},
    ]);
    expect(res.stats).toMatchObject({changeNotes: 2, spentNotes: 2});
  });

  it('two deposits spent in the reverse order of their counters: each is attributed to ITS spending tx (no positional pairing)', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 700_000n);
    const d1 = ownDeposit(chain, 1n, 800_000n);
    const u1 = ownUnshield(chain, d1, {to: STRANGER});
    const u0 = ownUnshield(chain, d0, {to: STRANGER});
    const res = await restore(chain);
    const byRho = new Map(res.notes.map(n => [n.rho, n]));
    expect(byRho.get(d0.rho)).toMatchObject({status: 'spent', spentTx: u0.signature});
    expect(byRho.get(d1.rho)).toMatchObject({status: 'spent', spentTx: u1.signature});
    expect(byRho.get(u0.rho)).toMatchObject({amount: 290_000n, leafIndex: u0.leafIndex, status: 'unspent'});
    expect(byRho.get(u1.rho)).toMatchObject({amount: 390_000n, leafIndex: u1.leafIndex, status: 'unspent'});
    expect(res.notes).toHaveLength(4);
  });

  it('two unshields in ONE transaction, a stranger\'s first: our change takes the leaf of ITS commitment, not the first leaf', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000n);
    const n = own.nullifier(d0.rho);
    const rho = own.rhoChange(n);
    const cm = own.commitment(590_000n, rho);
    const pair = appendWithdrawPair(
      chain,
      {nullifier: strangerField(8), changeCommitment: strangerField(9)},
      {nullifier: n, changeCommitment: cm, amount: 400_000n, fee: 10_000n},
    );
    expect(pair.leafIndices).toEqual([18, 19]);
    const res = await restore(chain);
    expect(res.notes).toEqual([
      {commitment: d0.commitment, amount: 1_000_000n, rho: d0.rho, depositIndex: 0n, leafIndex: 17, status: 'spent', spentTx: pair.signature},
      {commitment: cm, amount: 590_000n, rho, leafIndex: 19, status: 'unspent'},
    ]);
  });

  it('a zero change (withdraw everything but the fee) is still a leaf and still a note — amount 0, unspent', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000n);
    const u = ownUnshield(chain, d0, {amount: 990_000n, fee: 10_000n, to: STRANGER});
    const res = await restore(chain);
    expect(res.notes[1]).toEqual({commitment: u.commitment, amount: 0n, rho: u.rho, leafIndex: u.leafIndex, status: 'unspent'});
  });

  it('a spend of our note whose change leaf is NOT ours: the note is spent with its spentTx, nothing imported, counted', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000n);
    const u = ownUnshield(chain, d0, {to: STRANGER, changeOverride: strangerField(3)});
    const res = await restore(chain);
    expect(res.notes).toEqual([
      {commitment: d0.commitment, amount: 1_000_000n, rho: d0.rho, depositIndex: 0n, leafIndex: 17, status: 'spent', spentTx: u.signature},
    ]);
    expect(res.stats).toMatchObject({changeNotes: 0, unmatchedChangeLeaves: 1});
  });

  it('the change amount is the INSTRUCTION\'s: a change committed under another fee than the instruction carries is not ours (and its positive twin is)', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000n);
    // the leaf commits to 1,000,000 − 400,000 − 20,000; the instruction says fee 10,000
    const wrong = own.commitment(580_000n, own.rhoChange(own.nullifier(d0.rho)));
    ownUnshield(chain, d0, {fee: 10_000n, to: STRANGER, changeOverride: wrong});
    expect((await restore(chain)).stats).toMatchObject({changeNotes: 0, unmatchedChangeLeaves: 1});
    clearAllStores();
    initSecureMmkv('test-key');
    const twin = fresh();
    const t0 = ownDeposit(twin, 0n, 1_000_000n);
    ownUnshield(twin, t0, {fee: 20_000n, to: STRANGER, changeOverride: wrong});
    expect((await restore(twin)).notes.map(n => n.amount)).toEqual([1_000_000n, 580_000n]);
  });

  it('the change rho is j = 0 of the PUBLIC nullifier: a leaf made with j = 1 is not ours', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000n);
    const { poseidon3 } = jest.requireActual<typeof import('poseidon-lite')>('poseidon-lite');
    const rhoJ1 = poseidon3([0x13n, BigInt(`0x${own.nullifier(d0.rho)}`), 1n]).toString(16).padStart(64, '0');
    ownUnshield(chain, d0, {to: STRANGER, changeOverride: own.commitment(590_000n, rhoJ1)});
    expect((await restore(chain)).stats).toMatchObject({changeNotes: 0, unmatchedChangeLeaves: 1});
  });

  it('SOMEONE ELSE\'s unshields are not attributed to us (their nullifiers answer [] one by one) and import nothing', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000n);
    const theirs = other.rho(0n);
    appendDeposit(chain, {amount: 900_000n, rho: theirs, commitment: other.commitment(900_000n, theirs)});
    appendWithdraw(chain, {
      nullifier: other.nullifier(theirs),
      changeCommitment: other.commitment(490_000n, other.rhoChange(other.nullifier(theirs))),
      to: to(1),
    });
    const res = await restore(chain);
    expect(res.notes).toEqual([{commitment: d0.commitment, amount: 1_000_000n, rho: d0.rho, depositIndex: 0n, leafIndex: 17, status: 'unspent'}]);
    expect(res.exitAccounts).toEqual([]); // the stranger's exit to OUR slip10:1 ATA is not "ours": no spend of ours went there
    expect(callsOf('matchSpent')).toHaveLength(1); // nothing spent → no attribution
  });

  it('no JS-side nullifier of an UNSPENT note is held: the store and the restore stats name none (R12)', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 5_000_000n);
    const u1 = ownUnshield(chain, d0, {to: STRANGER});
    await restore(chain);
    const text = mmkvSecure()!.getString(KEY)! + mmkvSecure()!.getString('v1_a0_last_restore')!;
    expect(text).not.toContain(own.nullifier(u1.rho)); // the unspent change note's future nullifier
    expect(text).toContain(u1.rho); // control: the store does hold the change note
  });
});

describe('the native core held to its contract during the attribution', () => {
  it('matchSpent naming two notes for ONE nullifier → E_A0_RECOVERY_NATIVE, the handle closed, nothing written', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000n);
    const d1 = ownDeposit(chain, 1n, 1_000_000n);
    ownUnshield(chain, d0, {to: STRANGER});
    ownUnshield(chain, d1, {to: STRANGER});
    const real = fake.matchSpent.bind(fake);
    const spy = jest.spyOn(fake, 'matchSpent').mockImplementation(async (h, chainNullifiers, ownRhos) =>
      chainNullifiers.length === 1 && ownRhos.length === 2 ? [0, 1] : real(h, chainNullifiers, ownRhos),
    );
    const err = await restore(chain).catch((e: unknown) => e);
    spy.mockRestore();
    expect((err as A0RecoveryError).code).toBe('E_A0_RECOVERY_NATIVE');
    expect(fake.liveHandle()).toBeNull();
    expect(mmkvSecure()!.getString(KEY)).toBeUndefined();
    expect(mmkvSecure()!.getString('v1_accounts')).toBeUndefined();
  });

  it('"spent" by the full matchSpent, then no nullifier attributes it → E_A0_RECOVERY_NATIVE (the loop cannot spin)', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000n);
    ownUnshield(chain, d0, {to: STRANGER});
    const real = fake.matchSpent.bind(fake);
    let single = 0;
    const spy = jest.spyOn(fake, 'matchSpent').mockImplementation(async (h, chainNullifiers, ownRhos) => {
      if (chainNullifiers.length !== 1) {
        return real(h, chainNullifiers, ownRhos);
      }
      // a recovery without the guard would ask forever (and starve Jest's timers): fail it fast instead
      if (++single > 200) {
        throw new Error('the attribution is spinning');
      }
      return [];
    });
    const err = await restore(chain).catch((e: unknown) => e);
    spy.mockRestore();
    expect((err as A0RecoveryError).code).toBe('E_A0_RECOVERY_NATIVE');
    expect(single).toBeLessThan(200); // one pass over the synced nullifiers, then the refusal
    expect(fake.liveHandle()).toBeNull();
  });

  it('an out-of-range attribution answer → E_A0_RECOVERY_NATIVE', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000n);
    ownUnshield(chain, d0, {to: STRANGER});
    const real = fake.matchSpent.bind(fake);
    const spy = jest.spyOn(fake, 'matchSpent').mockImplementation(async (h, chainNullifiers, ownRhos) =>
      chainNullifiers.length === 1 ? [1] : real(h, chainNullifiers, ownRhos),
    );
    const err = await restore(chain).catch((e: unknown) => e);
    spy.mockRestore();
    expect((err as A0RecoveryError).code).toBe('E_A0_RECOVERY_NATIVE');
  });
});

describe('two successful withdrawals with one nullifier (impossible on chain: the nullifier PDA is init)', () => {
  it('refuse the recovery when a note of ours is spent (E_A0_RECOVERY_DUPLICATE_NULLIFIER), the handle closed, nothing written', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000n);
    ownUnshield(chain, d0, {to: STRANGER});
    appendWithdraw(chain, {nullifier: own.nullifier(d0.rho), changeCommitment: strangerField(4)});
    const err = await restore(chain).catch((e: unknown) => e);
    expect((err as A0RecoveryError).code).toBe('E_A0_RECOVERY_DUPLICATE_NULLIFIER');
    expect(fake.liveHandle()).toBeNull();
    expect(mmkvSecure()!.getString(KEY)).toBeUndefined();
  });

  it('control: with nothing of ours spent, the change step reads no nullifier and the restore succeeds', async () => {
    const chain = fresh();
    ownDeposit(chain, 0n, 1_000_000n);
    appendWithdraw(chain, {nullifier: strangerField(5), changeCommitment: strangerField(6)});
    appendWithdraw(chain, {nullifier: strangerField(5), changeCommitment: strangerField(7)});
    expect((await restore(chain)).notes.map(n => n.status)).toEqual(['unspent']);
  });
});

describe('the restore into an existing store (chain truth wins for note state)', () => {
  it('a stored note mid-unshield (pending, pendingSince) whose spend LANDED becomes spent with the landed tx; its change comes back', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000n);
    addA0PendingDeposit({commitment: d0.commitment, amount: 1_000_000n, rho: d0.rho, depositIndex: 0n, lastValidBlockHeight: 1});
    confirmA0Deposit(d0.rho, {leafIndex: d0.leafIndex, commitment: d0.commitment});
    // what Task 7 writes before submit: the note pending with pendingSince (chain time)
    mmkvSecure()!.set(
      KEY,
      mmkvSecure()!.getString(KEY)!.replace('"status":"unspent"', '"status":"pending","pendingSince":1763400000'),
    );
    expect(loadA0NoteStore().notes[0]).toMatchObject({status: 'pending', pendingSince: 1763400000});
    const u = ownUnshield(chain, d0, {to: STRANGER});
    await restore(chain);
    expect(loadA0NoteStore().notes).toEqual([
      {commitment: d0.commitment, amount: 1_000_000n, rho: d0.rho, depositIndex: 0n, leafIndex: 17, status: 'spent', spentTx: u.signature},
      {commitment: u.commitment, amount: 590_000n, rho: u.rho, leafIndex: 18, status: 'unspent'},
    ]);
  });

  it('a stored spent note WITHOUT spentTx (an M1b restore) gets it; a stored spent note is never made unspent', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000n);
    const d1 = ownDeposit(chain, 1n, 2_000_000n);
    const u = ownUnshield(chain, d0, {to: STRANGER});
    mergeA0RecoveredNotes(
      [
        {commitment: d0.commitment, amount: 1_000_000n, rho: d0.rho, depositIndex: 0n, leafIndex: 17, status: 'spent'},
        {commitment: d1.commitment, amount: 2_000_000n, rho: d1.rho, depositIndex: 1n, leafIndex: 18, status: 'spent'},
      ],
      2n,
    );
    await restore(chain);
    const notes = loadA0NoteStore().notes;
    expect(notes[0]).toEqual({commitment: d0.commitment, amount: 1_000_000n, rho: d0.rho, depositIndex: 0n, leafIndex: 17, status: 'spent', spentTx: u.signature});
    expect(notes[1]).toEqual({commitment: d1.commitment, amount: 2_000_000n, rho: d1.rho, depositIndex: 1n, leafIndex: 18, status: 'spent'});
  });
});

const SIG_X = '5'.repeat(88);
const SIG_Y = '6'.repeat(88);
describe('the merge of a recovered spend (spentTx: fill, keep, correct)', () => {
  const spentNote = (d: {rho: string; commitment: string}, spentTx?: string) => ({
    commitment: d.commitment,
    amount: 1_000_000n,
    rho: d.rho,
    depositIndex: 0n,
    leafIndex: 17,
    status: 'spent' as const,
    ...(spentTx === undefined ? {} : {spentTx}),
  });

  it('(a) a stored spent note WITH spentTx merged with a recovered spent note WITHOUT it (the pre-check import) keeps the stored spentTx', () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000n);
    mergeA0RecoveredNotes([spentNote(d0, SIG_X)], 1n);
    mergeA0RecoveredNotes([spentNote(d0)], 1n);
    expect(loadA0NoteStore().notes).toEqual([spentNote(d0, SIG_X)]);
  });

  it('(b) a stored spentTx X merged with a recovered spent note naming Y becomes Y (chain truth corrects)', () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000n);
    mergeA0RecoveredNotes([spentNote(d0, SIG_X)], 1n);
    mergeA0RecoveredNotes([spentNote(d0, SIG_Y)], 1n);
    expect(loadA0NoteStore().notes).toEqual([spentNote(d0, SIG_Y)]);
  });
});

describe('exit accounts (§7 "Accounts", I6, S9)', () => {
  const registry = () => loadA0AccountRegistry()!.map(e => [e.scheme, e.role, e.address]);

  it('an unshield to the test seed\'s slip10:1 ATA → slip10:1 becomes fresh-exit; the main stays; the walk stops once every destination matched', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000n);
    ownUnshield(chain, d0, {to: to(1)});
    const res = await restore(chain);
    expect(res.exitAccounts).toEqual(['slip10:1']);
    expect(registry()).toEqual([
      ['slip10:0', 'main', acct(0).address],
      ['slip10:1', 'fresh-exit', acct(1).address],
    ]);
    expect(res.stats).toMatchObject({exitAccounts: 1, accountIndicesTried: 2});
  });

  it('an exit of ours whose change leaf is NOT ours is still our exit (only nk spends our note): slip10:2 found', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000n);
    ownUnshield(chain, d0, {to: to(2), changeOverride: strangerField(10)});
    const res = await restore(chain);
    expect(res.exitAccounts).toEqual(['slip10:2']);
    expect(res.stats).toMatchObject({changeNotes: 0, unmatchedChangeLeaves: 1, exitAccounts: 1});
  });

  it('a restore with no unshield still creates the registry with its main (and derives nothing)', async () => {
    const chain = fresh();
    ownDeposit(chain, 0n, 1_000_000n);
    const res = await restore(chain);
    expect(res.exitAccounts).toEqual([]);
    expect(registry()).toEqual([['slip10:0', 'main', acct(0).address]]);
    expect(res.stats).toMatchObject({exitAccounts: 0, accountIndicesTried: 0});
  });

  it(`the gap: ${A0_ACCOUNT_DISCOVERY_GAP} indices past the highest match (none: 0…19). From the start slip10:19 is found, slip10:20 is not`, async () => {
    expect(A0_ACCOUNT_DISCOVERY_GAP).toBe(20); // controller ruling 7: S15 is the deposit gap only
    const at19 = fresh();
    const a = ownDeposit(at19, 0n, 1_000_000n);
    const ua = ownUnshield(at19, a, {to: to(19)});
    ownUnshield(at19, {rho: ua.rho, amount: ua.amount}, {to: STRANGER}); // an unmatched destination keeps the walk going
    expect((await restore(at19)).exitAccounts).toEqual(['slip10:19']);

    clearAllStores();
    initSecureMmkv('test-key');
    const at20 = fresh();
    const b = ownDeposit(at20, 0n, 1_000_000n);
    const ub = ownUnshield(at20, b, {to: to(20)});
    ownUnshield(at20, {rho: ub.rho, amount: ub.amount}, {to: STRANGER});
    const res = await restore(at20);
    expect(res.exitAccounts).toEqual([]);
    expect(res.stats.accountIndicesTried).toBe(20);
  });

  it('after a match at 3 the walk reaches 23 (found) and stops before 24 (not found)', async () => {
    const run = async (far: number) => {
      clearAllStores();
      initSecureMmkv('test-key');
      const chain = fresh();
      const d = ownDeposit(chain, 0n, 9_000_000n);
      const u1 = ownUnshield(chain, d, {to: to(3)});
      const u2 = ownUnshield(chain, {rho: u1.rho, amount: u1.amount}, {to: to(far)});
      ownUnshield(chain, {rho: u2.rho, amount: u2.amount}, {to: STRANGER});
      return restore(chain);
    };
    const r23 = await run(23);
    expect(r23.exitAccounts).toEqual(['slip10:3', 'slip10:23']);
    expect(r23.stats.accountIndicesTried).toBe(44);
    const r24 = await run(24);
    expect(r24.exitAccounts).toEqual(['slip10:3']);
    expect(r24.stats.accountIndicesTried).toBe(24);
  });

  it('an unshield to the MAIN account\'s ATA ("My main account") changes no role', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000n);
    ownUnshield(chain, d0, {to: to(0)});
    const res = await restore(chain);
    expect(res.exitAccounts).toEqual([]);
    expect(registry()).toEqual([['slip10:0', 'main', acct(0).address]]);
    expect(res.stats.exitAccounts).toBe(1); // matched (index 0), already the main
  });

  it('a main of slip10:3 stays slip10:3; an exit to slip10:0 is added beside it', async () => {
    storeTransparentScheme({kind: 'slip10', account: 3});
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000n);
    ownUnshield(chain, d0, {to: to(0)});
    await restore(chain);
    expect(registry()).toEqual([
      ['slip10:3', 'main', acct(3).address],
      ['slip10:0', 'fresh-exit', acct(0).address],
    ]);
  });

  it('the OTHER seed\'s slip10:1 ATA is not ours: no exit account', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000n);
    ownUnshield(chain, d0, {to: to(1, 1)});
    const res = await restore(chain);
    expect(res.exitAccounts).toEqual([]);
    expect(res.stats.accountIndicesTried).toBe(20);
  });

  it('a cli wallet (S9): no index is derived, no exit account even for an unshield to slip10:1\'s ATA; the registry is its one main', async () => {
    storeTransparentScheme({kind: 'cli'});
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000n);
    ownUnshield(chain, d0, {to: to(1)});
    const res = await restore(chain);
    expect(res.exitAccounts).toEqual([]);
    expect(res.stats.accountIndicesTried).toBe(0);
    expect(loadA0AccountRegistry()!.map(e => [e.scheme, e.role])).toEqual([['cli', 'main']]);
  });

  it('a fresh-pending reservation the restore finds landed is promoted to fresh-exit', async () => {
    const reserved = await reserveA0FreshAccount({getSignaturesForAddress: async () => []} as never, seedBytes(TEST_SEED));
    expect(reserved.scheme).toBe('slip10:1');
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000n);
    ownUnshield(chain, d0, {to: to(1)});
    const res = await restore(chain);
    expect(res.exitAccounts).toEqual(['slip10:1']);
    expect(registry()).toEqual([
      ['slip10:0', 'main', acct(0).address],
      ['slip10:1', 'fresh-exit', acct(1).address],
    ]);
  });

  it('WRITE ORDER: an unreadable registry refuses the restore BEFORE the notes are written (the next start restores again)', async () => {
    mmkvSecure()!.set('v1_accounts', '{"schema":1,"accounts":[]}');
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000n);
    ownUnshield(chain, d0, {to: to(1)});
    await expect(restore(chain)).rejects.toMatchObject({code: 'E_A0_ACCOUNTS_CORRUPT'});
    expect(mmkvSecure()!.getString(KEY)).toBeUndefined();
    expect(fake.liveHandle()).toBeNull();
  });

  it('the seed is zero-filled after the account walk used it; keysOpen got a copy (also zero-filled)', async () => {
    const chain = fresh();
    const d0 = ownDeposit(chain, 0n, 1_000_000n);
    ownUnshield(chain, d0, {to: to(1)});
    const seed = seedBytes(TEST_SEED);
    const res = await restore(chain, seed);
    expect(res.exitAccounts).toEqual(['slip10:1']); // the walk had the seed after keysOpen consumed its copy
    expect(seed.every(b => b === 0)).toBe(true);
    expect(callsOf('keysOpen')).toHaveLength(1);
  });
});
