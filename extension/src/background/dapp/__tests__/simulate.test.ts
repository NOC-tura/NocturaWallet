import {base58} from '@scure/base';
import {ComputeBudgetProgram, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction, type AddressLookupTableAccount} from '@solana/web3.js';
import type {AccountData, SimulatedAccount, SimulationOutcome, TokenAccountEntry} from '../../../../../core/solana/rpc';
import {MAINNET_NOC_MINT, MAINNET_USDC_MINT} from '../../../../../core/presale/addresses';
import {fakeDeps, fakeReader} from '../../__tests__/fakeDeps';
import {BLOCKHASH, PUB, RECIPIENT, tokenAccountData} from '../../__tests__/fixtures';
import {ADDRESS_LOOKUP_TABLE_PROGRAM} from '../decode/keys';
import {TOKEN_PROGRAM} from '../decode/decode';
import {parseWire} from '../decode/wire';
import {simulateTransactions, type TxSimulation} from '../simulate';

const ME = new PublicKey(PUB);
const TO = new PublicKey(RECIPIENT);
const SRC = '4G8U5nQtNciNaEL7Zimb4DhqeanDMevXp7MLtFvUojwF';
const NEW_ATA = 'FpV5mr137k3GfLJqqWnZer12v2KxZfEEQzxXb6sJLABU';
const ODD_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYC';
const DEX = new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');
const SOL = 10_000_000_000n;

const wire = (instructions: TransactionInstruction[], o: {payer?: PublicKey; tables?: AddressLookupTableAccount[]} = {}): Uint8Array =>
  new VersionedTransaction(new TransactionMessage({payerKey: o.payer ?? ME, recentBlockhash: BLOCKHASH, instructions}).compileToV0Message(o.tables ?? [])).serialize();
const u64 = (n: bigint): number[] => Array.from({length: 8}, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));
const tokenIx = (data: number[], keys: string[], signer = ME.toBase58()) =>
  new TransactionInstruction({programId: new PublicKey(TOKEN_PROGRAM), data: Buffer.from(data), keys: keys.map(k => ({pubkey: new PublicKey(k), isSigner: k === signer, isWritable: k !== signer}))});
const holding = (pubkey: string, mint: string, amount: bigint, decimals = 9): TokenAccountEntry => ({pubkey, mint, owner: ME.toBase58(), amount, decimals});
const tokenAfter = (mint: string, amount: bigint, owner = ME.toBase58()): SimulatedAccount => ({lamports: 2_039_280n, owner: TOKEN_PROGRAM, data: tokenAccountData(mint, owner, amount)});

/**
 * A reader for one request: the wallet's SOL and token accounts before, and per simulateTransaction call the post-state
 * of each requested address (a function of the address) — or an error.
 */
function scene(o: {holdings?: TokenAccountEntry[]; post?: (address: string, call: number) => SimulatedAccount | null; err?: unknown; accounts?: Map<string, AccountData | null>; lamports?: bigint}) {
  const simulations: {tx: string; accounts: readonly string[] | undefined}[] = [];
  const reads: string[][] = [];
  const reader = fakeReader({
    getBalance: async () => o.lamports ?? SOL,
    getTokenAccountsByOwner: async (_owner, filter) => ('programId' in filter && filter.programId === TOKEN_PROGRAM ? (o.holdings ?? []) : []),
    getLatestBlockhash: async () => ({blockhash: BLOCKHASH, lastValidBlockHeight: 4_242}),
    getAccountsData: async addresses => {
      reads.push([...addresses]);
      return addresses.map(a => o.accounts?.get(a) ?? null);
    },
    simulateTransaction: async (tx, opts): Promise<SimulationOutcome> => {
      simulations.push({tx, accounts: opts?.accounts});
      const call = simulations.length;
      if (o.err !== undefined) return {err: o.err, logs: [], unitsConsumed: 0, slot: 300 + call, accounts: null};
      return {err: null, logs: [], unitsConsumed: 1_234, slot: 300 + call, accounts: (opts?.accounts ?? []).map(a => o.post?.(a, call) ?? null)};
    },
  });
  return {deps: fakeDeps({reader}), simulations, reads};
}

async function run(s: ReturnType<typeof scene>, wires: Uint8Array[], known: (a: string) => boolean = () => false): Promise<TxSimulation> {
  const txs = wires.map(w => {
    const p = parseWire(w);
    if (p === null) throw new Error('fixture did not parse');
    return p;
  });
  return simulateTransactions(s.deps, {account: ME.toBase58(), wires, txs, known, thresholdCents: 10_000});
}

// Spec B1c §3.3: simulation through the proxy, balance changes = post − pre per mint, in base units.
describe('simulateTransactions', () => {
  it('a SOL transfer: SOL changes by what the node reports (the fee included); the fee computed locally; first send and over 5 % (B1b rules)', async () => {
    const s = scene({post: a => (a === ME.toBase58() ? {lamports: SOL - 500_005_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : null)});
    const sim = await run(s, [wire([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 500_000_000})])]);
    expect(sim.outcomes).toEqual([{ok: true, changes: [{mint: null, amount: '-500005000', decimals: 9, usdMicros: '-75000750'}], unitsConsumed: 1_234, unitLimit: 200_000, feeLamports: '5000'}]);
    // The simulated accounts: the wallet account first, then every writable account the transaction names.
    expect(s.simulations[0]?.accounts).toEqual([ME.toBase58(), TO.toBase58()]);
    expect(sim.reasons).toEqual(['first-send', 'over-5-percent']);
    expect(sim.lastValidBlockHeight).toBe(4_242);
    expect(sim.slot).toBe(301);
    expect(sim.id).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('positive control: a small transfer to a known recipient needs no re-authentication', async () => {
    const s = scene({post: a => (a === ME.toBase58() ? {lamports: SOL - 1_005_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : null)});
    const sim = await run(s, [wire([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1_000_000})])], a => a === TO.toBase58());
    expect(sim.reasons).toEqual([]);
  });

  it('tokens: an existing account loses, a new account (created by the transaction) gains — its mint’s decimals read once; a closed account loses all', async () => {
    const closing = 'CLoSE7RZXBqUBQuYuPxMjBwRGt6aMYn7nUykAmgdUCLu';
    const s = scene({
      holdings: [holding(SRC, MAINNET_NOC_MINT, 100_000_000_000n), holding(closing, MAINNET_USDC_MINT, 2_000_000n, 6)],
      post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : a === SRC ? tokenAfter(MAINNET_NOC_MINT, 90_000_000_000n) : a === NEW_ATA ? tokenAfter(ODD_MINT, 777n) : null),
      accounts: new Map([[ODD_MINT, {lamports: 1n, owner: TOKEN_PROGRAM, data: Uint8Array.from({length: 82}, (_, i) => (i === 44 ? 4 : 0))}]]),
    });
    const dexIx = new TransactionInstruction({programId: DEX, data: Buffer.from([1]), keys: [SRC, NEW_ATA, closing].map(k => ({pubkey: new PublicKey(k), isSigner: false, isWritable: true})).concat([{pubkey: ME, isSigner: true, isWritable: true}])});
    const sim = await run(s, [wire([dexIx])]);
    const out = sim.outcomes[0];
    expect(out?.ok).toBe(true);
    expect(out?.ok === true ? out.changes : null).toEqual([
      {mint: null, amount: '-5000', decimals: 9, usdMicros: '-750'},
      {mint: MAINNET_NOC_MINT, amount: '-10000000000', decimals: 9, usdMicros: '-1501000'},
      {mint: ODD_MINT, amount: '777', decimals: 4, usdMicros: null},
      {mint: MAINNET_USDC_MINT, amount: '-2000000', decimals: 6, usdMicros: '-2000000'},
    ]);
    expect(s.reads).toEqual([[], [ODD_MINT]]);
  });

  it('a writable token account of SOMEONE ELSE (a recipient’s) is not the account’s change, however its amount moves', async () => {
    const s = scene({
      holdings: [holding(SRC, MAINNET_NOC_MINT, 100n)],
      post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : a === SRC ? tokenAfter(MAINNET_NOC_MINT, 90n) : a === NEW_ATA ? tokenAfter(MAINNET_NOC_MINT, 10n, TO.toBase58()) : null),
    });
    const sim = await run(s, [wire([tokenIx([3, ...u64(10n)], [SRC, NEW_ATA, ME.toBase58()])])]);
    const out = sim.outcomes[0];
    expect(out?.ok === true ? out.changes.map(c => [c.mint, c.amount]) : null).toEqual([
      [null, '-5000'],
      [MAINNET_NOC_MINT, '-10'],
    ]);
  });

  it('a transfer between the account’s own token accounts is not a first send; a token transfer to anyone else is', async () => {
    const other = 'CLoSE7RZXBqUBQuYuPxMjBwRGt6aMYn7nUykAmgdUCLu';
    const s = scene({holdings: [holding(SRC, MAINNET_NOC_MINT, 100n), holding(other, MAINNET_NOC_MINT, 0n)], post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : null)});
    const own = await run(s, [wire([tokenIx([3, ...u64(1n)], [SRC, other, ME.toBase58()])])]);
    expect(own.reasons).not.toContain('first-send');
    const away = await run(s, [wire([tokenIx([3, ...u64(1n)], [SRC, NEW_ATA, ME.toBase58()])])]);
    expect(away.reasons).toContain('first-send');
  });

  it('an approval by the account re-authenticates (B1 §3 "bounded approvals")', async () => {
    // The approval moves nothing: the source keeps its 100.
    const s = scene({holdings: [holding(SRC, MAINNET_NOC_MINT, 100n)], post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : a === SRC ? tokenAfter(MAINNET_NOC_MINT, 100n) : null)});
    const sim = await run(s, [wire([tokenIx([4, ...u64(50n)], [SRC, NEW_ATA, ME.toBase58()])])], () => true);
    expect(sim.reasons).toEqual(['approval']);
  });

  it('an outgoing token with no price is above the dollar threshold (fail closed)', async () => {
    const s = scene({holdings: [holding(SRC, ODD_MINT, 1_000_000n, 6)], post: a => (a === SRC ? tokenAfter(ODD_MINT, 999_999n) : a === ME.toBase58() ? {lamports: SOL, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : null)});
    const sim = await run(s, [wire([new TransactionInstruction({programId: DEX, data: Buffer.from([1]), keys: [{pubkey: new PublicKey(SRC), isSigner: false, isWritable: true}, {pubkey: ME, isSigner: true, isWritable: true}]})])], () => true);
    expect(sim.reasons).toEqual(['over-usd-threshold']);
  });

  it('the fee: the transaction’s own unit limit and price; none of the account’s when another account pays', async () => {
    const s = scene({post: a => (a === ME.toBase58() ? {lamports: SOL, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : null)});
    const ixs = [ComputeBudgetProgram.setComputeUnitLimit({units: 50_000}), ComputeBudgetProgram.setComputeUnitPrice({microLamports: 1_000_001}), SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1})];
    const sim = await run(s, [wire(ixs)]);
    // 5 000 + ceil(1 000 001 × 50 000 / 10⁶) = 5 000 + 50 001.
    expect(sim.outcomes[0]).toMatchObject({ok: true, unitLimit: 50_000, feeLamports: '55001'});
    const paid = await run(s, [wire([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1})], {payer: TO})]);
    expect(paid.outcomes[0]).toMatchObject({ok: true, feeLamports: null});
  });

  it('an expired blockhash (the node’s BlockhashNotFound) is `expired` (Q21); any other error is `failed`, with its detail', async () => {
    const tx = wire([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1})]);
    expect((await run(scene({err: 'BlockhashNotFound'}), [tx])).outcomes).toEqual([{ok: false, error: 'expired', detail: '"BlockhashNotFound"'}]);
    expect((await run(scene({err: {InstructionError: [0, {Custom: 1}]}}), [tx])).outcomes).toEqual([{ok: false, error: 'failed', detail: '{"InstructionError":[0,{"Custom":1}]}'}]);
  });

  it('a batch: each transaction simulated on its own, in order', async () => {
    const s = scene({post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : null)});
    const sim = await run(s, [1, 2, 3].map(n => wire([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: n})])), () => true);
    expect(s.simulations).toHaveLength(3);
    expect(sim.outcomes).toHaveLength(3);
    expect(sim.slot).toBe(303);
  });

  it('lookup tables: read once, through getMultipleAccounts; only the lookup-table program’s accounts count', async () => {
    const table = new PublicKey(new Uint8Array(32).fill(9));
    const alt = {key: table, state: {deactivationSlot: 2n ** 64n - 1n, lastExtendedSlot: 0, lastExtendedSlotStartIndex: 0, authority: undefined, addresses: [TO]}, isActive: () => true} as unknown as AddressLookupTableAccount;
    const data = new Uint8Array(56 + 32);
    new DataView(data.buffer).setUint32(0, 1, true);
    data.set(TO.toBytes(), 56);
    const tx = wire([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1})], {tables: [alt]});
    const good = scene({accounts: new Map([[table.toBase58(), {lamports: 1n, owner: ADDRESS_LOOKUP_TABLE_PROGRAM, data}]]), post: a => (a === ME.toBase58() ? {lamports: SOL, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : null)});
    const sim = await run(good, [tx]);
    expect(good.reads[0]).toEqual([table.toBase58()]);
    expect(sim.keys[0]).toEqual([ME.toBase58(), SystemProgram.programId.toBase58(), TO.toBase58()]);
    expect(good.simulations[0]?.accounts).toEqual([ME.toBase58(), TO.toBase58()]);
    // The same bytes owned by another program are not a table: the key stays unresolved.
    const forged = scene({accounts: new Map([[table.toBase58(), {lamports: 1n, owner: TOKEN_PROGRAM, data}]]), post: a => (a === ME.toBase58() ? {lamports: SOL, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : null)});
    expect((await run(forged, [tx])).keys[0]).toEqual([ME.toBase58(), SystemProgram.programId.toBase58(), null]);
  });

  it('a read that fails throws (the caller records the simulation as unreachable)', async () => {
    const s = scene({});
    s.deps.reader.getBalance = async () => {
      throw new Error('unreachable');
    };
    await expect(run(s, [wire([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1})])])).rejects.toThrow('unreachable');
    expect(base58.decode(ME.toBase58())).toHaveLength(32);
  });
});
