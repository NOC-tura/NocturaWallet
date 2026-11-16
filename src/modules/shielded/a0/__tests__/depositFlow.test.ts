/**
 * The A0 deposit flow (spec §5 steps 2–6, the ledger's ruling (1) on foreign rho hits).
 *
 * The chain is the recorded devnet history of tree 5URd… served to the REAL web3.js Connection by
 * a "live" devnet fake (liveDevnet.ts: rho markers, token accounts, blockhash, simulate, send with
 * signature verification, statuses); a sent deposit LANDS as our own signed message spliced into
 * a clone of the landed 3DR6F7oW… with the tree account advanced the way the program does it — so
 * the real tree sync verifies the leaf this flow then reads. The native core is the offline fake
 * (offlineA0.ts) behind the real bridge, proving the deposit circuit from the offline equations.
 * Every expected value here — rho, commitment, mintHash, PDAs, the instruction bytes — comes from
 * the offline vector file, the IDL layout written out below, or the real web3.js; never from the
 * code under test.
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
import {clearAllStores, initSecureMmkv, mmkvSecure} from '../../../../store/mmkv/instances';
import {KEY_VECTORS, OTHER_SEED, TEST_SEED, offlineDepositProver, offlineKeys, seedBytes} from '../__testing__/offlineA0';
import type {FakeProverNative} from '../__testing__/offlineA0';
import {appendDeposit, rhoPda} from '../__testing__/ownHistory';
import {chainFrom} from '../__testing__/recordedRpc';
import type {RecordedFixture} from '../__testing__/recordedRpc';
import {DEVNET_GENESIS, LIVE_BLOCKHASH, fundTokenAccount, liveDevnet} from '../__testing__/liveDevnet';
import type {LiveDevnet} from '../__testing__/liveDevnet';
import {deriveTransparentKeypair} from '../../../keyDerivation/transparent';
import type {AssetIO} from '../../../zkProver/provingAssets';
import {addA0PendingDeposit, hasA0NoteRecord, loadA0NoteStore, setA0NextDepositIndex} from '../noteStore';
import {
  A0_MINT_HASH,
  A0DepositError,
  clearA0SettleTimersForTests,
  prepareA0Deposit,
  reconcileA0PendingDeposits,
  simulateA0Deposit,
  submitA0Deposit,
} from '../depositFlow';
import type {A0PreparedDeposit} from '../depositFlow';

const TREE = JSON.parse(readFileSync(join(__dirname, 'fixtures/devnet-tree-5URd.json'), 'utf8')) as RecordedFixture;
const fake = NativeModules.NocturaProver as unknown as FakeProverNative;
const own = offlineKeys(TEST_SEED);
const other = offlineKeys(OTHER_SEED);
const KEY = 'v1_a0_notes';

// The facts, written out (spec §1 / the IDL), not imported from the code under test.
const PROGRAM = 'FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH';
const POOL = '8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT';
const TREE_ADDR = '5URdh1uLKXPh28AbcXBK1oWYGpQjVbMSjrKiAkt1q1Gc';
const VAULT = '3A7JjFg4ZbZrEsvAZReSaWxjCvi5NZUTAyAZaLfQjuYC';
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const SYSTEM = '11111111111111111111111111111111';
const BUDGET = 'ComputeBudget111111111111111111111111111111';
const DEPOSIT_DISC = 'f223c68952e1f2b6';
/** the recorded tree holds 17 leaves (account nextLeafIndex at slot 522620135) */
const RECORDED_LEAVES = 17;

const AMOUNT = 2_500_000n;
const DEPOSITOR = new PublicKey(deriveTransparentKeypair(seedBytes(TEST_SEED)).publicKey).toBase58();
const hex = (b: Uint8Array): string => Buffer.from(b).toString('hex');
const be32 = (v: bigint): string => v.toString(16).padStart(64, '0');

/** An in-memory AssetIO: a downloaded file "contains" the digest its content-addressed URL names. */
function memoryIO(opts: {tamper?: boolean} = {}): AssetIO & {downloads: string[]} {
  const files = new Map<string, string>();
  const downloads: string[] = [];
  return {
    downloads,
    cachePath: (id, kind) => `/cache/noctura-${id}.${kind}`,
    exists: async p => files.has(p),
    download: async (url, p) => {
      downloads.push(url);
      const m = /\/h\/([0-9a-f]{64})\//.exec(url);
      files.set(p, opts.tamper ? '00'.repeat(32) : m![1]!);
    },
    sha256: async p => files.get(p)!,
    remove: async p => {
      files.delete(p);
    },
  };
}

let net: LiveDevnet;
let dta: string;

beforeEach(() => {
  clearAllStores();
  initSecureMmkv('test-key');
  fake.reset();
  fake.setProver(offlineDepositProver);
  net = liveDevnet(chainFrom(TREE));
  dta = fundTokenAccount(net, DEPOSITOR, 10_000_000n);
  loadA0NoteStore(); // the A0 record exists (the startup step ran)
});
afterEach(() => {
  clearA0SettleTimersForTests(); // R1-m7: no settle pause outlives its test
});


const prepare = (amount = AMOUNT, io: AssetIO = memoryIO(), seed = seedBytes(TEST_SEED)) =>
  prepareA0Deposit(net.connection, seed, amount, {io, sync: {useCache: false}});
const submit = (p: A0PreparedDeposit, seed = seedBytes(TEST_SEED)) =>
  submitA0Deposit(net.connection, p, seed, {sync: {useCache: false}, settleAttempts: 1});
const raw = () => mmkvSecure()!.getString(KEY);
const callsOf = (m: string) => fake.calls.filter(c => c.method === m);
const methods = () => net.requests.map(r => r.method);

describe('the facts this suite leans on', () => {
  it('mintHash = be_mod_r(mint) is the offline vector file\'s value', () => {
    expect(A0_MINT_HASH).toBe(KEY_VECTORS.constants.mintHash);
  });
  it('the test seed\'s main account is the SLIP-0010 m/44\'/501\'/0\'/0\' address of abandon … about', () => {
    expect(DEPOSITOR).toBe('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
  });
});

describe('a deposit end to end: pending before submit → confirmed → unspent at its LeafInserted', () => {
  it('prepares, simulates, submits, and the note is unspent with the leaf the program inserted', async () => {
    const stages: string[] = [];
    const p = await prepareA0Deposit(net.connection, seedBytes(TEST_SEED), AMOUNT, {
      io: memoryIO(),
      sync: {useCache: false},
      onStage: s => stages.push(s),
    });
    expect(stages).toEqual(['checking', 'keyFiles', 'precheck', 'commitment', 'proving', 'verifying']);
    const rho0 = own.rho(0n);
    expect(p).toMatchObject({
      amount: AMOUNT,
      depositIndex: 0n,
      rho: rho0,
      commitment: own.commitment(AMOUNT, rho0),
      depositor: DEPOSITOR,
      depositorTokenAccount: dta,
      importedNotes: 0,
      foreignRhoHits: 0,
    });
    expect(p.proof).toHaveLength(256);
    // prepare wrote nothing
    expect(loadA0NoteStore()).toEqual({nextDepositIndex: 0n, notes: []});

    const sim = await simulateA0Deposit(net.connection, p);
    expect(sim.simulation.success).toBe(true);
    expect(sim.checks.map(c => c.status)).toEqual(['ok', 'ok']);

    const subStages: string[] = [];
    const out = await submitA0Deposit(net.connection, p, seedBytes(TEST_SEED), {
      sync: {useCache: false},
      onStage: s => subStages.push(s),
    });
    expect(subStages).toEqual(['signing', 'recorded', 'submitted', 'confirming', 'settling']);
    expect(out.status).toBe('unspent');
    if (out.status !== 'unspent') {
      return;
    }
    expect(out.signature).toBe(net.sent[0]!.signature);
    expect(out.leafIndex).toBe(RECORDED_LEAVES);
    // the root the program side's insert algorithm (ownHistory, poseidon-lite) wrote into the event
    const landed = net.chain.transactions[out.signature]!;
    const blob = landed.meta.logMessages
      .filter(l => l.startsWith('Program data: '))
      .map(l => Buffer.from(l.slice(14), 'base64'))
      .find(b => hex(b.subarray(0, 8)) === '59f3d408d7bfbb98')!;
    expect(hex(blob.subarray(8, 40))).toBe(p.commitment);
    expect(out.root).toBe(hex(blob.subarray(48, 80)));
    expect(loadA0NoteStore()).toEqual({
      nextDepositIndex: 1n,
      notes: [{commitment: p.commitment, amount: AMOUNT, rho: rho0, depositIndex: 0n, leafIndex: RECORDED_LEAVES, status: 'unspent'}],
    });
  });

  it('the pending note and the counter are ONE write made BEFORE the send', async () => {
    const p = await prepare();
    const writes: {raw: string; sentBefore: number}[] = [];
    const store = mmkvSecure()!;
    const set = store.set.bind(store);
    store.set = (k: string, v: boolean | string | number | ArrayBuffer) => {
      if (k === KEY) {
        writes.push({raw: String(v), sentBefore: net.sent.length});
      }
      set(k, v);
    };
    await submit(p);
    const first = JSON.parse(writes[0]!.raw) as {nextDepositIndex: string; notes: {status: string; lastValidBlockHeight: number}[]};
    expect(writes[0]!.sentBefore).toBe(0);
    expect(first.nextDepositIndex).toBe('1');
    expect(first.notes).toEqual([
      expect.objectContaining({status: 'pending', depositIndex: '0', lastValidBlockHeight: net.height.confirmed + 150}),
    ]);
  });
});

describe('the transaction: its instructions, CU and signer, exactly', () => {
  it('[setComputeUnitLimit(200,000), deposit] in a legacy message signed by the depositor alone', async () => {
    const p = await prepare();
    await submit(p);
    expect(net.sent).toHaveLength(1);
    const tx = net.sent[0]!.tx;
    expect(tx.version).toBe('legacy');
    expect(tx.message.recentBlockhash).toBe(LIVE_BLOCKHASH);
    expect(tx.message.header.numRequiredSignatures).toBe(1);
    expect(tx.signatures).toHaveLength(1);
    const keys = tx.message.staticAccountKeys.map(k => k.toBase58());
    expect(keys[0]).toBe(DEPOSITOR); // fee payer = the only signer
    const ixs = tx.message.compiledInstructions;
    expect(ixs.map(i => keys[i.programIdIndex])).toEqual([BUDGET, PROGRAM]);
    // ComputeBudget: tag 2 (SetComputeUnitLimit), u32 LE 200,000
    expect([...ixs[0]!.data]).toEqual([2, 0x40, 0x0d, 0x03, 0x00]);
    expect(ixs[0]!.accountKeyIndexes).toEqual([]);
    // deposit: disc | amount u64 LE | commitment | rho | u32 LE 256 | proof (§1, 340 bytes)
    const d = Uint8Array.from(ixs[1]!.data);
    expect(d).toHaveLength(340);
    expect(hex(d.subarray(0, 8))).toBe(DEPOSIT_DISC);
    expect(new DataView(d.buffer).getBigUint64(8, true)).toBe(AMOUNT);
    expect(hex(d.subarray(16, 48))).toBe(own.commitment(AMOUNT, own.rho(0n)));
    expect(hex(d.subarray(48, 80))).toBe(own.rho(0n));
    expect([...d.subarray(80, 84)]).toEqual([0, 1, 0, 0]);
    expect(hex(d.subarray(84))).toBe(hex(p.proof));
    // the IDL's account order and flags
    const marker = PublicKey.findProgramAddressSync([Buffer.from('rho'), Buffer.from(own.rho(0n), 'hex')], new PublicKey(PROGRAM))[0];
    const h = tx.message.header;
    const flags = (i: number) => ({
      signer: i < h.numRequiredSignatures,
      writable:
        i < h.numRequiredSignatures
          ? i < h.numRequiredSignatures - h.numReadonlySignedAccounts
          : i < keys.length - h.numReadonlyUnsignedAccounts,
    });
    expect(ixs[1]!.accountKeyIndexes.map(i => [keys[i], flags(i)])).toEqual([
      [POOL, {signer: false, writable: false}],
      [TREE_ADDR, {signer: false, writable: true}],
      [VAULT, {signer: false, writable: true}],
      [DEPOSITOR, {signer: true, writable: true}],
      [dta, {signer: false, writable: true}],
      [marker.toBase58(), {signer: false, writable: true}],
      [TOKEN, {signer: false, writable: false}],
      [SYSTEM, {signer: false, writable: false}],
    ]);
    expect(keys).toHaveLength(10); // nothing else in the message
    // sent once, with the RPC's preflight ON (a failing deposit is refused before it costs a fee)
    const sends = net.requests.filter(r => r.method === 'sendTransaction');
    expect(sends).toHaveLength(1);
    // (web3.js leaves skipPreflight out when it is false — the RPC's default is to preflight)
    expect(sends[0]!.params[1]).toEqual({encoding: 'base64', preflightCommitment: 'confirmed'});
  });

  it('the proof was made on the device from {amount, depositIndex} with the pinned A0 deposit key files', async () => {
    const io = memoryIO();
    await prepare(AMOUNT, io);
    expect(io.downloads).toEqual([
      'https://api.noc-tura.io/api/v1/zk-assets/h/fef08f0217a44c8c1629f5f8d670047461205c1fced83d7ea6fe763420e53fe9/a0/deposit_final.zkey',
      'https://api.noc-tura.io/api/v1/zk-assets/h/1d69d7f89792a31d4c7780afa52b2f11707a4347f61382e7b294f4848d7dfff1/a0/deposit.wasm',
    ]);
    const prove = callsOf('prove');
    expect(prove).toHaveLength(1);
    expect(prove[0]!.args.slice(1)).toEqual([
      'deposit',
      `{"amount":"${AMOUNT}","depositIndex":"0"}`,
      null,
      '/cache/noctura-a0-deposit.zkey',
      '/cache/noctura-a0-deposit.wasm',
    ]);
    // one handle, opened after the requests that need no key, closed at the end
    expect(fake.calls.map(c => c.method)).toEqual(['keysOpen', 'depositRho', 'commitment', 'prove', 'keysClose']);
    expect(fake.liveHandle()).toBeNull();
  });

  it('the only own-value lookup is the pre-check of the next rho PDA; the leaf comes from the sync', async () => {
    const p = await prepare();
    await submit(p);
    const accountLookups = net.requests.filter(r => r.method === 'getAccountInfo').map(r => r.params[0]);
    expect(accountLookups).toEqual([rhoPda(own.rho(0n)), TREE_ADDR]);
    // every getTransaction names a signature the tree listing returned (the sync everyone runs)
    expect(net.requests.filter(r => r.method === 'getTransaction')).toHaveLength(TREE.signatures.length + 1);
    expect(new Set(methods())).toEqual(
      new Set([
        'getGenesisHash',
        'getTokenAccountsByOwner',
        'getAccountInfo',
        'getLatestBlockhash',
        'sendTransaction',
        'getSignatureStatuses',
        'getSignaturesForAddress',
        'getTransaction',
      ]),
    );
  });
});

describe('§5 step 4: the public inputs are compared in order; a mismatch aborts before any write', () => {
  const tampered = (fn: (pi: string[]) => string[]) => {
    fake.setProver((keys, req) => {
      const r = offlineDepositProver(keys, req);
      return {...r, publicInputs: fn([...r.publicInputs])};
    });
  };
  it.each([
    ['commitment (the circuit\'s Poseidon ≠ Rust\'s)', (pi: string[]) => [be32(1n), ...pi.slice(1)], /public input 0 \(commitment\)/],
    ['amount', (pi: string[]) => [pi[0]!, be32(AMOUNT + 1n), ...pi.slice(2)], /public input 1 \(amount\)/],
    ['mintHash', (pi: string[]) => [pi[0]!, pi[1]!, be32(5n), pi[3]!], /public input 2 \(mintHash\)/],
    ['rho (≠ depositRho(i))', (pi: string[]) => [...pi.slice(0, 3), own.rho(1n)], /public input 3 \(rho\)/],
    ['three inputs', (pi: string[]) => pi.slice(0, 3), /3 public inputs/],
    ['five inputs', (pi: string[]) => [...pi, be32(0n)], /5 public inputs/],
  ])('%s → E_A0_DEPOSIT_PUBLIC_INPUTS, the store byte-identical, nothing sent, keys closed', async (_l, fn, msg) => {
    tampered(fn);
    const before = raw();
    const err = await prepare().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(A0DepositError);
    expect((err as A0DepositError).code).toBe('E_A0_DEPOSIT_PUBLIC_INPUTS');
    expect((err as Error).message).toMatch(msg);
    expect(raw()).toBe(before);
    expect(net.sent).toHaveLength(0);
    expect(fake.liveHandle()).toBeNull();
    expect(callsOf('keysClose')).toHaveLength(1);
  });

  it('positive control: the untampered proof passes the same comparison', async () => {
    tampered(pi => pi);
    await expect(prepare()).resolves.toMatchObject({depositIndex: 0n});
  });

  it('a proof that is not 256 bytes of hex aborts (E_A0_DEPOSIT_PROOF_SHAPE)', async () => {
    fake.setProver((keys, req) => ({...offlineDepositProver(keys, req), proofBytes: 'ab'.repeat(255)}));
    await expect(prepare()).rejects.toMatchObject({code: 'E_A0_DEPOSIT_PROOF_SHAPE'});
  });
});

describe('§5 step 2: the rho-PDA pre-check (the ledger\'s ruling (1))', () => {
  it('a PDA of OUR note the store does not know → imported exactly as recovery does, then the next counter', async () => {
    const rho0 = own.rho(0n);
    const landed = appendDeposit(net.chain, {amount: 700n, rho: rho0, commitment: own.commitment(700n, rho0)});
    net.accounts.set(rhoPda(rho0), {owner: PROGRAM, finalized: true});
    const p = await prepare();
    expect(p).toMatchObject({depositIndex: 1n, rho: own.rho(1n), importedNotes: 1, foreignRhoHits: 0});
    expect(loadA0NoteStore()).toEqual({
      nextDepositIndex: 1n,
      notes: [{commitment: own.commitment(700n, rho0), amount: 700n, rho: rho0, depositIndex: 0n, leafIndex: landed.leafIndex, status: 'unspent'}],
    });
    // two PDA lookups (counter 0: present, counter 1: absent) around one sync
    expect(net.requests.filter(r => r.method === 'getAccountInfo').map(r => r.params[0])).toEqual([
      rhoPda(rho0),
      TREE_ADDR,
      rhoPda(own.rho(1n)),
    ]);
  });

  it('a FOREIGN hit (somebody deposited under our public rho, their commitment) → skipped: not imported, no throw, counter past it', async () => {
    const rho0 = own.rho(0n);
    net.landForeign({amount: 700n, rho: rho0, commitment: other.commitment(700n, rho0)});
    const p = await prepare();
    expect(p).toMatchObject({depositIndex: 1n, rho: own.rho(1n), importedNotes: 0, foreignRhoHits: 1});
    expect(loadA0NoteStore()).toEqual({nextDepositIndex: 1n, notes: []});
    const out = await submit(p);
    expect(out).toMatchObject({status: 'unspent', leafIndex: RECORDED_LEAVES + 1});
    expect(loadA0NoteStore().nextDepositIndex).toBe(2n);
  });

  it('a PDA whose deposit the sync does not show yet → E_A0_DEPOSIT_PRECHECK_UNSYNCED, nothing written', async () => {
    net.accounts.set(rhoPda(own.rho(0n)), {owner: PROGRAM, finalized: true});
    const before = raw();
    await expect(prepare()).rejects.toMatchObject({code: 'E_A0_DEPOSIT_PRECHECK_UNSYNCED'});
    expect(raw()).toBe(before);
    expect(callsOf('prove')).toHaveLength(0);
  });

  it('a system-owned account at the PDA (lamports sent there) is not a rho marker → counter 0 is used', async () => {
    net.accounts.set(rhoPda(own.rho(0n)), {owner: SYSTEM, finalized: true});
    await expect(prepare()).resolves.toMatchObject({depositIndex: 0n});
  });

  it('the counter in the store is the one used (a raised counter is never reused)', async () => {
    setA0NextDepositIndex(5n);
    await expect(prepare()).resolves.toMatchObject({depositIndex: 5n, rho: own.rho(5n)});
  });
});

describe('refusals before any key is opened (the seed is consumed on every path)', () => {
  const refused = async (run: (seed: Uint8Array) => Promise<unknown>, code: string) => {
    const seed = seedBytes(TEST_SEED);
    await expect(run(seed)).rejects.toMatchObject({code});
    expect([...seed].every(b => b === 0)).toBe(true);
    expect(callsOf('keysOpen')).toHaveLength(0);
    expect(net.sent).toHaveLength(0);
  };
  it.each([
    ['amount 0', 0n],
    ['amount 2^64', 2n ** 64n],
  ])('%s → E_A0_DEPOSIT_AMOUNT', async (_l, amount) => {
    await refused(seed => prepare(amount, memoryIO(), seed), 'E_A0_DEPOSIT_AMOUNT');
  });
  it('an RPC that is not devnet (genesis) → E_A0_DEPOSIT_CLUSTER', async () => {
    net.genesisHash = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'; // mainnet-beta
    await refused(seed => prepare(AMOUNT, memoryIO(), seed), 'E_A0_DEPOSIT_CLUSTER');
  });
  it('positive control: the devnet genesis passes', async () => {
    expect(net.genesisHash).toBe(DEVNET_GENESIS);
    await expect(prepare()).resolves.toBeDefined();
  });
  it('no A0 record yet (the startup restore has not run) → E_A0_DEPOSIT_NOT_READY, and no record is created', async () => {
    mmkvSecure()!.remove(KEY);
    await refused(seed => prepare(AMOUNT, memoryIO(), seed), 'E_A0_DEPOSIT_NOT_READY');
    expect(raw()).toBeUndefined();
    expect(net.requests).toHaveLength(0);
  });
  it('no token account of the mint → E_A0_DEPOSIT_NO_TOKEN_ACCOUNT', async () => {
    net.tokenAccounts.length = 0;
    await refused(seed => prepare(AMOUNT, memoryIO(), seed), 'E_A0_DEPOSIT_NO_TOKEN_ACCOUNT');
  });
  it('a key file whose sha256 is not the pin → refused, the file deleted, no key opened', async () => {
    const seed = seedBytes(TEST_SEED);
    await expect(prepare(AMOUNT, memoryIO({tamper: true}), seed)).rejects.toThrow(/SHA-256 mismatch/);
    expect(callsOf('keysOpen')).toHaveLength(0);
    expect([...seed].every(b => b === 0)).toBe(true);
  });
});

describe('submit refusals and outcomes that leave the note pending', () => {
  it('a seed that is not the depositor\'s → E_A0_DEPOSIT_SIGNER, nothing written, nothing sent', async () => {
    const p = await prepare();
    const before = raw();
    const seed = seedBytes(OTHER_SEED);
    await expect(submit(p, seed)).rejects.toMatchObject({code: 'E_A0_DEPOSIT_SIGNER'});
    expect(raw()).toBe(before);
    expect(net.sent).toHaveLength(0);
    expect([...seed].every(b => b === 0)).toBe(true);
  });

  it('two deposits prepared on one counter: the second refuses at the pending write (E_A0_COUNTER_MISMATCH), unsent', async () => {
    const a = await prepare();
    const b = await prepare(AMOUNT + 1n);
    expect(b.depositIndex).toBe(a.depositIndex);
    await submit(a);
    await expect(submit(b)).rejects.toMatchObject({code: 'E_A0_COUNTER_MISMATCH'});
    expect(net.sent).toHaveLength(1);
  });

  it('a preflight refusal → pending (send-failed); the startup reconciliation drops it once expired, counter kept', async () => {
    const p = await prepare();
    net.sendError = 'Transaction simulation failed';
    const out = await submit(p);
    expect(out).toMatchObject({status: 'pending', reason: 'send-failed'});
    expect(loadA0NoteStore().notes[0]!.status).toBe('pending');
    net.height.finalized = net.height.confirmed + 151;
    await expect(reconcileA0PendingDeposits(net.connection, {sync: {useCache: false}})).resolves.toEqual({
      confirmed: [],
      dropped: [{rho: p.rho, reason: 'expired'}],
      stillPending: [],
    });
    expect(loadA0NoteStore()).toEqual({nextDepositIndex: 1n, notes: []});
  });

  it('a foreign deposit lands our rho between prepare and submit: our tx fails at init → pending; reconciled as foreign, dropped', async () => {
    const p = await prepare();
    net.landForeign({amount: 9n, rho: p.rho, commitment: other.commitment(9n, p.rho)});
    const out = await submit(p);
    expect(out).toMatchObject({status: 'pending', reason: 'not-confirmed'});
    expect(net.sent[0]!.outcome).toBe('failed-init');
    await expect(reconcileA0PendingDeposits(net.connection, {sync: {useCache: false}})).resolves.toEqual({
      confirmed: [],
      dropped: [{rho: p.rho, reason: 'foreign'}],
      stillPending: [],
    });
    expect(loadA0NoteStore()).toEqual({nextDepositIndex: 1n, notes: []});
  });

  it('confirmed but not yet in the synced history → pending (not-in-sync), never a guess', async () => {
    const p = await prepare();
    net.onSend = () => 'land';
    // the listing lags: the landed signature is not listed yet
    const listing = net.chain.signatures;
    const out = await submitA0Deposit(net.connection, p, seedBytes(TEST_SEED), {
      sync: {useCache: false},
      settleAttempts: 1,
      onStage: s => {
        if (s === 'settling') {
          net.chain.signatures = listing.filter(x => x.signature !== net.sent[0]!.signature);
        }
      },
    });
    expect(out).toMatchObject({status: 'pending', reason: 'not-in-sync'});
    expect(loadA0NoteStore().notes[0]!.status).toBe('pending');
  });
});

describe('R1-I2: the pre-check\'s GAP and LIMIT refusals', () => {
  const ownDeposit = (i: bigint, amount: bigint) => {
    const rho = own.rho(i);
    appendDeposit(net.chain, {amount, rho, commitment: own.commitment(amount, rho)});
    net.accounts.set(rhoPda(rho), {owner: PROGRAM, finalized: true});
  };

  it('(a) the store counter is 21 past the last own hit, its PDA present and its deposit SYNCED → E_A0_DEPOSIT_PRECHECK_GAP; the store byte-identical, keys closed', async () => {
    ownDeposit(0n, 700n);
    ownDeposit(21n, 800n); // in the synced history (else UNSYNCED fires first), past the gap limit of 20
    setA0NextDepositIndex(21n);
    const before = raw();
    await expect(prepare()).rejects.toMatchObject({code: 'E_A0_DEPOSIT_PRECHECK_GAP'});
    expect(raw()).toBe(before);
    expect(fake.liveHandle()).toBeNull();
    expect(callsOf('keysClose')).toHaveLength(1);
    expect(callsOf('prove')).toHaveLength(0);
    expect(net.sent).toHaveLength(0);
  });

  it('(a) control: 20 past (inside the gap limit) → recovery reaches it, both imported, the deposit proceeds at 21', async () => {
    ownDeposit(0n, 700n);
    ownDeposit(20n, 800n);
    setA0NextDepositIndex(20n);
    await expect(prepare()).resolves.toMatchObject({depositIndex: 21n, importedNotes: 2});
    expect(loadA0NoteStore().notes.map(n => n.depositIndex)).toEqual([0n, 20n]);
  });

  /** `n` consecutive pool-owned PDAs from counter 0 whose deposits appear one per check (another
   *  device on this seed one counter ahead each time): each check is a hit the sync then shows. */
  const growing = (n: number) => {
    const rhos = Array.from({length: n}, (_v, k) => own.rho(BigInt(k)));
    rhos.forEach(r => net.accounts.set(rhoPda(r), {owner: PROGRAM, finalized: true}));
    let landed = 0;
    net.onRequest = (m, params) => {
      if (m === 'getAccountInfo' && landed < n && params[0] === rhoPda(rhos[landed]!)) {
        const amount = 100n + BigInt(landed);
        appendDeposit(net.chain, {amount, rho: rhos[landed]!, commitment: own.commitment(amount, rhos[landed]!)});
        landed++;
      }
    };
  };

  it('(b) five consecutive pool-owned PDAs → E_A0_DEPOSIT_PRECHECK_LIMIT, nothing proven, nothing sent, keys closed', async () => {
    growing(5);
    await expect(prepare()).rejects.toMatchObject({code: 'E_A0_DEPOSIT_PRECHECK_LIMIT'});
    expect(callsOf('prove')).toHaveLength(0);
    expect(net.sent).toHaveLength(0);
    expect(fake.liveHandle()).toBeNull();
    // the four hits before the refusal were imported exactly as recovery does
    expect(loadA0NoteStore()).toMatchObject({nextDepositIndex: 4n, notes: [{depositIndex: 0n}, {depositIndex: 1n}, {depositIndex: 2n}, {depositIndex: 3n}]});
  });

  it('(b) control: four consecutive hits → the deposit proceeds at counter 4', async () => {
    growing(4);
    const stages: string[] = [];
    const p = await prepareA0Deposit(net.connection, seedBytes(TEST_SEED), AMOUNT, {io: memoryIO(), sync: {useCache: false}, onStage: s => stages.push(s)});
    expect(p).toMatchObject({depositIndex: 4n, importedNotes: 4});
    expect(stages.filter(s => s === 'precheck')).toHaveLength(5);
  });
});

describe('double submit: one prepared deposit is sent at most once (CLAUDE.md rule 6)', () => {
  it('the same prepared deposit submitted twice at once → one pending write, one send; the other E_A0_COUNTER_MISMATCH', async () => {
    const p = await prepare();
    const [x, y] = await Promise.allSettled([submit(p), submit(p)]);
    const outcomes = [x, y].map(r => (r.status === 'fulfilled' ? r.value.status : (r.reason as {code: string}).code)).sort();
    expect(outcomes).toEqual(['E_A0_COUNTER_MISMATCH', 'unspent']);
    expect(net.sent).toHaveLength(1);
    expect(loadA0NoteStore().notes).toHaveLength(1);
  });
});

/** Every access to the note record on `store` from now on. */
function watch(store: NonNullable<ReturnType<typeof mmkvSecure>>): string[] {
  const log: string[] = [];
  const get = store.getString.bind(store);
  const set = store.set.bind(store);
  store.getString = (k: string) => {
    log.push(`get ${k}`);
    return get(k);
  };
  store.set = (k: string, v: boolean | string | number | ArrayBuffer) => {
    log.push(`set ${k}`);
    set(k, v);
  };
  return log;
}

async function until(cond: () => boolean, what: string): Promise<void> {
  for (let k = 0; k < 1000; k++) {
    if (cond()) {
      return;
    }
    await new Promise(r => setTimeout(r, 2));
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** In-app "Wipe wallet", then an import in the same process; returns the new instance's access log. */
function wipeAndImport(): string[] {
  clearAllStores();
  initSecureMmkv('the-imported-wallet');
  return watch(mmkvSecure()!);
}

describe('R3-N5: each writer outside the startup run is bound to the instance it started on', () => {
  /** our deposit at counter 0, landed and marked, and pending in the store (a kill before settle) */
  const landedPending = () => {
    const rho = own.rho(0n);
    const commitment = own.commitment(AMOUNT, rho);
    appendDeposit(net.chain, {amount: AMOUNT, rho, commitment});
    net.accounts.set(rhoPda(rho), {owner: PROGRAM, finalized: true});
    addA0PendingDeposit({commitment, amount: AMOUNT, rho, depositIndex: 0n, lastValidBlockHeight: 1});
    return rho;
  };

  it('reconcileA0PendingDeposits ("Check again") in flight across wipe + import → E_A0_STORE_CHANGED; the new instance never touched', async () => {
    landedPending();
    net.holdWhen = m => m === 'getSignaturesForAddress';
    const run = reconcileA0PendingDeposits(net.connection, {sync: {useCache: false}});
    await until(() => net.held > 0, 'the reconcile to reach its sync');
    const touched = wipeAndImport();
    net.release();
    await expect(run).rejects.toMatchObject({code: 'E_A0_STORE_CHANGED'});
    expect(touched).toEqual([]);
    expect(hasA0NoteRecord()).toBe(false);
  });

  it('control: the same held reconcile without the wipe confirms the note', async () => {
    const rho = landedPending();
    net.holdWhen = m => m === 'getSignaturesForAddress';
    const run = reconcileA0PendingDeposits(net.connection, {sync: {useCache: false}});
    await until(() => net.held > 0, 'the reconcile to reach its sync');
    net.release();
    await expect(run).resolves.toMatchObject({confirmed: [{rho, leafIndex: RECORDED_LEAVES}]});
  });

  it('prepareA0Deposit with a pre-check hit in flight across wipe + import → E_A0_STORE_CHANGED; no record and no foreign note in the new instance', async () => {
    const rho0 = own.rho(0n);
    appendDeposit(net.chain, {amount: 700n, rho: rho0, commitment: own.commitment(700n, rho0)});
    net.accounts.set(rhoPda(rho0), {owner: PROGRAM, finalized: true});
    net.holdWhen = m => m === 'getTransaction'; // the pre-check's sync, before its merge
    const seed = seedBytes(TEST_SEED);
    const run = prepare(AMOUNT, memoryIO(), seed);
    await until(() => net.held > 0, 'the pre-check to reach its sync');
    const touched = wipeAndImport();
    net.release();
    await expect(run).rejects.toMatchObject({code: 'E_A0_STORE_CHANGED'});
    expect(touched).toEqual([]);
    expect(hasA0NoteRecord()).toBe(false);
    expect(fake.liveHandle()).toBeNull();
    expect([...seed].every(b => b === 0)).toBe(true);
  });

  it('control: the same held pre-check without the wipe imports the note', async () => {
    const rho0 = own.rho(0n);
    appendDeposit(net.chain, {amount: 700n, rho: rho0, commitment: own.commitment(700n, rho0)});
    net.accounts.set(rhoPda(rho0), {owner: PROGRAM, finalized: true});
    net.holdWhen = m => m === 'getTransaction';
    const run = prepare();
    await until(() => net.held > 0, 'the pre-check to reach its sync');
    net.release();
    await expect(run).resolves.toMatchObject({depositIndex: 1n, importedNotes: 1});
  });

  it('submitA0Deposit in flight before its pending write (wipe + import) → E_A0_STORE_CHANGED, nothing sent, the new instance never touched', async () => {
    const p = await prepare();
    net.holdWhen = m => m === 'getLatestBlockhash';
    const run = submit(p);
    await until(() => net.held > 0, 'submit to ask for its blockhash');
    const touched = wipeAndImport();
    net.release();
    await expect(run).rejects.toMatchObject({code: 'E_A0_STORE_CHANGED'});
    expect(net.sent).toHaveLength(0);
    expect(touched).toEqual([]);
    expect(hasA0NoteRecord()).toBe(false);
  });

  it('submitA0Deposit in its settle loop across wipe + import → E_A0_STORE_CHANGED (sent, landed), the new instance never touched', async () => {
    const p = await prepare();
    net.holdWhen = m => m === 'getSignaturesForAddress'; // the settle sync, after the confirmation
    const run = submit(p);
    await until(() => net.held > 0, 'submit to reach its settle sync');
    expect(net.sent).toHaveLength(1);
    const touched = wipeAndImport();
    net.release();
    await expect(run).rejects.toMatchObject({code: 'E_A0_STORE_CHANGED'});
    expect(touched).toEqual([]);
    expect(hasA0NoteRecord()).toBe(false);
  });
});

describe('R1-m7: the settle loop\'s pause is cleared at teardown', () => {
  it('a submit waiting in its settle pause → clearA0SettleTimersForTests clears exactly that timer', async () => {
    const p = await prepare();
    const listing = net.chain.signatures;
    const setSpy = jest.spyOn(global, 'setTimeout');
    const clearSpy = jest.spyOn(global, 'clearTimeout');
    let synced = 0;
    net.onRequest = m => {
      if (m === 'getSignaturesForAddress' && net.sent.length === 1) {
        synced++;
      }
    };
    // abandoned with the test once its pause is cleared (it never resumes)
    submitA0Deposit(net.connection, p, seedBytes(TEST_SEED), {
      sync: {useCache: false},
      settleAttempts: 2,
      settleDelayMs: 600_000,
      onStage: s => {
        if (s === 'settling') {
          net.chain.signatures = listing.filter(x => x.signature !== net.sent[0]!.signature); // never in sync
        }
      },
    }).catch(() => undefined);
    await until(() => setSpy.mock.calls.some(c => c[1] === 600_000), 'the settle pause');
    expect(synced).toBe(1);
    const k = setSpy.mock.calls.findIndex(c => c[1] === 600_000);
    const timer = setSpy.mock.results[k]!.value as ReturnType<typeof setTimeout>;
    clearA0SettleTimersForTests();
    expect(clearSpy).toHaveBeenCalledWith(timer);
    setSpy.mockRestore();
    clearSpy.mockRestore();
  });
});
