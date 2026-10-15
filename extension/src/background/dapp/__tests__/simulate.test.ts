import {base58} from '@scure/base';
import {ComputeBudgetProgram, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction, type AddressLookupTableAccount} from '@solana/web3.js';
import type {AccountData, SimulatedAccount, SimulationOutcome, TokenAccountEntry} from '../../../../../core/solana/rpc';
import {MAINNET_NOC_MINT, MAINNET_USDC_MINT} from '../../../../../core/presale/addresses';
import {fakeDeps, fakeReader} from '../../__tests__/fakeDeps';
import {BLOCKHASH, PUB, RECIPIENT, tokenAccountData} from '../../__tests__/fixtures';
import {ADDRESS_LOOKUP_TABLE_PROGRAM} from '../decode/keys';
import {TOKEN_2022_PROGRAM, TOKEN_PROGRAM} from '../decode/decode';
import {parseWire} from '../decode/wire';
import {simulateTransactions, WRAPPED_SOL_MINT, type TxSimulation} from '../simulate';

const ME = new PublicKey(PUB);
const TO = new PublicKey(RECIPIENT);
const SRC = '4G8U5nQtNciNaEL7Zimb4DhqeanDMevXp7MLtFvUojwF';
const NEW_ATA = 'FpV5mr137k3GfLJqqWnZer12v2KxZfEEQzxXb6sJLABU';
const ODD_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYC';
/** A second holding, distinct from SRC — used wherever a test needs two of the wallet's own accounts at once. */
const T22_SRC = new PublicKey(new Uint8Array(32).fill(7)).toBase58();
const DEX = new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');
const SOL = 10_000_000_000n;

const wire = (instructions: TransactionInstruction[], o: {payer?: PublicKey; tables?: AddressLookupTableAccount[]} = {}): Uint8Array =>
  new VersionedTransaction(new TransactionMessage({payerKey: o.payer ?? ME, recentBlockhash: BLOCKHASH, instructions}).compileToV0Message(o.tables ?? [])).serialize();
const u64 = (n: bigint): number[] => Array.from({length: 8}, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));
const tokenIx = (data: number[], keys: string[], signer = ME.toBase58()) =>
  new TransactionInstruction({programId: new PublicKey(TOKEN_PROGRAM), data: Buffer.from(data), keys: keys.map(k => ({pubkey: new PublicKey(k), isSigner: k === signer, isWritable: k !== signer}))});
/** An unknown-program instruction touching `keys` (plus ME as the fee payer) — stands in for a dApp's own CPI-heavy program, whose own instruction never decodes as a known one (I1: approval must still be read from chain state). */
const unknownIx = (keys: string[]) => new TransactionInstruction({programId: DEX, data: Buffer.from([1]), keys: keys.map(k => ({pubkey: new PublicKey(k), isSigner: false, isWritable: true})).concat([{pubkey: ME, isSigner: true, isWritable: true}])});
const holding = (pubkey: string, mint: string, amount: bigint, decimals = 9): TokenAccountEntry => ({pubkey, mint, owner: ME.toBase58(), amount, decimals});
const tokenAfter = (mint: string, amount: bigint, owner = ME.toBase58()): SimulatedAccount => ({lamports: 2_039_280n, owner: TOKEN_PROGRAM, data: tokenAccountData(mint, owner, amount)});
/** The same 165 bytes under Token-2022's program id instead of classic Token's (I2 positive control: a real Token-2022 account is tracked exactly like a classic one). */
const t22After = (mint: string, amount: bigint, owner = ME.toBase58()): SimulatedAccount => ({lamports: 2_039_280n, owner: TOKEN_2022_PROGRAM, data: tokenAccountData(mint, owner, amount)});
/** `tokenAfter`'s bytes, with a delegate and its approved amount set (COption<Pubkey> at 72, u64 at 121) — the chain state a real Approve (or a CPI'd one, I1) leaves behind. */
const tokenDelegated = (mint: string, amount: bigint, delegate: string, delegatedAmount: bigint, owner = ME.toBase58()): SimulatedAccount => {
  const data = tokenAccountData(mint, owner, amount);
  new DataView(data.buffer).setUint32(72, 1, true);
  data.set(new PublicKey(delegate).toBytes(), 76);
  new DataView(data.buffer).setBigUint64(121, delegatedAmount, true);
  return {lamports: 2_039_280n, owner: TOKEN_PROGRAM, data};
};
/** `tokenAfter`'s bytes, with a close authority set (COption<Pubkey> at 129) — I1's other chain-state signal. */
const tokenWithCloseAuthority = (mint: string, amount: bigint, authority: string, owner = ME.toBase58()): SimulatedAccount => {
  const data = tokenAccountData(mint, owner, amount);
  new DataView(data.buffer).setUint32(129, 1, true);
  data.set(new PublicKey(authority).toBytes(), 133);
  return {lamports: 2_039_280n, owner: TOKEN_PROGRAM, data};
};
/**
 * A realistic native-mint (wSOL) token account (fix round 2, IMPORTANT): is_native Some(rent) (COption<u64> at
 * 109..121 — tag u32 at 109, the rent-exempt reserve as u64 at 113), `amount` = lamports − rent, and the account's own
 * `lamports` = amount + rent — the Token program's own invariant for every is_native account. The round 1 test this
 * replaces (`{amount: 0n, lamports: 52_039_280n, is_native unset}`) hid the double-counting bug the review found:
 * no real native account looks like that.
 */
const wsolAccount = (amount: bigint, rent: bigint, owner = ME.toBase58()): SimulatedAccount => {
  const data = tokenAccountData(WRAPPED_SOL_MINT, owner, amount);
  const view = new DataView(data.buffer);
  view.setUint32(109, 1, true);
  view.setBigUint64(113, rent, true);
  return {lamports: amount + rent, owner: TOKEN_PROGRAM, data};
};
/**
 * A 355-byte Multisig struct (SPL Token's own size: m, n, is_initialized, 11 signers) shaped to also pass as an
 * extended Token-2022 account if length alone were trusted: mint/owner fields and an amount planted at the classic
 * Account offsets, Initialized at 108, and byte 165 forged to 2 (AccountType::Account) — I2's attack, closed by
 * `isTokenAccountLayout`'s explicit `length !== 355` exclusion.
 */
const forgedMultisig = (ownerField: string, amount: bigint): SimulatedAccount => {
  const data = new Uint8Array(355);
  data.set(base58.decode(MAINNET_NOC_MINT), 0);
  data.set(base58.decode(ownerField), 32);
  new DataView(data.buffer).setBigUint64(64, amount, true);
  data[108] = 1;
  data[165] = 2;
  return {lamports: 2_039_280n, owner: TOKEN_2022_PROGRAM, data};
};

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
      // Fix round 1 (I1/I2): the per-transaction delta now reads SRC's and closing's PRE state fresh, through
      // getAccountsData, not from the holdings snapshot above (which still feeds only the decimals map and the
      // reauth balance denominator) — so the scene must say what those addresses held right before this transaction.
      accounts: new Map([
        [ODD_MINT, {lamports: 1n, owner: TOKEN_PROGRAM, data: Uint8Array.from({length: 82}, (_, i) => (i === 44 ? 4 : 0))}],
        [SRC, tokenAfter(MAINNET_NOC_MINT, 100_000_000_000n)],
        [closing, tokenAfter(MAINNET_USDC_MINT, 2_000_000n)],
      ]),
    });
    const dexIx = new TransactionInstruction({programId: DEX, data: Buffer.from([1]), keys: [SRC, NEW_ATA, closing].map(k => ({pubkey: new PublicKey(k), isSigner: false, isWritable: true})).concat([{pubkey: ME, isSigner: true, isWritable: true}])});
    const sim = await run(s, [wire([dexIx])]);
    const out = sim.outcomes[0];
    expect(out?.ok).toBe(true);
    // closing's own rent (2 039 280 lamports) leaves as SOL (Promoted Minor 3); NEW_ATA's own rent arrives the same
    // way — the two cancel, so the SOL line is still exactly the fee, as before the fix.
    expect(out?.ok === true ? out.changes : null).toEqual([
      {mint: null, amount: '-5000', decimals: 9, usdMicros: '-750'},
      {mint: MAINNET_NOC_MINT, amount: '-10000000000', decimals: 9, usdMicros: '-1501000'},
      {mint: ODD_MINT, amount: '777', decimals: 4, usdMicros: null},
      {mint: MAINNET_USDC_MINT, amount: '-2000000', decimals: 6, usdMicros: '-2000000'},
    ]);
    expect(s.reads).toEqual([[], [ME.toBase58(), SRC, NEW_ATA, closing], [ODD_MINT]]);
  });

  it('a writable token account of SOMEONE ELSE (a recipient’s) is not the account’s change, however its amount moves', async () => {
    const s = scene({
      holdings: [holding(SRC, MAINNET_NOC_MINT, 100n)],
      accounts: new Map([[SRC, tokenAfter(MAINNET_NOC_MINT, 100n)]]),
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

  it('an approval by the account re-authenticates (B1 §3 "bounded approvals"), decided from the chain state it leaves (I1)', async () => {
    // The approval moves nothing: the source keeps its 100, but its post-state now carries a real delegate.
    const s = scene({
      holdings: [holding(SRC, MAINNET_NOC_MINT, 100n)],
      accounts: new Map([[SRC, tokenAfter(MAINNET_NOC_MINT, 100n)]]),
      post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : a === SRC ? tokenDelegated(MAINNET_NOC_MINT, 100n, NEW_ATA, 50n) : null),
    });
    const sim = await run(s, [wire([tokenIx([4, ...u64(50n)], [SRC, NEW_ATA, ME.toBase58()])])], () => true);
    expect(sim.reasons).toEqual(['approval']);
  });

  it('a CPI approval (an unknown program raising a delegation) re-authenticates even with no top-level Approve to decode (I1)', async () => {
    const s = scene({
      accounts: new Map([[SRC, tokenAfter(MAINNET_NOC_MINT, 100n)]]),
      post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : a === SRC ? tokenDelegated(MAINNET_NOC_MINT, 100n, NEW_ATA, 50n) : null),
    });
    const sim = await run(s, [wire([unknownIx([SRC])])], () => true);
    expect(sim.reasons).toEqual(['approval']);
  });

  it('a raised delegated amount re-authenticates even when the delegate itself is unchanged (I1)', async () => {
    const s = scene({
      accounts: new Map([[SRC, tokenDelegated(MAINNET_NOC_MINT, 100n, NEW_ATA, 10n)]]),
      post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : a === SRC ? tokenDelegated(MAINNET_NOC_MINT, 100n, NEW_ATA, 20n) : null),
    });
    const sim = await run(s, [wire([unknownIx([SRC])])], () => true);
    expect(sim.reasons).toEqual(['approval']);
  });

  it('an unchanged delegation is not a re-authentication (I1 negative control)', async () => {
    const s = scene({
      accounts: new Map([[SRC, tokenDelegated(MAINNET_NOC_MINT, 100n, NEW_ATA, 10n)]]),
      post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : a === SRC ? tokenDelegated(MAINNET_NOC_MINT, 100n, NEW_ATA, 10n) : null),
    });
    const sim = await run(s, [wire([unknownIx([SRC])])], () => true);
    expect(sim.reasons).toEqual([]);
  });

  it('a changed close authority re-authenticates too (I1; documented choice: the same `approval` reason — no separate copy exists for it)', async () => {
    const s = scene({
      accounts: new Map([[SRC, tokenAfter(MAINNET_NOC_MINT, 100n)]]),
      post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : a === SRC ? tokenWithCloseAuthority(MAINNET_NOC_MINT, 100n, NEW_ATA) : null),
    });
    const sim = await run(s, [wire([unknownIx([SRC])])], () => true);
    expect(sim.reasons).toEqual(['approval']);
  });

  it('an outgoing token with no price is above the dollar threshold (fail closed)', async () => {
    const s = scene({
      holdings: [holding(SRC, ODD_MINT, 1_000_000n, 6)],
      accounts: new Map([[SRC, tokenAfter(ODD_MINT, 1_000_000n)]]),
      post: a => (a === SRC ? tokenAfter(ODD_MINT, 999_999n) : a === ME.toBase58() ? {lamports: SOL, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : null),
    });
    const sim = await run(s, [wire([new TransactionInstruction({programId: DEX, data: Buffer.from([1]), keys: [{pubkey: new PublicKey(SRC), isSigner: false, isWritable: true}, {pubkey: ME, isSigner: true, isWritable: true}]})])], () => true);
    expect(sim.reasons).toEqual(['over-usd-threshold']);
  });

  it('a Token-2022 token account is tracked like a classic one; a 355-byte same-length impostor is never read as the wallet’s own account instead (I2)', async () => {
    const s = scene({
      accounts: new Map([[T22_SRC, t22After(MAINNET_NOC_MINT, 50n)]]),
      post: a =>
        a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : a === T22_SRC ? t22After(MAINNET_NOC_MINT, 40n) : a === SRC ? forgedMultisig(ME.toBase58(), 999_999_999n) : null,
    });
    const sim = await run(s, [wire([unknownIx([T22_SRC, SRC])])]);
    const out = sim.outcomes[0];
    // The real Token-2022 account's loss shows; the forged 355-byte account (owner field crafted to be ME, an
    // Initialized state byte, byte 165 forged to look like an extended account's AccountType::Account) contributes
    // nothing at all — not the huge amount planted in it, not even a zero line.
    expect(out?.ok === true ? out.changes.map(c => [c.mint, c.amount]) : null).toEqual([
      [null, '-5000'],
      [MAINNET_NOC_MINT, '-10'],
    ]);
  });

  // Fix round 2 (IMPORTANT): a native-mint account's lamports are its value (lamports = amount + rent, enforced by
  // the Token program for every is_native account) — it must count ONCE, as SOL, never also as a wSOL token line.
  describe('a native-mint (wSOL) account counts only as SOL, never also as a token line', () => {
    const A = 50_000_000n;
    const RENT = 2_039_280n;

    it('closing to a foreign destination shows its lamports (amount + rent) as a SOL loss only', async () => {
      const s = scene({
        accounts: new Map([[SRC, wsolAccount(A, RENT)]]),
        post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : null),
      });
      const closeIx = new TransactionInstruction({
        programId: new PublicKey(TOKEN_PROGRAM),
        data: Buffer.from([9]),
        keys: [SRC, RECIPIENT, ME.toBase58()].map((k, i) => ({pubkey: new PublicKey(k), isSigner: i === 2, isWritable: i !== 2})),
      });
      const sim = await run(s, [wire([closeIx])]);
      const out = sim.outcomes[0];
      // 5 000 (fee) + 50 000 000 (amount) + 2 039 280 (rent) = 52 044 280 — one line, never also a wSOL "-50000000".
      expect(out?.ok === true ? out.changes : null).toEqual([{mint: null, amount: '-52044280', decimals: 9, usdMicros: '-7806642'}]);
    });

    it('unwrapping to self nets to just the fee — the rent cancels, no stray wSOL or rent line', async () => {
      const s = scene({
        accounts: new Map([[SRC, wsolAccount(A, RENT)]]),
        post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n + A + RENT, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : null),
      });
      const closeIx = new TransactionInstruction({
        programId: new PublicKey(TOKEN_PROGRAM),
        data: Buffer.from([9]),
        keys: [SRC, ME.toBase58(), ME.toBase58()].map((k, i) => ({pubkey: new PublicKey(k), isSigner: i === 2, isWritable: i !== 2})),
      });
      const sim = await run(s, [wire([closeIx])]);
      const out = sim.outcomes[0];
      expect(out?.ok === true ? out.changes : null).toEqual([{mint: null, amount: '-5000', decimals: 9, usdMicros: '-750'}]);
    });

    it('a wSOL transfer out loses the moved amount once, not twice', async () => {
      const moved = 10_000_000n;
      const s = scene({
        accounts: new Map([[SRC, wsolAccount(A, RENT)]]),
        post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : a === SRC ? wsolAccount(A - moved, RENT) : null),
      });
      const sim = await run(s, [wire([tokenIx([3, ...u64(moved)], [SRC, NEW_ATA, ME.toBase58()])])]);
      const out = sim.outcomes[0];
      // -10 005 000 = -(moved + fee); a doubled count would show -20 005 000 (moved subtracted again as a wSOL line).
      expect(out?.ok === true ? out.changes.map(c => [c.mint, c.amount]) : null).toEqual([[null, '-10005000']]);
    });

    it('lamports arriving and SyncNative count the gain once, not twice', async () => {
      const inflow = 5_000_000n;
      const s = scene({
        accounts: new Map([[SRC, wsolAccount(A, RENT)]]),
        post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : a === SRC ? wsolAccount(A + inflow, RENT) : null),
      });
      // An unknown program (the dApp) funds SRC by CPI (real lamports, not from ME); SyncNative reconciles `amount`.
      const syncIx = new TransactionInstruction({programId: new PublicKey(TOKEN_PROGRAM), data: Buffer.from([17]), keys: [{pubkey: new PublicKey(SRC), isSigner: false, isWritable: true}]});
      const sim = await run(s, [wire([unknownIx([SRC]), syncIx])]);
      const out = sim.outcomes[0];
      // 5 000 000 (inflow) − 5 000 (fee) = 4 995 000; a doubled count would show 9 995 000 (the synced `amount` also added).
      expect(out?.ok === true ? out.changes.map(c => [c.mint, c.amount]) : null).toEqual([[null, '4995000']]);
    });
  });

  it('a 355-byte same-length impostor is never read for a mint’s decimals either (Minor, consistent with I2)', async () => {
    const forgedMint: AccountData = {
      lamports: 1n,
      owner: TOKEN_2022_PROGRAM,
      data: (() => {
        const d = new Uint8Array(355);
        d[44] = 99; // a forged decimals byte — if read, this would wrongly show decimals: 99
        d[165] = 1; // forged AccountType::Mint
        return d;
      })(),
    };
    const s = scene({
      accounts: new Map([
        [SRC, tokenAfter(ODD_MINT, 1_000_000n)],
        [ODD_MINT, forgedMint],
      ]),
      post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : a === SRC ? tokenAfter(ODD_MINT, 900_000n) : null),
    });
    const sim = await run(s, [wire([unknownIx([SRC])])]);
    const out = sim.outcomes[0];
    const line = out?.ok === true ? out.changes.find(c => c.mint === ODD_MINT) : undefined;
    // Rejected: decimals stay unknown (null, shown in base units) rather than the forged 99.
    expect(line).toMatchObject({mint: ODD_MINT, amount: '-100000', decimals: null, usdMicros: null});
  });

  it('an own account reassigned to someone else (a CPI SetAuthority AccountOwner) re-authenticates too, on top of the −all loss already shown', async () => {
    const s = scene({
      // A large enough holdings balance that losing SRC's 100 is under the unrelated 5 % rule — isolates this test to
      // the owner-change reason alone.
      holdings: [holding(SRC, MAINNET_NOC_MINT, 10_000n)],
      accounts: new Map([[SRC, tokenAfter(MAINNET_NOC_MINT, 100n)]]),
      post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : a === SRC ? tokenAfter(MAINNET_NOC_MINT, 100n, NEW_ATA) : null),
    });
    const sim = await run(s, [wire([unknownIx([SRC])])], () => true);
    const out = sim.outcomes[0];
    expect(sim.reasons).toEqual(['approval']);
    // The fee, plus SRC's rent (2 039 280) — no longer ours to attribute lamports to once its owner field isn't ours.
    expect(out?.ok === true ? out.changes.map(c => [c.mint, c.amount]) : null).toEqual([
      [null, '-2044280'],
      [MAINNET_NOC_MINT, '-100'],
    ]);
  });

  it('an owner change on an otherwise-empty account (only its rent moves) still re-authenticates', async () => {
    const s = scene({
      accounts: new Map([[SRC, tokenAfter(MAINNET_NOC_MINT, 0n)]]),
      post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : a === SRC ? tokenAfter(MAINNET_NOC_MINT, 0n, NEW_ATA) : null),
    });
    const sim = await run(s, [wire([unknownIx([SRC])])], () => true);
    expect(sim.reasons).toEqual(['approval']);
    // Empty (amount 0 both sides, so no token line at all) — only the rent, treated as lost along with control, shows.
    const out = sim.outcomes[0];
    expect(out?.ok === true ? out.changes : null).toEqual([{mint: null, amount: '-2044280', decimals: 9, usdMicros: '-306642'}]);
  });

  it('a null post for the wallet account is a full SOL loss', async () => {
    const s = scene({post: () => null});
    const sim = await run(s, [wire([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1})])]);
    const out = sim.outcomes[0];
    expect(out?.ok === true ? out.changes : null).toEqual([{mint: null, amount: '-10000000000', decimals: 9, usdMicros: '-1500000000'}]);
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
  });
});
