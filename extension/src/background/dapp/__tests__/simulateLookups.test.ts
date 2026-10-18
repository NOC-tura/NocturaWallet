import {PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction, type AddressLookupTableAccount} from '@solana/web3.js';
import type {AccountData, SimulatedAccount, SimulationOutcome, TokenAccountEntry} from '../../../../../core/solana/rpc';
import {MAINNET_USDC_MINT} from '../../../../../core/presale/addresses';
import {fakeDeps, fakeReader} from '../../__tests__/fakeDeps';
import {BLOCKHASH, PUB, RECIPIENT, tokenAccountData} from '../../__tests__/fixtures';
import {ADDRESS_LOOKUP_TABLE_PROGRAM} from '../decode/keys';
import {TOKEN_PROGRAM} from '../decode/decode';
import {parseWire} from '../decode/wire';
import {txRefused} from '../signTx';
import {UNRESOLVED_LOOKUP_DETAIL, simStateOf, simulateTransactions, type TxSimulation} from '../simulate';
import type {Entry} from '../store';
import {U64_MAX, keyOf, usdcLikeMint} from './tokenBytes';

/**
 * Controller ruling (B1c-3 Task 3, ledger): a transaction naming an account a lookup table did not resolve (an ALT
 * index the tables the wallet read do not hold) is not approvable — Reject only, exactly like a failed simulation.
 * Also pinned here: the wallet account is always the first simulated account, pre and post (F3's chain rule reads it).
 */
const ME = new PublicKey(PUB);
const TO = new PublicKey(RECIPIENT);
const SYSTEM = SystemProgram.programId.toBase58();
const SOL = 10_000_000_000n;
const SRC = keyOf(70);
const DELEGATE = keyOf(71);
const TABLE = new PublicKey(keyOf(72));
const DEX = new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');

const u64 = (n: bigint): number[] => Array.from({length: 8}, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));
const plain = (lamports: bigint, owner = SYSTEM): SimulatedAccount => ({lamports, owner, data: new Uint8Array()});
const tokenAfter = (mint: string, amount: bigint): SimulatedAccount => ({lamports: 2_039_280n, owner: TOKEN_PROGRAM, data: tokenAccountData(mint, ME.toBase58(), amount)});
const tokenDelegated = (mint: string, amount: bigint, delegate: string, delegated: bigint): SimulatedAccount => {
  const data = tokenAccountData(mint, ME.toBase58(), amount);
  new DataView(data.buffer).setUint32(72, 1, true);
  data.set(new PublicKey(delegate).toBytes(), 76);
  new DataView(data.buffer).setBigUint64(121, delegated, true);
  return {lamports: 2_039_280n, owner: TOKEN_PROGRAM, data};
};
/** The table the message is compiled against (it holds `address`) — what the dApp claims the table holds. */
const altOf = (address: string) => ({key: TABLE, state: {deactivationSlot: 2n ** 64n - 1n, lastExtendedSlot: 0, lastExtendedSlotStartIndex: 0, authority: undefined, addresses: [new PublicKey(address)]}, isActive: () => true}) as unknown as AddressLookupTableAccount;
/** The table's account as the wallet reads it: holding `addresses` (none: the message's index 0 is not in it). */
const tableAccount = (addresses: string[]): AccountData => {
  const data = new Uint8Array(56 + 32 * addresses.length);
  new DataView(data.buffer).setUint32(0, 1, true);
  addresses.forEach((a, n) => data.set(new PublicKey(a).toBytes(), 56 + 32 * n));
  return {lamports: 1n, owner: ADDRESS_LOOKUP_TABLE_PROGRAM, data};
};
const wire = (instructions: TransactionInstruction[], o: {payer?: PublicKey; tables?: AddressLookupTableAccount[]} = {}): Uint8Array =>
  new VersionedTransaction(new TransactionMessage({payerKey: o.payer ?? ME, recentBlockhash: BLOCKHASH, instructions}).compileToV0Message(o.tables ?? [])).serialize();
const approveIx = (amount: bigint) =>
  new TransactionInstruction({
    programId: new PublicKey(TOKEN_PROGRAM),
    data: Buffer.from([4, ...u64(amount)]),
    keys: [
      {pubkey: new PublicKey(SRC), isSigner: false, isWritable: true},
      {pubkey: new PublicKey(DELEGATE), isSigner: false, isWritable: false},
      {pubkey: ME, isSigner: true, isWritable: false},
    ],
  });

function scene(o: {accounts: Map<string, AccountData | null>; holdings?: TokenAccountEntry[]; post: (address: string) => SimulatedAccount | null; err?: unknown}) {
  const simulations: {accounts: readonly string[] | undefined}[] = [];
  const reads: string[][] = [];
  const reader = fakeReader({
    getBalance: async () => SOL,
    getTokenAccountsByOwner: async (_owner, filter) => ('programId' in filter && filter.programId === TOKEN_PROGRAM ? (o.holdings ?? []) : []),
    getLatestBlockhash: async () => ({blockhash: BLOCKHASH, lastValidBlockHeight: 4_242}),
    getAccountsData: async addresses => {
      reads.push([...addresses]);
      return addresses.map(a => o.accounts.get(a) ?? null);
    },
    simulateTransaction: async (_tx, opts): Promise<SimulationOutcome> => {
      simulations.push({accounts: opts?.accounts});
      // Task 4 (ledger b): the node may answer an error too — the unresolved-lookup rule must not depend on it.
      if (o.err !== undefined) return {err: o.err, logs: [], unitsConsumed: 0, slot: 300 + simulations.length, accounts: null};
      return {err: null, logs: [], unitsConsumed: 1_234, slot: 300 + simulations.length, accounts: (opts?.accounts ?? []).map(a => o.post(a))};
    },
  });
  return {deps: fakeDeps({reader}), simulations, reads};
}

async function run(s: ReturnType<typeof scene>, wires: Uint8Array[]): Promise<TxSimulation> {
  const txs = wires.map(w => {
    const p = parseWire(w);
    if (p === null) throw new Error('fixture did not parse');
    return p;
  });
  return simulateTransactions(s.deps, {account: ME.toBase58(), wires, txs, known: () => true, thresholdCents: 10_000});
}

/** What dapp.decide would answer for this simulation, the window naming it while fresh (signTx.ts). */
const refusal = (sim: TxSimulation) => txRefused({sim: {status: 'ok', sim}} as unknown as Entry, sim.id, [], sim.at);
const stored = (sim: TxSimulation): unknown => ({status: 'ok', sim: JSON.parse(JSON.stringify(sim)) as unknown});

describe('an address a lookup table does not resolve (controller ruling): Reject only', () => {
  const approveScene = (tableHolds: string[]) =>
    scene({
      holdings: [{pubkey: SRC, mint: MAINNET_USDC_MINT, owner: ME.toBase58(), amount: 100n, decimals: 6}],
      accounts: new Map<string, AccountData | null>([
        [TABLE.toBase58(), tableAccount(tableHolds)],
        [SRC, tokenAfter(MAINNET_USDC_MINT, 100n)],
        [MAINNET_USDC_MINT, {lamports: 1n, owner: TOKEN_PROGRAM, data: usdcLikeMint()}],
      ]),
      post: a => (a === SRC ? tokenDelegated(MAINNET_USDC_MINT, 100n, DELEGATE, U64_MAX) : a === ME.toBase58() ? plain(SOL - 5_000n) : null),
    });
  const tx = wire([approveIx(U64_MAX)], {tables: [altOf(SRC)]});

  it('an unlimited approve whose source comes through an unresolved index: failed, refused `simulation-failed`; F1 still names it', async () => {
    const s = approveScene([]);
    const sim = await run(s, [tx]);
    expect(sim.keys[0]).toContain(null);
    // Final review M2: a transaction the wallet refuses is never sent to the proxy's simulateTransaction.
    expect(s.simulations).toEqual([]);
    expect(UNRESOLVED_LOOKUP_DETAIL).toBe('unresolved-lookup-table-address');
    expect(sim.outcomes).toEqual([{ok: false, error: 'failed', detail: UNRESOLVED_LOOKUP_DETAIL}]);
    expect(sim.flags[0]?.map(f => f.kind)).toContain('unknown-program');
    expect(refusal(sim)).toBe('simulation-failed');
    // Stored and read back as it is: still failed, still refused.
    const back = simStateOf(stored(sim));
    expect(back).toEqual({status: 'ok', sim});
  });

  it('control: the same index resolved — simulated, F5 blocks it (not a failure)', async () => {
    const s = approveScene([SRC]);
    const sim = await run(s, [tx]);
    expect(sim.keys[0]).not.toContain(null);
    expect(s.simulations).toHaveLength(1);
    // In a batch, only the resolved transaction is simulated (final review M2).
    const batch = approveScene([SRC]);
    // The first transaction's table is one the chain does not hold: its index resolves to nothing.
    const missing = {...altOf(SRC), key: new PublicKey(new Uint8Array(32).fill(97))} as AddressLookupTableAccount;
    const both = await run(batch, [wire([approveIx(U64_MAX)], {tables: [missing]}), tx]);
    expect([both.keys[0]?.includes(null), both.keys[1]?.includes(null)]).toEqual([true, false]);
    expect(batch.simulations).toHaveLength(1);
    expect(sim.outcomes[0]).toMatchObject({ok: true});
    expect(sim.flags[0]?.find(f => f.kind === 'unlimited-approve')).toMatchObject({severity: 'block', word: 'USDC'});
    expect(sim.reasons).toContain('override');
    expect(refusal(sim)).not.toBe('simulation-failed');
  });

  it('an unresolved index that is the source of nothing (a plain transfer’s recipient) is still Reject only; resolved, it is approvable', async () => {
    const transfer = wire([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1})], {tables: [altOf(TO.toBase58())]});
    const post = (a: string) => (a === ME.toBase58() ? plain(SOL - 5_001n) : a === TO.toBase58() ? plain(1n) : null);
    const unresolved = await run(scene({accounts: new Map([[TABLE.toBase58(), tableAccount([])]]), post}), [transfer]);
    expect(unresolved.keys[0]).toContain(null);
    expect(unresolved.outcomes).toEqual([{ok: false, error: 'failed', detail: UNRESOLVED_LOOKUP_DETAIL}]);
    expect(refusal(unresolved)).toBe('simulation-failed');
    const resolved = await run(scene({accounts: new Map([[TABLE.toBase58(), tableAccount([TO.toBase58()])]]), post}), [transfer]);
    expect(resolved.outcomes[0]).toMatchObject({ok: true});
    expect(refusal(resolved)).toBeNull();
  });

  it('simStateOf: a stored transaction with an unresolved key whose outcome is not that failure is invalid', async () => {
    const sim = await run(approveScene([]), [tx]);
    const forged = JSON.parse(JSON.stringify(sim)) as {outcomes: unknown[]};
    forged.outcomes = [{ok: true, changes: [], unitsConsumed: 1, unitLimit: 200_000, feeLamports: '5000'}];
    expect(simStateOf({status: 'ok', sim: forged})).toBeNull();
    const otherFailure = JSON.parse(JSON.stringify(sim)) as {outcomes: unknown[]};
    otherFailure.outcomes = [{ok: false, error: 'failed', detail: '"InvalidAccountData"'}];
    expect(simStateOf({status: 'ok', sim: otherFailure})).toBeNull();
  });
});

// Controller ruling, Task 4 (ledger b): the two gaps of Task 3's tests — the node answering an error beside an unresolved
// key, and a batch in which only one transaction has one.
describe('the unresolved-lookup rule, whatever the node answers and wherever in the batch', () => {
  const transferVia = (to: string) => wire([SystemProgram.transfer({fromPubkey: ME, toPubkey: new PublicKey(to), lamports: 1})], {tables: [altOf(to)]});
  const post = (a: string) => (a === ME.toBase58() ? plain(SOL - 5_001n) : a === TO.toBase58() ? plain(1n) : null);

  it('the node also returns an error (an instruction error, an expired blockhash): the outcome is still the unresolved-lookup failure, refused `simulation-failed`', async () => {
    for (const err of [{InstructionError: [0, 'InvalidAccountData']}, 'BlockhashNotFound']) {
      const sim = await run(scene({accounts: new Map([[TABLE.toBase58(), tableAccount([])]]), post, err}), [transferVia(TO.toBase58())]);
      expect(sim.keys[0]).toContain(null);
      expect([err, sim.outcomes]).toEqual([err, [{ok: false, error: 'failed', detail: UNRESOLVED_LOOKUP_DETAIL}]]);
      expect([err, refusal(sim)]).toEqual([err, 'simulation-failed']);
    }
    // Control: resolved, the node's own error is what the outcome carries (expired → blockhash-expired).
    const resolved = await run(scene({accounts: new Map([[TABLE.toBase58(), tableAccount([TO.toBase58()])]]), post, err: 'BlockhashNotFound'}), [transferVia(TO.toBase58())]);
    expect(resolved.outcomes).toEqual([{ok: false, error: 'expired', detail: '"BlockhashNotFound"'}]);
    expect(refusal(resolved)).toBe('blockhash-expired');
  });

  it('a batch of three, only the second with an unresolved key: that one is the failure, the others simulate, and the whole request is Reject-only', async () => {
    const OTHER = keyOf(75);
    const plainTransfer = wire([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1})]);
    const accounts = (holds: string[]) => new Map([[TABLE.toBase58(), tableAccount(holds)]]);
    const sim = await run(scene({accounts: accounts([]), post}), [plainTransfer, transferVia(OTHER), plainTransfer]);
    expect(sim.keys.map(k => k.includes(null))).toEqual([false, true, false]);
    expect(sim.outcomes.map(o => (o.ok ? 'ok' : o.detail))).toEqual(['ok', UNRESOLVED_LOOKUP_DETAIL, 'ok']);
    expect(refusal(sim)).toBe('simulation-failed');
    // Control: the same batch with the index resolved is approvable.
    const resolved = await run(scene({accounts: accounts([OTHER]), post}), [plainTransfer, transferVia(OTHER), plainTransfer]);
    expect(resolved.outcomes.map(o => o.ok)).toEqual([true, true, true]);
    expect(refusal(resolved)).toBeNull();
  });
});

describe('the wallet account is always simulated, pre and post (F3’s chain rule reads it)', () => {
  it('first in the pre read and the simulated accounts, even when the transaction only names it read-only; its post-state reaches F3', async () => {
    const payer = new PublicKey(keyOf(73));
    const other = keyOf(74);
    // ME a read-only signer of an unknown program's instruction; another account pays.
    const ix = new TransactionInstruction({
      programId: DEX,
      data: Buffer.from([1]),
      keys: [
        {pubkey: ME, isSigner: true, isWritable: false},
        {pubkey: new PublicKey(other), isSigner: false, isWritable: true},
      ],
    });
    const s = scene({accounts: new Map(), post: a => (a === ME.toBase58() ? plain(SOL, DEX.toBase58()) : null)});
    const sim = await run(s, [wire([ix], {payer})]);
    expect(s.reads[1]?.[0]).toBe(ME.toBase58());
    expect(s.simulations[0]?.accounts?.[0]).toBe(ME.toBase58());
    expect(s.simulations[0]?.accounts).toEqual(s.reads[1]);
    // The wallet's post-state owned by another program: F3 from chain state alone.
    expect(sim.flags[0]?.find(f => f.kind === 'assign')).toMatchObject({severity: 'block'});
  });
});
