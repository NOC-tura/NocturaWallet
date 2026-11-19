/**
 * The post-landing verifier (spec §6 step 8, I13, S10, m-2; §14 JS "post-landing verification
 * refusing a foreign pool, a foreign fee payer, a wrong fee_destination, a wrong fee, a wrong
 * destination, a grant to an owner whose pre-balance was not 0, a grant of another amount or from
 * another payer, a grant to an off-curve owner, two top-level transfers …, a create-ATA with other
 * accounts, a missing nullifier, and any signer that is a key of this seed").
 *
 * POSITIVE CONTROLS — four relayed `withdraw_with_change` that LANDED on devnet with the uniform P2
 * shape, each read as the sync reads it (the REAL web3.js `Connection.getTransaction` over the
 * recorded answer, then `parseA0SyncedTx`):
 *   - 47k56NfB… (fresh owner, grant 3,000,000) and 3oHktG2X… (existing owner, no grant), recorded in
 *     fixtures/devnet-tree-5URd.json; expected values = the program side's golden
 *     `relayerLandedP1P2` (relayer-a0-golden-vectors.json, digest pinned in syncedTx.golden.test.ts);
 *   - 5F8Ks5qa… (fresh owner AgPYn4…, grant) and 5sKiWZTv… (existing owner GoBAm…, no grant), the
 *     post-upgrade landings recorded base64 by scripts/a0-fixtures/fetch-devnet-tx.mjs and re-encoded
 *     by __testing__/landedTx.ts; expected values = the output of
 *     scripts/a0-fixtures/read-landed-withdraw.mjs (its own wire decoder, no web3.js, no app code).
 * Every positive passes; every REFUSAL ROW is one mutation of a positive (a field of the recorded
 * SyncedTx, one input of the wallet's, or — where the record has no field for it — one edit of the
 * recorded transaction) and names the rule that fired.
 *
 * THE SEED SET is the real `a0SeedPublicKeys` (Task 2) over the "abandon … about" seed with main
 * `slip10:0` and a real `fresh-pending` reservation (`slip10:1`), held to the offline vectors.
 */
import {readFileSync} from 'fs';
import {join} from 'path';

jest.mock('@solana/web3.js', () =>
  jest.requireActual<typeof import('../__testing__/realWeb3')>('../__testing__/realWeb3').loadRealWeb3(),
);
import {PublicKey} from '@solana/web3.js';
import {clearAllStores, initSecureMmkv} from '../../../../store/mmkv/instances';
import {storeTransparentScheme} from '../../../keyDerivation/derivationScheme';
import {a0SeedPublicKeys, reserveA0FreshAccount, resetA0ReservationsForTests} from '../accountRegistry';
import type {A0HistoryRpc} from '../accountRegistry';
import {appendTopLevelIx, txOf} from '../__testing__/chainEdits';
import {jsonEncodedTx} from '../__testing__/landedTx';
import type {DevnetTxFixture} from '../__testing__/landedTx';
import {appendDeposit, appendDepositPair, appendWithdraw} from '../__testing__/ownHistory';
import {chainFrom, recordedConnection} from '../__testing__/recordedRpc';
import type {RecordedChain, RecordedFixture} from '../__testing__/recordedRpc';
import {A0} from '../constants';
import {A0_RELAYED_TOP_LEVEL_PROGRAMS, verifyLandedUnshield} from '../landedVerifier';
import type {A0LandedUnshieldExpectation, A0VerifyRefusal} from '../landedVerifier';
import {parseA0SyncedTx} from '../syncedTx';
import type {A0SyncedTx} from '../syncedTx';

const fx = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');
const TREE = JSON.parse(fx('devnet-tree-5URd.json')) as RecordedFixture;
const LANDED = ['5F8Ks5qa', '5sKiWZTv'].map(p => JSON.parse(fx(`landed-withdraw-${p}.json`)) as DevnetTxFixture);
interface GoldenWithdraw {
  landedSignature: string;
  payload: {nullifier: string; withdrawAmount: string; destination: string; destinationOwner: string; changeCommitment: string; fee: string};
}
const P1P2 = (JSON.parse(fx('relayer-a0-golden-vectors.json')) as {
  relayerLandedP1P2: {feePayer: string; gasGrantLamports: string; vectors: {withdraw_change: GoldenWithdraw; withdraw_change_existing: GoldenWithdraw}};
}).relayerLandedP1P2;
interface Vectors {
  seeds: {seed: string; accounts: {scheme: string; address: string}[]}[];
}
const [ABANDON, ZOO] = (JSON.parse(fx('a0-account-vectors.json')) as Vectors).seeds as [Vectors['seeds'][0], Vectors['seeds'][0]];
const vec = (scheme: string) => ABANDON.accounts.find(a => a.scheme === scheme)!.address;
/** An on-curve key that is not this seed's, not the relayer's and no positive's owner: "zoo … wrong" slip10:0. */
const OTHER = ZOO.accounts.find(a => a.scheme === 'slip10:0')!.address;
/** A key no recorded tx lists, to stand in for a foreign pool. */
const FOREIGN_POOL = 'Stake11111111111111111111111111111111111111';

const RELAYER = '3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe';
const SYSTEM = '11111111111111111111111111111111';
const ATA_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const MEMO = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const GRANT = 3_000_000n;

/** One positive control: the signature prefix and every value the verifier is told to expect. */
interface Case {
  name: string;
  prefix: string;
  owner: string;
  ata: string;
  amount: bigint;
  fee: bigint;
  nullifier: string;
  changeCommitment: string;
  grant: bigint | null;
}
const golden = (prefix: string, g: GoldenWithdraw, grant: bigint | null, name: string): Case => ({
  name,
  prefix,
  owner: g.payload.destinationOwner,
  ata: g.payload.destination,
  amount: BigInt(g.payload.withdrawAmount),
  fee: BigInt(g.payload.fee),
  nullifier: g.payload.nullifier,
  changeCommitment: g.payload.changeCommitment,
  grant,
});
const CASES: Case[] = [
  golden('47k56NfB', P1P2.vectors.withdraw_change, GRANT, '47k56NfB… fresh owner, grant'),
  golden('3oHktG2X', P1P2.vectors.withdraw_change_existing, null, '3oHktG2X… existing owner'),
  // read-landed-withdraw.mjs output (Step 1)
  {
    name: '5F8Ks5qa… fresh owner, grant (post-upgrade)',
    prefix: '5F8Ks5qa',
    owner: 'AgPYn4odQNKwWBjvCtgG8G1supmLKaFHtbDVHmMT2KtP',
    ata: '2ot2kwhs7gFFPHAYNwkuNsUsfZp8hWAgzHpNQLx9pASu',
    amount: 400000n,
    fee: 10000n,
    nullifier: '0b2018b2e520bbf9420648d389a76aaad7a34b4c63e9afbf7f1f2e997888762d',
    changeCommitment: '0a579975eb2367144af135283e87e330ff775606bfac3a73c60ce08e7c60247c',
    grant: GRANT,
  },
  {
    name: '5sKiWZTv… existing owner (post-upgrade)',
    prefix: '5sKiWZTv',
    owner: 'GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd',
    ata: '9hZSf8jMxBdqcvnYzj6EkQ2gPoZCoX2GcF8f1dgkyLsn',
    amount: 400000n,
    fee: 10000n,
    nullifier: '18be67342e46b85f7ccc83eecabf99cb9d8a6a05b40644c59224a775277526ed',
    changeCommitment: '15bca11de36cb63abb898e8ed26db888b1058453c5ef8bae21ce06dcaea4411f',
    grant: null,
  },
];
const GRANTED = CASES.filter(c => c.grant !== null);
const caseOf = (prefix: string) => CASES.find(c => c.prefix === prefix)!;

/** The recorded chain with the two base64 landings re-encoded into it. */
function baseChain(): RecordedChain {
  const chain = chainFrom(TREE);
  for (const f of LANDED) {
    chain.transactions[f.signature] = jsonEncodedTx(f);
  }
  return chain;
}
async function syncedOf(prefix: string, edit?: (chain: RecordedChain, sig: string) => void): Promise<A0SyncedTx> {
  const chain = baseChain();
  const {sig} = txOf(chain, prefix);
  edit?.(chain, sig);
  const {connection} = recordedConnection(chain);
  const tx = await connection.getTransaction(sig, {commitment: 'confirmed', maxSupportedTransactionVersion: 0});
  const r = tx && parseA0SyncedTx(sig, tx);
  if (!r) {
    throw new Error(`${prefix}: not a successful tx`);
  }
  return r;
}

/** A deep copy with every string mapped (BigInt kept) — the clone, and the key substitution. */
function mapStrings<T>(v: T, f: (s: string) => string): T {
  if (typeof v === 'string') {
    return f(v) as T;
  }
  if (Array.isArray(v)) {
    return v.map(x => mapStrings(x, f)) as T;
  }
  if (v !== null && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapStrings(x, f)])) as T;
  }
  return v;
}

const ataOf = (owner: string): string =>
  PublicKey.findProgramAddressSync(
    [new PublicKey(owner).toBuffer(), new PublicKey(TOKEN_PROGRAM).toBuffer(), new PublicKey(A0.mint).toBuffer()],
    new PublicKey(ATA_PROGRAM),
  )[0].toBase58();
/** An off-curve address that no recorded tx lists (a PDA). */
const OFF_CURVE = PublicKey.findProgramAddressSync([Buffer.from('m1c-task4-off-curve')], new PublicKey(SYSTEM))[0].toBase58();

let SEED_KEYS: string[];
let MAIN: string;
let FRESH: string;
const synced: Record<string, A0SyncedTx> = {};

beforeAll(async () => {
  clearAllStores();
  initSecureMmkv('test-key');
  storeTransparentScheme({kind: 'slip10', account: 0});
  resetA0ReservationsForTests();
  const seed = Uint8Array.from(Buffer.from(ABANDON.seed, 'hex'));
  const noHistory: A0HistoryRpc = {
    getSignaturesForAddress: (async () => []) as unknown as A0HistoryRpc['getSignaturesForAddress'],
  };
  FRESH = (await reserveA0FreshAccount(noHistory, seed)).address;
  SEED_KEYS = a0SeedPublicKeys(seed);
  MAIN = vec('slip10:0');
  for (const c of CASES) {
    synced[c.prefix] = await syncedOf(c.prefix);
  }
});

function expectation(c: Case, o: Partial<A0LandedUnshieldExpectation> = {}): A0LandedUnshieldExpectation {
  return {
    txSignature: synced[c.prefix]!.signature,
    quote: {feePayer: RELAYER, gasGrantLamports: GRANT},
    authorization: {owner: c.owner, ata: c.ata, amount: c.amount, fee: c.fee},
    destinationKind: 'external',
    seedPublicKeys: SEED_KEYS,
    changeCommitment: c.changeCommitment,
    noteMatch: {chainNullifiers: [c.nullifier], answer: [0]},
    ...o,
  };
}
/** The positive `c` with its owner (and so its ATA) replaced by `owner` everywhere — tx and expectation. */
function withOwner(c: Case, owner: string): {tx: A0SyncedTx; c: Case} {
  const ata = ataOf(owner);
  const map = (s: string) => (s === c.owner ? owner : s === c.ata ? ata : s);
  return {tx: mapStrings(synced[c.prefix]!, map), c: {...c, owner, ata}};
}
const clone = (c: Case): A0SyncedTx => mapStrings(synced[c.prefix]!, s => s);
const refusal = (tx: A0SyncedTx, e: A0LandedUnshieldExpectation): A0VerifyRefusal | 'ok' => {
  const v = verifyLandedUnshield(tx, e);
  return v.ok ? 'ok' : v.code;
};
const ownerPre = (tx: A0SyncedTx, owner: string) => tx.preBalances.find(p => p.address === owner)!;

describe('the inputs are what they claim', () => {
  it('the seed set is the real a0SeedPublicKeys: main slip10:0, the reserved fresh slip10:1, cli — = the offline vectors', () => {
    expect(SEED_KEYS).toEqual([vec('slip10:0'), vec('slip10:1'), vec('cli')]);
    expect(FRESH).toBe(vec('slip10:1'));
  });
  it('the re-encoded base64 landings decode to the facts read-landed-withdraw.mjs printed', () => {
    const r = synced['5F8Ks5qa']!;
    expect(r.signers).toEqual([RELAYER]);
    expect(r.topLevelPrograms).toEqual(['ComputeBudget111111111111111111111111111111', ATA_PROGRAM, SYSTEM, A0.programId]);
    expect(r.systemTransfers).toEqual([{from: RELAYER, to: caseOf('5F8Ks5qa').owner, lamports: GRANT}]);
    expect(synced['5sKiWZTv']!.topLevelPrograms).toEqual(['ComputeBudget111111111111111111111111111111', ATA_PROGRAM, A0.programId]);
  });
  it('the off-curve owner is off the curve; the seed keys, OTHER and the owners are on it and distinct (non-vacuous rows)', () => {
    expect(PublicKey.isOnCurve(new PublicKey(OFF_CURVE).toBytes())).toBe(false);
    const keys = [...SEED_KEYS, OTHER, RELAYER, ...new Set(CASES.map(c => c.owner))];
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) {
      expect(PublicKey.isOnCurve(new PublicKey(k).toBytes())).toBe(true);
    }
  });
  it('the inner system calls of the ATA program and FeGSS… are in the logs, and the record holds the top-level transfer only', async () => {
    for (const c of GRANTED) {
      const chain = baseChain();
      const logs = txOf(chain, c.prefix).tx.meta.logMessages;
      expect(logs.filter(l => l === `Program ${SYSTEM} invoke [2]`).length).toBeGreaterThanOrEqual(2);
      expect(synced[c.prefix]!.systemTransfers).toHaveLength(1);
    }
  });
});

describe('positive controls: the four landed relayed withdraws pass', () => {
  it.each(CASES.map(c => [c.name, c] as const))('%s', (_n, c) => {
    const v = verifyLandedUnshield(synced[c.prefix]!, expectation(c));
    expect(v).toEqual({
      ok: true,
      signature: synced[c.prefix]!.signature,
      changeLeaf: synced[c.prefix]!.leafInserted[0],
      grantLamports: c.grant,
      ownerPreLamports: c.grant === null ? ownerPre(synced[c.prefix]!, c.owner).lamports : 0n,
      destinationWithoutSol: false,
    });
    if (v.ok) {
      expect(v.changeLeaf.commitment).toBe(c.changeCommitment);
    }
  });
  it('found by reconcile (no relayed signature): txSignature null passes', () => {
    const c = CASES[0]!;
    expect(refusal(synced[c.prefix]!, expectation(c, {txSignature: null}))).toBe('ok');
  });
});

describe('accepted variants (§6 step 8)', () => {
  it('to my main account (a seed key as the OWNER is allowed): no grant, existing owner', () => {
    for (const c0 of CASES.filter(c => c.grant === null)) {
      const {tx, c} = withOwner(c0, MAIN);
      expect(refusal(tx, expectation(c, {destinationKind: 'main'}))).toBe('ok');
    }
  });
  it('to the fresh-pending account with the grant: ok, the SOL is there', () => {
    for (const c0 of GRANTED) {
      const {tx, c} = withOwner(c0, FRESH);
      const v = verifyLandedUnshield(tx, expectation(c, {destinationKind: 'fresh-pending'}));
      expect(v).toMatchObject({ok: true, grantLamports: GRANT, destinationWithoutSol: false});
    }
  });
  it('to the fresh-pending account WITHOUT a grant, owner at 0 lamports: accepted and reported "no SOL"', () => {
    for (const c0 of CASES.filter(c => c.grant === null)) {
      const {tx, c} = withOwner(c0, FRESH);
      ownerPre(tx, FRESH).lamports = 0n;
      const v = verifyLandedUnshield(tx, expectation(c, {destinationKind: 'fresh-pending'}));
      expect(v).toMatchObject({ok: true, grantLamports: null, ownerPreLamports: 0n, destinationWithoutSol: true});
      // the same tx to an external address is not reported
      expect(verifyLandedUnshield(tx, expectation(c))).toMatchObject({ok: true, destinationWithoutSol: false});
    }
  });
  it('a 0-lamport OFF-CURVE owner without a grant: accepted (the relayer never grants one)', () => {
    for (const c0 of CASES.filter(c => c.grant === null)) {
      const {tx, c} = withOwner(c0, OFF_CURVE);
      ownerPre(tx, OFF_CURVE).lamports = 0n;
      expect(verifyLandedUnshield(tx, expectation(c))).toMatchObject({ok: true, grantLamports: null});
    }
  });
});

/** A one-field mutation of the recorded SyncedTx, or of the wallet's own inputs. */
interface Row {
  name: string;
  code: A0VerifyRefusal;
  /** only the cases with a grant */
  grantOnly?: boolean;
  tx?: (t: A0SyncedTx, c: Case) => void;
  exp?: (c: Case) => Partial<A0LandedUnshieldExpectation>;
}
const w0 = (t: A0SyncedTx) => t.withdrawals[0]!;
const ROWS: Row[] = [
  // the wallet's own inputs
  {name: 'the authorization\'s ata is not ATA(owner)', code: 'E_A0_VERIFY_ARGS', exp: c => ({authorization: {owner: c.owner, ata: ataOf(OTHER), amount: c.amount, fee: c.fee}})},
  {name: 'the owner is not a canonical key', code: 'E_A0_VERIFY_ARGS', exp: c => ({authorization: {owner: `${c.owner}x`, ata: c.ata, amount: c.amount, fee: c.fee}})},
  {name: 'an amount of 0', code: 'E_A0_VERIFY_ARGS', exp: c => ({authorization: {owner: c.owner, ata: c.ata, amount: 0n, fee: c.fee}})},
  {name: 'a negative fee', code: 'E_A0_VERIFY_ARGS', exp: c => ({authorization: {owner: c.owner, ata: c.ata, amount: c.amount, fee: -1n}})},
  {name: 'the quote names another fee payer', code: 'E_A0_VERIFY_ARGS', exp: () => ({quote: {feePayer: OTHER, gasGrantLamports: GRANT}})},
  {name: 'another signature than the relayed one', code: 'E_A0_VERIFY_SIGNATURE', exp: c => ({txSignature: synced[c.prefix === '3oHktG2X' ? '47k56NfB' : '3oHktG2X']!.signature})},
  // signers and fee payer
  {name: 'a foreign fee payer (the tx\'s, static key 0)', code: 'E_A0_VERIFY_FEE_PAYER', tx: t => {
    t.feePayer = OTHER;
  }},
  {name: 'a foreign fee payer (the instruction\'s fee_payer account)', code: 'E_A0_VERIFY_FEE_PAYER', tx: t => {
    w0(t).feePayer = OTHER;
  }},
  {name: 'a second signer that is not ours', code: 'E_A0_VERIFY_SIGNERS', tx: t => {
    t.signers.push(OTHER);
  }},
  // shape
  {name: 'a foreign pool (the record holds no withdraw on 8VMe…)', code: 'E_A0_VERIFY_WITHDRAW', tx: t => {
    t.withdrawals = [];
  }},
  {name: 'a deposit beside the withdraw', code: 'E_A0_VERIFY_WITHDRAW', tx: t => {
    t.deposits.push({amount: 1n, commitment: '0'.repeat(64), rho: '0'.repeat(64), depositor: OTHER, depositorTokenAccount: OTHER});
  }},
  {name: 'two withdraw_with_change on our pool', code: 'E_A0_VERIFY_WITHDRAW', tx: t => {
    t.withdrawals.push({...w0(t)});
  }},
  {name: 'a second top-level FeGSS… instruction (not ours)', code: 'E_A0_VERIFY_PROGRAMS', tx: t => {
    t.topLevelPrograms.push(A0.programId);
  }},
  {name: 'a top-level program outside the relayed shape', code: 'E_A0_VERIFY_PROGRAMS', tx: t => {
    t.topLevelPrograms.push(MEMO);
  }},
  // the spend
  {name: 'a missing nullifier (no Withdraw event)', code: 'E_A0_VERIFY_NULLIFIER', tx: t => {
    t.withdrawNullifiers = [];
  }},
  {name: 'two Withdraw events', code: 'E_A0_VERIFY_NULLIFIER', tx: t => {
    t.withdrawNullifiers.push(t.withdrawNullifiers[0]!);
  }},
  {name: 'the Withdraw event is not the instruction\'s nullifier', code: 'E_A0_VERIFY_NULLIFIER', tx: t => {
    w0(t).nullifier = '1'.repeat(64);
  }},
  {name: 'matchSpent does not attribute it to the note ([])', code: 'E_A0_VERIFY_NULLIFIER', exp: c => ({noteMatch: {chainNullifiers: [c.nullifier], answer: []}})},
  {name: 'matchSpent was asked about other nullifiers', code: 'E_A0_VERIFY_NULLIFIER', exp: () => ({noteMatch: {chainNullifiers: ['1'.repeat(64)], answer: [0]}})},
  // the change leaf
  {name: 'the change leaf is not Rust\'s commitment (event)', code: 'E_A0_VERIFY_CHANGE_LEAF', tx: t => {
    t.leafInserted[0]!.commitment = '2'.repeat(64);
  }},
  {name: 'the change leaf is not Rust\'s commitment (instruction)', code: 'E_A0_VERIFY_CHANGE_LEAF', tx: t => {
    w0(t).changeCommitment = '2'.repeat(64);
  }},
  {name: 'Rust proved another change commitment', code: 'E_A0_VERIFY_CHANGE_LEAF', exp: () => ({changeCommitment: '2'.repeat(64)})},
  {name: 'no LeafInserted', code: 'E_A0_VERIFY_CHANGE_LEAF', tx: t => {
    t.leafInserted = [];
  }},
  {name: 'a second LeafInserted after the change leaf', code: 'E_A0_VERIFY_CHANGE_LEAF', tx: t => {
    t.leafInserted.push({...t.leafInserted[0]!, commitment: '2'.repeat(64), leafIndex: t.leafInserted[0]!.leafIndex + 1});
  }},
  // fee, destination, amount
  {name: 'a wrong fee_destination', code: 'E_A0_VERIFY_FEE_DESTINATION', tx: t => {
    w0(t).feeDestination = ataOf(OTHER);
  }},
  {name: 'a wrong fee (the tx\'s)', code: 'E_A0_VERIFY_FEE', tx: t => {
    w0(t).fee += 1n;
  }},
  {name: 'a wrong fee (the one we approved)', code: 'E_A0_VERIFY_FEE', exp: c => ({authorization: {owner: c.owner, ata: c.ata, amount: c.amount, fee: c.fee + 1n}})},
  {name: 'a wrong destination', code: 'E_A0_VERIFY_DESTINATION', tx: t => {
    w0(t).destination = ataOf(OTHER);
  }},
  {name: 'the owner is not listed by the tx', code: 'E_A0_VERIFY_DESTINATION', tx: (t, c) => {
    t.preBalances = t.preBalances.filter(p => p.address !== c.owner);
  }},
  {name: 'another amount (the instruction\'s)', code: 'E_A0_VERIFY_AMOUNT', tx: t => {
    w0(t).amount += 1n;
  }},
  {name: 'the destination received another amount', code: 'E_A0_VERIFY_AMOUNT', tx: t => {
    w0(t).destinationTokenDelta = w0(t).destinationTokenDelta! - 1n;
  }},
  {name: 'the destination lists no token balance', code: 'E_A0_VERIFY_AMOUNT', tx: t => {
    w0(t).destinationTokenDelta = null;
  }},
  {name: 'the vault moved another amount', code: 'E_A0_VERIFY_AMOUNT', tx: t => {
    t.vaultTokenDelta -= 1n;
  }},
  // create-ATA
  {name: 'a create-ATA with another payer', code: 'E_A0_VERIFY_CREATE_ATA', tx: t => {
    t.createAtaIdempotent[0]!.payer = OTHER;
  }},
  {name: 'a create-ATA with another ata', code: 'E_A0_VERIFY_CREATE_ATA', tx: t => {
    t.createAtaIdempotent[0]!.ata = ataOf(MAIN);
  }},
  {name: 'a create-ATA with another owner', code: 'E_A0_VERIFY_CREATE_ATA', tx: t => {
    t.createAtaIdempotent[0]!.owner = MAIN;
  }},
  {name: 'a create-ATA with another mint', code: 'E_A0_VERIFY_CREATE_ATA', tx: t => {
    t.createAtaIdempotent[0]!.mint = 'So11111111111111111111111111111111111111112';
  }},
  // the seed
  {name: 'a key of this seed (the reserved fresh one) appears though it is not the owner', code: 'E_A0_VERIFY_SEED_KEY', tx: t => {
    t.preBalances.push({address: FRESH, lamports: 0n});
  }},
  // the grant
  {name: 'a grant to an owner whose pre-balance was not 0', code: 'E_A0_VERIFY_GRANT_PRE_BALANCE', grantOnly: true, tx: (t, c) => {
    ownerPre(t, c.owner).lamports = 1n;
  }},
  {name: 'a grant of another amount', code: 'E_A0_VERIFY_GRANT_TERMS', grantOnly: true, tx: t => {
    t.systemTransfers[0]!.lamports -= 1n;
  }},
  {name: 'a grant from another payer', code: 'E_A0_VERIFY_GRANT_TERMS', grantOnly: true, tx: t => {
    t.systemTransfers[0]!.from = OTHER;
  }},
  {name: 'a grant to another address', code: 'E_A0_VERIFY_GRANT_TERMS', grantOnly: true, tx: t => {
    t.systemTransfers[0]!.to = OTHER;
  }},
  {name: 'a grant the quote did not carry', code: 'E_A0_VERIFY_GRANT_TERMS', grantOnly: true, exp: () => ({quote: {feePayer: RELAYER, gasGrantLamports: null}})},
  {name: 'a grant the quote priced differently', code: 'E_A0_VERIFY_GRANT_TERMS', grantOnly: true, exp: () => ({quote: {feePayer: RELAYER, gasGrantLamports: GRANT + 1n}})},
];

describe('refusal rows: each one mutation of a landed positive, each naming its rule', () => {
  const table = ROWS.flatMap(r => (r.grantOnly ? GRANTED : CASES).map(c => [r.name, c.name, r, c] as const));
  it.each(table)('%s — %s', (_r, _c, row, c) => {
    const tx = clone(c);
    row.tx?.(tx, c);
    expect(refusal(tx, expectation(c, row.exp?.(c)))).toBe(row.code);
  });
});

describe('any signer that is a key of this seed refuses (I13) — every key of the set, every positive', () => {
  const table = CASES.flatMap(c => ['main slip10:0', 'fresh slip10:1', 'cli'].map((k, i) => [k, c.name, i, c] as const));
  it.each(table)('%s as a second signer — %s', (_k, _c, i, c) => {
    const tx = clone(c);
    tx.signers.push(SEED_KEYS[i]!);
    expect(refusal(tx, expectation(c))).toBe('E_A0_VERIFY_SEED_SIGNER');
  });
  it.each(CASES.map(c => [c.name, c] as const))('a seed key as THE signer and fee payer — %s', (_c, c) => {
    const tx = clone(c);
    tx.signers = [MAIN];
    tx.feePayer = MAIN;
    expect(refusal(tx, expectation(c))).toBe('E_A0_VERIFY_SEED_SIGNER');
  });
  it('the owner of a main-account exit signing is a seed signer too', () => {
    const {tx, c} = withOwner(caseOf('3oHktG2X'), MAIN);
    tx.signers.push(MAIN);
    expect(refusal(tx, expectation(c, {destinationKind: 'main'}))).toBe('E_A0_VERIFY_SEED_SIGNER');
  });
});

describe('a grant to an off-curve owner refuses', () => {
  it.each(GRANTED.map(c => [c.name, c] as const))('%s with its owner replaced by an off-curve key', (_n, c0) => {
    const {tx, c} = withOwner(c0, OFF_CURVE);
    expect(ownerPre(tx, OFF_CURVE).lamports).toBe(0n);
    expect(refusal(tx, expectation(c))).toBe('E_A0_VERIFY_GRANT_OFF_CURVE');
  });
});

/** Edits of the recorded TRANSACTION, where the record has no one field for the fact. */
const transferData = (lamports: bigint): Uint8Array => {
  const d = new Uint8Array(12);
  new DataView(d.buffer).setUint32(0, 2, true);
  new DataView(d.buffer).setBigUint64(4, lamports, true);
  return d;
};
const keysOf = (chain: RecordedChain, sig: string) => chain.transactions[sig]!.transaction.message.accountKeys;

describe('refusal rows on the recorded transaction', () => {
  it.each(CASES.map(c => [c.name, c] as const))('a foreign pool: pool 8VMe… replaced in the tx → no withdraw of ours — %s', async (_n, c) => {
    const tx = await syncedOf(c.prefix, (chain, sig) => {
      const keys = keysOf(chain, sig);
      keys[keys.indexOf(A0.pool)] = FOREIGN_POOL;
    });
    expect(tx.withdrawals).toEqual([]);
    expect(refusal(tx, expectation(c))).toBe('E_A0_VERIFY_WITHDRAW');
  });
  it.each(CASES.map(c => [c.name, c] as const))('two top-level transfers (a second one appended) — %s', async (_n, c) => {
    const tx = await syncedOf(c.prefix, (chain, sig) => {
      const t = chain.transactions[sig]!;
      const n = c.grant === null ? 2 : 1;
      for (let i = 0; i < n; i++) {
        appendTopLevelIx(t, {program: SYSTEM, accounts: [RELAYER, c.owner], data: transferData(c.grant ?? 1n), blobs: []});
      }
    });
    expect(tx.systemTransfers).toHaveLength(2);
    expect(refusal(tx, expectation(c))).toBe('E_A0_VERIFY_GRANT_COUNT');
  });
  it.each(CASES.map(c => [c.name, c] as const))('a top-level System instruction that is not a transfer (Assign) — %s', async (_n, c) => {
    const tx = await syncedOf(c.prefix, (chain, sig) => {
      const assign = new Uint8Array(36);
      assign[0] = 1;
      appendTopLevelIx(chain.transactions[sig]!, {program: SYSTEM, accounts: [RELAYER], data: assign, blobs: []});
    });
    expect(refusal(tx, expectation(c))).toBe('E_A0_VERIFY_PROGRAMS');
  });
  it.each(CASES.map(c => [c.name, c] as const))('a top-level instruction of another program (Memo) — %s', async (_n, c) => {
    const tx = await syncedOf(c.prefix, (chain, sig) => {
      appendTopLevelIx(chain.transactions[sig]!, {program: MEMO, accounts: [], data: Uint8Array.from([0x6d]), blobs: []});
    });
    expect(tx.topLevelPrograms).toContain(MEMO);
    expect(A0_RELAYED_TOP_LEVEL_PROGRAMS).not.toContain(MEMO);
    expect(refusal(tx, expectation(c))).toBe('E_A0_VERIFY_PROGRAMS');
  });
  it.each(CASES.map(c => [c.name, c] as const))('the pre-P2 shape: the create-ATA instruction removed (controller ruling 3) — %s', async (_n, c) => {
    const tx = await syncedOf(c.prefix, (chain, sig) => {
      const t = chain.transactions[sig]!;
      const msg = t.transaction.message;
      const at = msg.instructions.findIndex(i => msg.accountKeys[i.programIdIndex] === ATA_PROGRAM);
      msg.instructions.splice(at, 1);
      const logs = t.meta.logMessages;
      const from = logs.indexOf(`Program ${ATA_PROGRAM} invoke [1]`);
      const to = logs.indexOf(`Program ${ATA_PROGRAM} success`);
      expect(from).toBeGreaterThanOrEqual(0);
      logs.splice(from, to - from + 1);
    });
    expect(tx.createAtaIdempotent).toEqual([]);
    expect(tx.topLevelPrograms).not.toContain(ATA_PROGRAM);
    expect(refusal(tx, expectation(c))).toBe('E_A0_VERIFY_CREATE_ATA');
  });
  it.each(CASES.map(c => [c.name, c] as const))('a top-level ATA instruction that is not create-idempotent (Create, data []) — %s', async (_n, c) => {
    const tx = await syncedOf(c.prefix, (chain, sig) => {
      appendTopLevelIx(chain.transactions[sig]!, {
        program: ATA_PROGRAM,
        accounts: [RELAYER, c.ata, c.owner, A0.mint, SYSTEM, TOKEN_PROGRAM],
        data: new Uint8Array(0),
        blobs: [],
      });
    });
    expect(tx.createAtaIdempotent).toHaveLength(1);
    expect(refusal(tx, expectation(c))).toBe('E_A0_VERIFY_PROGRAMS');
  });
  it.each(CASES.map(c => [c.name, c] as const))('two create-ATA-idempotent instructions — %s', async (_n, c) => {
    const tx = await syncedOf(c.prefix, (chain, sig) => {
      appendTopLevelIx(chain.transactions[sig]!, {
        program: ATA_PROGRAM,
        accounts: [RELAYER, c.ata, c.owner, A0.mint, SYSTEM, TOKEN_PROGRAM],
        data: Uint8Array.from([1]),
        blobs: [],
      });
    });
    expect(tx.createAtaIdempotent).toHaveLength(2);
    expect(refusal(tx, expectation(c))).toBe('E_A0_VERIFY_CREATE_ATA');
  });
});

describe('the M1b ledger carry: an appended (ownHistory) tx carries its OWN token movement', () => {
  const NULL = '0e'.padEnd(64, '1');
  const CHANGE = '0f'.padEnd(64, '2');
  async function appendedSynced(edit: (chain: RecordedChain) => string): Promise<A0SyncedTx> {
    const chain = chainFrom(TREE);
    const sig = edit(chain);
    const {connection} = recordedConnection(chain);
    const tx = await connection.getTransaction(sig, {commitment: 'confirmed', maxSupportedTransactionVersion: 0});
    return parseA0SyncedTx(sig, tx!)!;
  }
  // the 3UfCx5TD… template's destination (owner HV996…, ATA DzU8…, created in that tx)
  const P0 = {owner: 'HV996fcQT193sXfh3fgCEDjxsWwWxQC6cVdb1EyZxdJR', ata: 'DzU8HkTy7b5jK8LvahytrsgimF9Navxc9HgzA7y167Zt'};

  it('an unshield of 123,456 with fee 7,000: destination +123,456, vault −130,456 — and the verifier passes it', async () => {
    const t = await appendedSynced(chain => appendWithdraw(chain, {nullifier: NULL, changeCommitment: CHANGE, amount: 123456n, fee: 7000n}).signature);
    expect(t.withdrawals[0]).toMatchObject({amount: 123456n, fee: 7000n, destination: P0.ata, destinationTokenDelta: 123456n});
    expect(t.vaultTokenDelta).toBe(-130456n);
    const v = verifyLandedUnshield(t, {
      txSignature: t.signature,
      quote: {feePayer: RELAYER, gasGrantLamports: GRANT},
      authorization: {owner: P0.owner, ata: P0.ata, amount: 123456n, fee: 7000n},
      destinationKind: 'fresh-pending',
      seedPublicKeys: SEED_KEYS,
      changeCommitment: CHANGE,
      noteMatch: {chainNullifiers: [NULL], answer: [0]},
    });
    expect(v).toMatchObject({ok: true, grantLamports: null, ownerPreLamports: 0n, destinationWithoutSol: true});
    // negative control: the template's amount is not what this tx moved
    expect(
      refusal(t, {
        txSignature: t.signature,
        quote: {feePayer: RELAYER, gasGrantLamports: GRANT},
        authorization: {owner: P0.owner, ata: P0.ata, amount: 400000n, fee: 7000n},
        destinationKind: 'external',
        seedPublicKeys: SEED_KEYS,
        changeCommitment: CHANGE,
        noteMatch: {chainNullifiers: [NULL], answer: [0]},
      }),
    ).toBe('E_A0_VERIFY_AMOUNT');
  });
  it('an unshield larger than the template vault held (2,200,000): the vault held exactly amount + fee and ends at 0', async () => {
    let raw: RecordedChain['transactions'][string] | undefined;
    const t = await appendedSynced(chain => {
      const sig = appendWithdraw(chain, {nullifier: NULL, changeCommitment: CHANGE, amount: 5_000_000n, fee: 10_000n}).signature;
      raw = chain.transactions[sig];
      return sig;
    });
    expect(t.withdrawals[0]!.destinationTokenDelta).toBe(5_000_000n);
    expect(t.vaultTokenDelta).toBe(-5_010_000n);
    type Tb = {accountIndex: number; uiTokenAmount: {amount: string}};
    const vault = raw!.transaction.message.accountKeys.indexOf(A0.vault);
    const amountIn = (list: unknown) => (list as Tb[]).find(b => b.accountIndex === vault)!.uiTokenAmount.amount;
    expect([amountIn(raw!.meta.preTokenBalances), amountIn(raw!.meta.postTokenBalances)]).toEqual(['5010000', '0']);
  });
  it('without amount / fee the template\'s 400,000 / 10,000 (unchanged default)', async () => {
    const t = await appendedSynced(chain => appendWithdraw(chain, {nullifier: NULL, changeCommitment: CHANGE}).signature);
    expect(t.withdrawals[0]).toMatchObject({amount: 400000n, fee: 10000n, destinationTokenDelta: 400000n});
    expect(t.vaultTokenDelta).toBe(-410000n);
  });
  it('a deposit of 777 moves 777 into the vault (the template moved 1,000,000)', async () => {
    const t = await appendedSynced(chain => appendDeposit(chain, {amount: 777n, commitment: CHANGE, rho: NULL}).signature);
    expect(t.deposits[0]!.amount).toBe(777n);
    expect(t.vaultTokenDelta).toBe(777n);
  });
  it('a deposit larger than the template depositor held (9,000,000 > 4,000,000) and a pair of 5 + 6', async () => {
    const big = await appendedSynced(chain => appendDeposit(chain, {amount: 9_000_000n, commitment: CHANGE, rho: NULL}).signature);
    expect(big.vaultTokenDelta).toBe(9_000_000n);
    const pair = await appendedSynced(
      chain =>
        appendDepositPair(chain, {amount: 5n, commitment: CHANGE, rho: NULL}, {amount: 6n, commitment: '10'.padEnd(64, '3'), rho: '11'.padEnd(64, '4')})
          .signature,
    );
    expect(pair.deposits.map(d => d.amount)).toEqual([5n, 6n]);
    expect(pair.vaultTokenDelta).toBe(11n);
  });
});
