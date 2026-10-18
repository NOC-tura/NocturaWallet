import {base58} from '@scure/base';
import {ComputeBudgetProgram, PublicKey, SYSVAR_RENT_PUBKEY, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction, type AddressLookupTableAccount} from '@solana/web3.js';
import {MAX_MULTIPLE_ACCOUNTS, type AccountData, type SimulatedAccount, type SimulationOutcome, type TokenAccountEntry} from '../../../../../core/solana/rpc';
import {MAINNET_NOC_MINT, MAINNET_USDC_MINT} from '../../../../../core/presale/addresses';
import {fakeDeps, fakeReader} from '../../__tests__/fakeDeps';
import {BLOCKHASH, PUB, RECIPIENT, tokenAccountData} from '../../__tests__/fixtures';
import {ADDRESS_LOOKUP_TABLE_PROGRAM} from '../decode/keys';
import {ATA_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM} from '../decode/decode';
import {parseWire} from '../decode/wire';
import {simStateOf, simulateTransactions, WRAPPED_SOL_MINT, type TxSimulation} from '../simulate';
import {ACCOUNT_SIZE, U64_MAX, keyOf, mintBytes, otherExt, tokenAccountBytes, usdcLikeMint, withByte} from './tokenBytes';

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
/** Token-2022's OWN native mint (fix round 3, IMPORTANT) — distinct from WRAPPED_SOL_MINT, same is_native invariant. */
const T22_NATIVE_MINT = '9pan9bMn5HatX4EJdBwg9VgCa7Uz5HL8N1m5D3NdXejP';
/** `wsolAccount`, under Token-2022's program and its own native mint — proves native status is decided by the
 * is_native tag, not by comparing against WRAPPED_SOL_MINT specifically. */
const t22NativeAccount = (amount: bigint, rent: bigint, owner = ME.toBase58()): SimulatedAccount => {
  const data = tokenAccountData(T22_NATIVE_MINT, owner, amount);
  const view = new DataView(data.buffer);
  view.setUint32(109, 1, true);
  view.setBigUint64(113, rent, true);
  return {lamports: amount + rent, owner: TOKEN_2022_PROGRAM, data};
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
function scene(o: {
  holdings?: TokenAccountEntry[];
  post?: (address: string, call: number) => SimulatedAccount | null;
  err?: unknown;
  /** B1c-3: the error of simulateTransaction call `call` (1-based); null or undefined: it runs. */
  errAt?: (call: number) => unknown;
  accounts?: Map<string, AccountData | null>;
  lamports?: bigint;
  /** B1c-3: a getAccountsData call this answers true for throws (the proxy failing that read). */
  readFails?: (addresses: readonly string[]) => boolean;
}) {
  const simulations: {tx: string; accounts: readonly string[] | undefined}[] = [];
  const reads: string[][] = [];
  const reader = fakeReader({
    getBalance: async () => o.lamports ?? SOL,
    getTokenAccountsByOwner: async (_owner, filter) => ('programId' in filter && filter.programId === TOKEN_PROGRAM ? (o.holdings ?? []) : []),
    getLatestBlockhash: async () => ({blockhash: BLOCKHASH, lastValidBlockHeight: 4_242}),
    getAccountsData: async addresses => {
      // The real reader's own cap (core/solana/rpc.ts): more than MAX_MULTIPLE_ACCOUNTS addresses in one call throws.
      if (addresses.length > MAX_MULTIPLE_ACCOUNTS) throw new RangeError(`getAccountsData: at most ${MAX_MULTIPLE_ACCOUNTS} addresses`);
      if (o.readFails?.(addresses) === true) throw new Error('the proxy is unreachable');
      reads.push([...addresses]);
      return addresses.map(a => o.accounts?.get(a) ?? null);
    },
    simulateTransaction: async (tx, opts): Promise<SimulationOutcome> => {
      simulations.push({tx, accounts: opts?.accounts});
      const call = simulations.length;
      const err = o.errAt !== undefined ? o.errAt(call) : o.err;
      if (err !== undefined && err !== null) return {err, logs: [], unitsConsumed: 0, slot: 300 + call, accounts: null};
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
        // B1c-3 fix round 1 (I2): byte 45 (is_initialized) must be 1 — tokenState's mintInfo now refuses an
        // uninitialized mint — alongside byte 44's decimals; every other byte stays 0 (no authorities).
        [ODD_MINT, {lamports: 1n, owner: TOKEN_PROGRAM, data: Uint8Array.from({length: 82}, (_, i) => (i === 44 ? 4 : i === 45 ? 1 : 0))}],
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
    // B1c-3: one mint read for the batch — every mint the red flags need (each own token account's, pre and post: the
    // wallet's own NOC and USDC too, whose decimals it already knows), which also gives ODD_MINT's decimals.
    expect(s.reads).toEqual([[], [ME.toBase58(), SRC, NEW_ATA, closing], [MAINNET_NOC_MINT, MAINNET_USDC_MINT, ODD_MINT]]);
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

  // B1c-3 (R10): an own token account the holdings name is still never a recipient; an unreadable destination is a first
  // send (fail closed). The destination's owner rule is the describe below.
  it('a transfer between the account’s own token accounts is not a first send; a token transfer to a destination it cannot read is', async () => {
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

  // B1c-3 (F4): a changed close authority of an own account is now also a block — the `override` reason follows it.
  it('a changed close authority re-authenticates too (I1; documented choice: the same `approval` reason — no separate copy exists for it), and blocks (F4: override)', async () => {
    const s = scene({
      accounts: new Map([[SRC, tokenAfter(MAINNET_NOC_MINT, 100n)]]),
      post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : a === SRC ? tokenWithCloseAuthority(MAINNET_NOC_MINT, 100n, NEW_ATA) : null),
    });
    const sim = await run(s, [wire([unknownIx([SRC])])], () => true);
    expect(sim.reasons).toEqual(['approval', 'override']);
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

    // Fix round 3 (IMPORTANT, still open after round 2): Token-2022 has its OWN native mint, distinct from
    // WRAPPED_SOL_MINT, carrying the identical is_native / lamports = amount + rent invariant — native status must be
    // decided from the is_native tag itself (pre OR post), never the mint address alone, or these would double-count
    // exactly like classic wSOL did before round 2.
    it('a Token-2022 native account (its own native mint, not WRAPPED_SOL_MINT) also counts the gain once, not twice', async () => {
      const inflow = 5_000_000n;
      const s = scene({
        accounts: new Map([[SRC, t22NativeAccount(A, RENT)]]),
        post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : a === SRC ? t22NativeAccount(A + inflow, RENT) : null),
      });
      const syncIx = new TransactionInstruction({programId: new PublicKey(TOKEN_2022_PROGRAM), data: Buffer.from([17]), keys: [{pubkey: new PublicKey(SRC), isSigner: false, isWritable: true}]});
      const sim = await run(s, [wire([unknownIx([SRC]), syncIx])]);
      const out = sim.outcomes[0];
      expect(out?.ok === true ? out.changes.map(c => [c.mint, c.amount]) : null).toEqual([[null, '4995000']]);
    });

    it('a Token-2022 native account closed to a foreign destination shows its lamports as a SOL loss only, once', async () => {
      const s = scene({
        accounts: new Map([[SRC, t22NativeAccount(A, RENT)]]),
        post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : null),
      });
      const closeIx = new TransactionInstruction({
        programId: new PublicKey(TOKEN_2022_PROGRAM),
        data: Buffer.from([9]),
        keys: [SRC, RECIPIENT, ME.toBase58()].map((k, i) => ({pubkey: new PublicKey(k), isSigner: i === 2, isWritable: i !== 2})),
      });
      const sim = await run(s, [wire([closeIx])]);
      const out = sim.outcomes[0];
      expect(out?.ok === true ? out.changes : null).toEqual([{mint: null, amount: '-52044280', decimals: 9, usdMicros: '-7806642'}]);
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

  // B1c-3 (spec B1c §3.3 rev 3.6): token accounts and mints are read through tokenState's parsers — one source of truth.
  it('one parser: an extended Token-2022 account and mint are read; a TLV that overruns, or a mint’s padding not zero, is not', async () => {
    const t22 = (amount: bigint, tail: readonly number[] = []): SimulatedAccount => ({
      lamports: 2_039_280n,
      owner: TOKEN_2022_PROGRAM,
      data: tokenAccountBytes({mint: ODD_MINT, owner: ME.toBase58(), amount, extensions: [otherExt(7, 0)], tail}),
    });
    const mint = mintBytes({decimals: 4, extended: true});
    const lineFor = async (post: SimulatedAccount, mintData: Uint8Array) => {
      const s = scene({
        accounts: new Map<string, AccountData | null>([
          [SRC, t22(1_000_000n)],
          [ODD_MINT, {lamports: 1n, owner: TOKEN_2022_PROGRAM, data: mintData}],
        ]),
        post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : a === SRC ? post : null),
      });
      const out = (await run(s, [wire([unknownIx([SRC])])])).outcomes[0];
      return out?.ok === true ? out.changes.find(c => c.mint === ODD_MINT) : undefined;
    };
    expect(await lineFor(t22(900_000n), mint)).toMatchObject({amount: '-100000', decimals: 4});
    // The post-state's TLV cut short: not a token account of the wallet's any more — the whole pre amount shows as lost.
    expect(await lineFor(t22(900_000n, [7]), mint)).toMatchObject({amount: '-1000000', decimals: 4});
    // The mint's padding before its AccountType byte not zero: no mint — its decimals unknown (base units).
    expect(await lineFor(t22(900_000n), withByte(mint, ACCOUNT_SIZE - 1, 1))).toMatchObject({amount: '-100000', decimals: null});
  });

  it('an own account reassigned to someone else (a CPI SetAuthority AccountOwner) re-authenticates too, on top of the −all loss already shown — and blocks (F4: override)', async () => {
    const s = scene({
      // A large enough holdings balance that losing SRC's 100 is under the unrelated 5 % rule — isolates this test to
      // the owner-change reason alone.
      holdings: [holding(SRC, MAINNET_NOC_MINT, 10_000n)],
      accounts: new Map([[SRC, tokenAfter(MAINNET_NOC_MINT, 100n)]]),
      post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : a === SRC ? tokenAfter(MAINNET_NOC_MINT, 100n, NEW_ATA) : null),
    });
    const sim = await run(s, [wire([unknownIx([SRC])])], () => true);
    const out = sim.outcomes[0];
    expect(sim.reasons).toEqual(['approval', 'override']);
    // The fee, plus SRC's rent (2 039 280) — no longer ours to attribute lamports to once its owner field isn't ours.
    expect(out?.ok === true ? out.changes.map(c => [c.mint, c.amount]) : null).toEqual([
      [null, '-2044280'],
      [MAINNET_NOC_MINT, '-100'],
    ]);
  });

  it('an owner change on an otherwise-empty account (only its rent moves) still re-authenticates — and blocks (F4: override)', async () => {
    const s = scene({
      accounts: new Map([[SRC, tokenAfter(MAINNET_NOC_MINT, 0n)]]),
      post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : a === SRC ? tokenAfter(MAINNET_NOC_MINT, 0n, NEW_ATA) : null),
    });
    const sim = await run(s, [wire([unknownIx([SRC])])], () => true);
    expect(sim.reasons).toEqual(['approval', 'override']);
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

// B1c-3 (spec B1c §3.3 rev 3.6): the red flags are computed with the simulation, from its own reads, and stored with it.
describe('simulateTransactions: the red flags (B1c-3)', () => {
  type Json = Record<string, unknown>;
  const SYSTEM = SystemProgram.programId.toBase58();
  const NOC = MAINNET_NOC_MINT;
  const DEST = NEW_ATA;
  const DELEGATE = keyOf(51);
  const plain = (lamports: bigint): SimulatedAccount => ({lamports, owner: SYSTEM, data: new Uint8Array()});
  const meAfter = (a: string): SimulatedAccount | null => (a === ME.toBase58() ? plain(SOL - 5_000n) : null);
  /** An associated-token-account create (tag 0) or createIdempotent (tag 1), paid by the account. */
  const ataIx = (account: string, wallet: string, mint: string, tag: 0 | 1 = 1) =>
    new TransactionInstruction({
      programId: new PublicKey(ATA_PROGRAM),
      data: Buffer.from([tag]),
      keys: [
        {pubkey: ME, isSigner: true, isWritable: true},
        {pubkey: new PublicKey(account), isSigner: false, isWritable: true},
        {pubkey: new PublicKey(wallet), isSigner: false, isWritable: false},
        {pubkey: new PublicKey(mint), isSigner: false, isWritable: false},
        {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
        {pubkey: new PublicKey(TOKEN_PROGRAM), isSigner: false, isWritable: false},
      ],
    });
  const tokenTransfer = (destination: string, amount = 1n) => tokenIx([3, ...u64(amount)], [SRC, destination, ME.toBase58()]);
  const approve = (amount: bigint) => wire([tokenIx([4, ...u64(amount)], [SRC, DELEGATE, ME.toBase58()])]);
  const USDC_MINT: AccountData = {lamports: 1n, owner: TOKEN_PROGRAM, data: usdcLikeMint()};
  const approveScene = (delegated: bigint, mint: AccountData | null, o: {readFails?: (addresses: readonly string[]) => boolean} = {}) =>
    scene({
      holdings: [holding(SRC, MAINNET_USDC_MINT, 100n, 6)],
      accounts: new Map<string, AccountData | null>([
        [SRC, tokenAfter(MAINNET_USDC_MINT, 100n)],
        [MAINNET_USDC_MINT, mint],
      ]),
      post: a => (a === SRC ? tokenDelegated(MAINNET_USDC_MINT, 100n, DELEGATE, delegated) : meAfter(a)),
      ...o,
    });
  /** The stored form of a simulation (as storage.session gives it back), edited. */
  const storedWith = (sim: TxSimulation, edit: (s: Json) => void = () => {}): unknown => {
    const copy = JSON.parse(JSON.stringify(sim)) as Json;
    edit(copy);
    return {status: 'ok', sim: copy};
  };
  const flagsOf = (s: Json, tx = 0): Json[] => (s.flags as Json[][])[tx] ?? [];
  const flag = (s: Json, kind: string, tx = 0): Json => {
    const f = flagsOf(s, tx).find(x => x.kind === kind);
    if (f === undefined) throw new Error(`no ${kind} flag`);
    return f;
  };

  it('every mint the flags need is read in one batch, the wallet’s own tokens too: an unlimited USDC approve’s word is USDC, and the block adds `override`', async () => {
    const s = approveScene(U64_MAX, USDC_MINT);
    const sim = await run(s, [approve(U64_MAX)], () => true);
    // USDC's decimals are known without a read (KNOWN_DECIMALS) — read anyway: F5's word needs the mint's own decimals.
    expect(s.reads).toEqual([[], [ME.toBase58(), SRC, DELEGATE], [MAINNET_USDC_MINT]]);
    expect(sim.flags[0]?.find(f => f.kind === 'unlimited-approve')).toMatchObject({severity: 'block', word: 'USDC'});
    expect(sim.reasons).toEqual(['approval', 'override']);
    // The mint unreadable: no symbol (fail closed) — the word is UNLIMITED, still a block.
    const unread = await run(approveScene(U64_MAX, null), [approve(U64_MAX)], () => true);
    expect(unread.flags[0]?.find(f => f.kind === 'unlimited-approve')?.word).toBe('UNLIMITED');
    expect(unread.reasons).toEqual(['approval', 'override']);
    // Negative control: a bounded approve is a warning — no block, no `override`.
    const bounded = await run(approveScene(50n, USDC_MINT), [approve(50n)], () => true);
    // (F6 names the approve, so F2 does not repeat it — the controller's ruling.)
    expect(bounded.flags[0]?.map(f => [f.kind, f.severity])).toEqual([['bounded-approve', 'warn']]);
    expect(bounded.reasons).toEqual(['approval']);
  });

  it('the mint read failing is a failed read like any other: it throws (the caller records the simulation as unreachable)', async () => {
    const s = approveScene(50n, USDC_MINT, {readFails: a => a.includes(MAINNET_USDC_MINT)});
    await expect(run(s, [approve(50n)], () => true)).rejects.toThrow('unreachable');
  });

  it('more mints than one read may name: the first MAX_MULTIPLE_ACCOUNTS read in one call, every other one warns it could not be read (Q36) — never silence, never unreachable', async () => {
    const k = (tag: number, n: number) => base58.encode(Uint8Array.from({length: 32}, (_, i) => (i === 0 ? tag : i === 1 ? n : 7)));
    const owned = Array.from({length: 120}, (_, n) => k(201, n));
    const mints = Array.from({length: 120}, (_, n) => k(202, n));
    const table = new PublicKey(k(203, 0));
    const data = new Uint8Array(56 + 32 * owned.length);
    new DataView(data.buffer).setUint32(0, 1, true);
    owned.forEach((a, n) => data.set(base58.decode(a), 56 + 32 * n));
    const alt = {key: table, state: {deactivationSlot: 2n ** 64n - 1n, lastExtendedSlot: 0, lastExtendedSlotStartIndex: 0, authority: undefined, addresses: owned.map(a => new PublicKey(a))}, isActive: () => true} as unknown as AddressLookupTableAccount;
    const accounts = new Map<string, AccountData | null>([[table.toBase58(), {lamports: 1n, owner: ADDRESS_LOOKUP_TABLE_PROGRAM, data}]]);
    owned.forEach((a, n) => accounts.set(a, tokenAfter(mints[n] ?? '', 1n)));
    // Every mint a classic one (never flagged, O3) — so a warning can only mean "not read".
    for (const m of mints) accounts.set(m, {lamports: 1n, owner: TOKEN_PROGRAM, data: mintBytes({decimals: 0})});
    const s = scene({accounts, post: a => (a === ME.toBase58() ? plain(SOL - 5_000n) : (accounts.get(a) ?? null))});
    const sim = await run(s, [wire([unknownIx(owned.slice(0, 60))], {tables: [alt]}), wire([unknownIx(owned.slice(60))], {tables: [alt]})], () => true);
    expect(s.reads.map(r => r.length)).toEqual([1, 61, 61, MAX_MULTIPLE_ACCOUNTS]);
    expect(s.reads[3]).toEqual(mints.slice(0, MAX_MULTIPLE_ACCOUNTS));
    expect(sim.flags[0]?.filter(f => f.kind === 'token-2022')).toEqual([]);
    expect(sim.flags[1]?.filter(f => f.kind === 'token-2022')).toEqual(mints.slice(MAX_MULTIPLE_ACCOUNTS).map(mint => ({kind: 'token-2022', severity: 'warn', word: null, at: null, mint, settings: null})));
  });

  it('simStateOf: the stored flags are read back strictly — a stored `override` with its block passes, as fresh objects', async () => {
    const sim = await run(approveScene(U64_MAX, USDC_MINT), [approve(U64_MAX)], () => true);
    const stored = storedWith(sim);
    const back = simStateOf(stored);
    expect(back).toEqual({status: 'ok', sim});
    expect(back?.status === 'ok' ? back.sim.flags[0]?.[0] : null).not.toBe(((stored as {sim: Json}).sim.flags as Json[][])[0]?.[0]);
    const bounded = await run(approveScene(50n, USDC_MINT), [approve(50n)], () => true);
    expect(simStateOf(storedWith(bounded))).toEqual({status: 'ok', sim: bounded});
    // Review 3 L14: an unnamed token's word is read back with its rule — UNLIMITED at u64::MAX, ALLOWANCE below it.
    const unnamed = (amount: string, word: string) => (s: Json) => {
      const f = flag(s, 'unlimited-approve');
      f.approvals = [{...(f.approvals as Json[])[0], symbol: null, amount}];
      f.word = word;
    };
    expect(simStateOf(storedWith(sim, unnamed(U64_MAX.toString(), 'UNLIMITED')))?.status).toBe('ok');
    expect(simStateOf(storedWith(sim, unnamed('18446744073709551614', 'ALLOWANCE')))?.status).toBe('ok');
    expect(simStateOf(storedWith(sim, unnamed(U64_MAX.toString(), 'ALLOWANCE')))).toBeNull();
    expect(simStateOf(storedWith(sim, unnamed('18446744073709551614', 'UNLIMITED')))).toBeNull();
  });

  it('simStateOf: an invalid stored flag makes the stored simulation invalid (it is simulated again, never approvable)', async () => {
    const sim = await run(approveScene(U64_MAX, USDC_MINT), [approve(U64_MAX)], () => true);
    const bounded = await run(approveScene(50n, USDC_MINT), [approve(50n)], () => true);
    const edits: [string, TxSimulation, (s: Json) => void][] = [
      ['no flags', sim, s => delete s.flags],
      ['a list per transaction missing', sim, s => (s.flags = [])],
      ['an unknown kind', sim, s => (flag(s, 'unlimited-approve').kind = 'drain')],
      ['a word not the one its approvals give (case)', sim, s => (flag(s, 'unlimited-approve').word = 'usdc')],
      ['a word not the one its approvals give', sim, s => (flag(s, 'unlimited-approve').word = 'UNLIMITED')],
      ['a block stored as a warning', sim, s => (flag(s, 'unlimited-approve').severity = 'warn')],
      ['a key more', sim, s => (flag(s, 'unlimited-approve').extra = 1)],
      ['a key less', sim, s => delete flag(s, 'unlimited-approve').at],
      ['an approval’s symbol not its mint’s', sim, s => ((flag(s, 'unlimited-approve').approvals as Json[])[0] = {...(flag(s, 'unlimited-approve').approvals as Json[])[0], symbol: 'USDT'})],
      [
        'an approval’s symbol not its mint’s, its word made to agree',
        sim,
        s => {
          const f = flag(s, 'unlimited-approve');
          f.approvals = [{...(f.approvals as Json[])[0], symbol: 'USDT'}];
          f.word = 'USDT';
        },
      ],
      ['an approval’s amount not base units', sim, s => ((flag(s, 'unlimited-approve').approvals as Json[])[0] = {...(flag(s, 'unlimited-approve').approvals as Json[])[0], amount: '-1'})],
      ['a flag’s position not its first instruction', sim, s => (flag(s, 'unlimited-approve').at = 3)],
      ['a block without the `override` reason', sim, s => (s.reasons = ['approval'])],
      ['an unknown reason', sim, s => (s.reasons = ['approval', 'override', 'drain'])],
      ['`override` with no block', bounded, s => (s.reasons = ['approval', 'override'])],
      ['a warning stored as a block', bounded, s => (flag(s, 'bounded-approve').severity = 'block')],
    ];
    for (const [name, base, edit] of edits) expect([name, simStateOf(storedWith(base, edit))]).toEqual([name, null]);
  });

  describe('R10: an SPL transfer’s destination resolved to its owner', () => {
    /** Whether the request re-authenticates as a first send; `dest` is the destination's pre-state. */
    const firstSend = async (txs: TransactionInstruction[][], o: {dest?: AccountData | null; known?: string[]} = {}) => {
      const s = scene({
        holdings: [holding(SRC, NOC, 1_000n)],
        accounts: new Map<string, AccountData | null>([
          [SRC, tokenAfter(NOC, 1_000n)],
          [DEST, o.dest ?? null],
        ]),
        post: a => (a === SRC ? tokenAfter(NOC, 999n) : meAfter(a)),
      });
      const sim = await run(s, txs.map(ixs => wire(ixs)), a => (o.known ?? []).includes(a));
      return sim.reasons.includes('first-send');
    };
    const theirs = tokenAfter(NOC, 0n, TO.toBase58());

    it('its pre-state, a token account: an owner the account sent to before, or the account itself, is no first send; anyone else is', async () => {
      expect(await firstSend([[tokenTransfer(DEST)]], {dest: theirs, known: [TO.toBase58()]})).toBe(false);
      expect(await firstSend([[tokenTransfer(DEST)]], {dest: t22After(NOC, 0n, TO.toBase58()), known: [TO.toBase58()]})).toBe(false);
      expect(await firstSend([[tokenTransfer(DEST)]], {dest: theirs})).toBe(true);
      // The account's own token account, though the holdings snapshot does not list it.
      expect(await firstSend([[tokenTransfer(DEST)]], {dest: tokenAfter(NOC, 0n)})).toBe(false);
    });

    it('absent before and created in the same transaction by an ATA create / createIdempotent: that instruction’s wallet decides', async () => {
      expect(await firstSend([[ataIx(DEST, TO.toBase58(), NOC), tokenTransfer(DEST)]], {known: [TO.toBase58()]})).toBe(false);
      expect(await firstSend([[ataIx(DEST, TO.toBase58(), NOC, 0), tokenTransfer(DEST)]], {known: [TO.toBase58()]})).toBe(false);
      expect(await firstSend([[ataIx(DEST, ME.toBase58(), NOC), tokenTransfer(DEST)]])).toBe(false);
      expect(await firstSend([[ataIx(DEST, TO.toBase58(), NOC), tokenTransfer(DEST)]])).toBe(true);
      // An ATA created for another account is not this destination's.
      expect(await firstSend([[ataIx(keyOf(52), TO.toBase58(), NOC), tokenTransfer(DEST)]], {known: [TO.toBase58()]})).toBe(true);
    });

    it('fail closed: unreadable, not a token account, an existing account an ATA create names, or created by another transaction of the batch — a first send', async () => {
      expect(await firstSend([[tokenTransfer(DEST)]], {known: [TO.toBase58(), DEST]})).toBe(true);
      // A plain account at the destination (no token layout) — its own address "known" changes nothing.
      expect(await firstSend([[tokenTransfer(DEST)]], {dest: plain(1n), known: [TO.toBase58(), DEST]})).toBe(true);
      expect(await firstSend([[ataIx(DEST, TO.toBase58(), NOC), tokenTransfer(DEST)]], {dest: plain(1n), known: [TO.toBase58()]})).toBe(true);
      expect(await firstSend([[ataIx(DEST, TO.toBase58(), NOC)], [tokenTransfer(DEST)]], {known: [TO.toBase58()]})).toBe(true);
    });

    it('per transaction (F9 is per transaction): the whole-balance warning only on the transaction that sends to a first-time address', async () => {
      const s = scene({post: (a, call) => (a === ME.toBase58() ? plain(call === 1 ? SOL - 5_001n : SOL - 9_950_005_000n) : null)});
      const sim = await run(s, [wire([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1})]), wire([SystemProgram.transfer({fromPubkey: ME, toPubkey: new PublicKey(keyOf(53)), lamports: 9_950_000_000})])], a => a === TO.toBase58());
      expect(sim.reasons).toContain('whole-balance-to-new');
      expect(sim.flags.map(list => list.some(f => f.kind === 'whole-balance'))).toEqual([false, true]);
    });
  });

  describe('F10: a step that depends on an earlier one of the same batch', () => {
    const invalid = {InstructionError: [0, 'InvalidAccountData']};
    const batch = (txs: TransactionInstruction[][], errAt: (call: number) => unknown, payers: (PublicKey | undefined)[] = []) =>
      run(
        scene({holdings: [holding(SRC, NOC, 1_000n)], accounts: new Map([[SRC, tokenAfter(NOC, 1_000n)]]), post: a => (a === SRC ? tokenAfter(NOC, 1_000n) : meAfter(a)), errAt}),
        txs.map((ixs, i) => wire(ixs, {payer: payers[i]})),
        () => true,
      );
    const dependent = (sim: TxSimulation): boolean => sim.outcomes.some(o => !o.ok && o.error === 'dependent') || sim.flags.flat().some(f => f.kind === 'dependent');

    it('create the token account, then transfer to it: step 2 depends on step 1 — said in its outcome, blocked (UNCHECKED), and the request re-authenticates (override)', async () => {
      const sim = await batch([[ataIx(DEST, TO.toBase58(), NOC)], [tokenTransfer(DEST)]], call => (call === 2 ? invalid : null));
      expect(sim.outcomes[0]).toMatchObject({ok: true});
      expect(sim.outcomes[1]).toEqual({ok: false, error: 'dependent', on: 1, detail: '{"InstructionError":[0,"InvalidAccountData"]}'});
      expect(sim.flags[1]).toContainEqual({kind: 'dependent', severity: 'block', word: 'UNCHECKED', at: null, on: 0});
      // The transfer's destination is created by step 1, not by its own transaction: R10 cannot name its owner — a first send.
      expect(sim.reasons).toEqual(['first-send', 'override']);
      // Stored and read back; a stored dependent step without its flag, or with another step, is invalid.
      expect(simStateOf(storedWith(sim))).toEqual({status: 'ok', sim});
      const drop = (s: Json) => ((s.flags as Json[][])[1] = flagsOf(s, 1).filter(f => f.kind !== 'dependent'));
      expect(simStateOf(storedWith(sim, drop))).toBeNull();
      expect(simStateOf(storedWith(sim, s => (flag(s, 'dependent', 1).on = 1)))).toBeNull();
      expect(simStateOf(storedWith(sim, s => ((s.outcomes as Json[])[1] = {...(s.outcomes as Json[])[1], on: 0})))).toBeNull();
      expect(simStateOf(storedWith(sim, s => ((s.outcomes as Json[])[1] = {...(s.outcomes as Json[])[1], error: 'failed'})))).toBeNull();
      // Review 1 L2: a step depends only on an earlier one — on itself or a later step, flag and outcome agreeing, it is invalid.
      for (const on of [1, 2]) {
        const later = (s: Json) => {
          flag(s, 'dependent', 1).on = on;
          (s.outcomes as Json[])[1] = {...(s.outcomes as Json[])[1], on: on + 1};
        };
        expect(simStateOf(storedWith(sim, later))).toBeNull();
      }
    });

    it('never dependent: a failure in step 1 (nor on itself); one naming an account only a LATER step creates; an unrelated one; an expired blockhash stays expired', async () => {
      const first = await batch([[tokenTransfer(DEST)], [ataIx(DEST, TO.toBase58(), NOC)]], call => (call === 1 ? invalid : null));
      expect(first.outcomes[0]).toEqual({ok: false, error: 'failed', detail: '{"InstructionError":[0,"InvalidAccountData"]}'});
      const itself = await batch([[ataIx(DEST, TO.toBase58(), NOC), tokenTransfer(DEST)]], () => ({InstructionError: [1, 'InvalidAccountData']}));
      expect(itself.outcomes[0]).toMatchObject({ok: false, error: 'failed'});
      const later = await batch([[SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1})], [tokenTransfer(DEST)], [ataIx(DEST, TO.toBase58(), NOC)]], call => (call === 2 ? invalid : null));
      expect(later.outcomes[1]).toMatchObject({ok: false, error: 'failed'});
      const unrelated = await batch([[ataIx(DEST, TO.toBase58(), NOC)], [tokenTransfer(keyOf(54))]], call => (call === 2 ? invalid : null));
      expect(unrelated.outcomes[1]).toMatchObject({ok: false, error: 'failed'});
      const expired = await batch([[ataIx(DEST, TO.toBase58(), NOC)], [tokenTransfer(DEST)]], call => (call === 2 ? 'BlockhashNotFound' : null));
      expect(expired.outcomes[1]).toEqual({ok: false, error: 'expired', detail: '"BlockhashNotFound"'});
      for (const sim of [first, itself, later, unrelated, expired]) {
        expect(dependent(sim)).toBe(false);
        expect(sim.reasons).not.toContain('override');
      }
    });

    it('the instruction the error names decides — its own resolved accounts, never another instruction’s', async () => {
      const txs = [[ataIx(DEST, TO.toBase58(), NOC)], [SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1}), tokenTransfer(DEST)]];
      expect((await batch(txs, call => (call === 2 ? {InstructionError: [0, {Custom: 1}]} : null))).outcomes[1]).toMatchObject({error: 'failed'});
      expect((await batch(txs, call => (call === 2 ? {InstructionError: [1, {Custom: 1}]} : null))).outcomes[1]).toMatchObject({error: 'dependent', on: 1});
    });

    it('only the shapes Agave’s TransactionError takes for it: InstructionError [index, error], and AccountNotFound for a fee payer an earlier step creates; anything else is a plain failure', async () => {
      const txs = [[ataIx(DEST, TO.toBase58(), NOC)], [tokenTransfer(DEST)]];
      for (const err of [{InstructionError: ['0', 'InvalidAccountData']}, {InstructionError: [0]}, {InstructionError: [0, 'X', 1]}, {InstructionError: [1, 'X']}, {InstructionError: [-1, 'X']}, {InstructionError: [0.5, 'X']}, {InstructionError: [0, 'X'], extra: 1}, 'InvalidAccountForFee', 'ProgramAccountNotFound', {InsufficientFundsForRent: {account_index: 1}}, 'AccountNotFound']) {
        const sim = await batch(txs, call => (call === 2 ? err : null));
        expect([err, sim.outcomes[1]]).toEqual([err, {ok: false, error: 'failed', detail: JSON.stringify(err)}]);
      }
      // AccountNotFound: the fee payer has no lamports — attributable when an earlier step creates it.
      const payer = new PublicKey(keyOf(55));
      const fund = SystemProgram.createAccount({fromPubkey: ME, newAccountPubkey: payer, lamports: 1_000_000, space: 0, programId: SystemProgram.programId});
      const spend = SystemProgram.transfer({fromPubkey: payer, toPubkey: TO, lamports: 1});
      const sim = await batch([[fund], [spend]], call => (call === 2 ? 'AccountNotFound' : null), [undefined, payer]);
      expect(sim.outcomes[1]).toEqual({ok: false, error: 'dependent', on: 1, detail: '"AccountNotFound"'});
      // The same error when no earlier step creates the fee payer: a plain failure.
      const other = await batch([[SystemProgram.transfer({fromPubkey: ME, toPubkey: payer, lamports: 1})], [spend]], call => (call === 2 ? 'AccountNotFound' : null), [undefined, payer]);
      expect(other.outcomes[1]).toMatchObject({error: 'failed'});
    });

    it('every creator counts — System createAccount / createAccountWithSeed, ATA create / createIdempotent, Token initializeAccount / 2 / 3; a step that only pays the account does not', async () => {
      const dest = new PublicKey(DEST);
      const owner = Array.from(ME.toBytes());
      const creators: [string, TransactionInstruction][] = [
        ['createAccount', SystemProgram.createAccount({fromPubkey: ME, newAccountPubkey: dest, lamports: 2_039_280, space: 165, programId: new PublicKey(TOKEN_PROGRAM)})],
        ['createAccountWithSeed', SystemProgram.createAccountWithSeed({fromPubkey: ME, newAccountPubkey: dest, basePubkey: ME, seed: 'noc', lamports: 2_039_280, space: 165, programId: new PublicKey(TOKEN_PROGRAM)})],
        ['create', ataIx(DEST, TO.toBase58(), NOC, 0)],
        ['createIdempotent', ataIx(DEST, TO.toBase58(), NOC, 1)],
        ['initializeAccount', tokenIx([1], [DEST, NOC, ME.toBase58(), SYSVAR_RENT_PUBKEY.toBase58()])],
        ['initializeAccount2', tokenIx([16, ...owner], [DEST, NOC, SYSVAR_RENT_PUBKEY.toBase58()])],
        ['initializeAccount3', tokenIx([18, ...owner], [DEST, NOC])],
      ];
      for (const [name, ix] of creators) {
        const sim = await batch([[ix], [tokenTransfer(DEST)]], call => (call === 2 ? invalid : null));
        expect([name, sim.outcomes[1]]).toEqual([name, {ok: false, error: 'dependent', on: 1, detail: '{"InstructionError":[0,"InvalidAccountData"]}'}]);
      }
      const pays = await batch([[SystemProgram.transfer({fromPubkey: ME, toPubkey: dest, lamports: 2_039_280})], [tokenTransfer(DEST)]], call => (call === 2 ? invalid : null));
      expect(pays.outcomes[1]).toMatchObject({error: 'failed'});
    });
  });
});

// B1c-3 (the final review's carried minor): a non-Checked Token / Token-2022 transfer, approve or burn carries no
// decimals of its own; the simulation names the mint's when the source account's pre-state is a token account of the
// instruction's own program — #48 then shows the amount with them, else in base units as before.
describe('simulateTransactions: the decimals of a non-Checked amount (B1c-3)', () => {
  const NOC = MAINNET_NOC_MINT;
  const DELEGATE = keyOf(52);
  const plain = (lamports: bigint): SimulatedAccount => ({lamports, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()});
  const t22Ix = (data: number[], keys: string[]) =>
    new TransactionInstruction({programId: new PublicKey(TOKEN_2022_PROGRAM), data: Buffer.from(data), keys: keys.map(k => ({pubkey: new PublicKey(k), isSigner: k === ME.toBase58(), isWritable: k !== ME.toBase58()}))});
  const transferIx = (source = SRC, amount = 5n) => tokenIx([3, ...u64(amount)], [source, TO.toBase58(), ME.toBase58()]);
  const approveIx = (source = SRC) => tokenIx([4, ...u64(5n)], [source, DELEGATE, ME.toBase58()]);
  const burnIx = (mint: string, source = SRC) => tokenIx([8, ...u64(5n)], [source, mint, ME.toBase58()]);
  const checkedIx = (mint: string) => tokenIx([12, ...u64(5n), 9], [SRC, mint, TO.toBase58(), ME.toBase58()]);
  /** The source's pre-state `src`, unchanged by the simulation (so no balance change names its mint: only the amount does). */
  const decimalsScene = (src: AccountData | null, o: {mints?: [string, AccountData | null][]; err?: unknown} = {}) => {
    const accounts = new Map<string, AccountData | null>([[SRC, src], ...(o.mints ?? [])]);
    return scene({accounts, post: a => (a === ME.toBase58() ? plain(SOL - 5_000n) : (accounts.get(a) ?? null)), err: o.err});
  };

  it('a transfer, an approve and a burn from a token account the pre-state reads: the mint’s decimals, per instruction; a Checked one carries its own', async () => {
    const sim = await run(decimalsScene(tokenAfter(NOC, 1_000n)), [wire([transferIx(), approveIx(), burnIx(NOC), checkedIx(NOC)])]);
    expect(sim.amountDecimals).toEqual([
      [
        {at: 0, decimals: 9},
        {at: 1, decimals: 9},
        {at: 2, decimals: 9},
      ],
    ]);
    // Someone else's token account (a delegate's transfer) names its mint as well: the decimals are the mint's, not the owner's.
    const theirs = await run(decimalsScene(tokenAfter(NOC, 1_000n, TO.toBase58())), [wire([transferIx()])]);
    expect(theirs.amountDecimals).toEqual([[{at: 0, decimals: 9}]]);
  });

  it('a mint the wallet does not know: its decimals from the one mint read; unreadable, or above 18, none (base units)', async () => {
    const odd = (decimals: number | null) => decimalsScene(tokenAfter(ODD_MINT, 1_000n), {mints: [[ODD_MINT, decimals === null ? null : {lamports: 1n, owner: TOKEN_PROGRAM, data: mintBytes({decimals})}]]});
    const s = odd(4);
    expect((await run(s, [wire([transferIx()])])).amountDecimals).toEqual([[{at: 0, decimals: 4}]]);
    expect(s.reads.at(-1)).toEqual([ODD_MINT]);
    expect((await run(odd(null), [wire([transferIx()])])).amountDecimals).toEqual([[]]);
    expect((await run(odd(19), [wire([transferIx()])])).amountDecimals).toEqual([[]]);
    expect((await run(odd(18), [wire([transferIx()])])).amountDecimals).toEqual([[{at: 0, decimals: 18}]]);
  });

  it('none when the pre-state does not name the mint: absent, not a token account, another token program’s account, a burn of another mint', async () => {
    const none = async (src: AccountData | null, ix: TransactionInstruction = transferIx()) => (await run(decimalsScene(src), [wire([ix])])).amountDecimals;
    expect(await none(null)).toEqual([[]]);
    expect(await none(plain(SOL))).toEqual([[]]);
    expect(await none(t22After(NOC, 1_000n))).toEqual([[]]);
    expect(await none(tokenAfter(NOC, 1_000n), burnIx(MAINNET_USDC_MINT))).toEqual([[]]);
    // Positive controls: the Token-2022 account under Token-2022's own instruction; the burn of its own mint.
    expect(await none(t22After(NOC, 1_000n), t22Ix([3, ...u64(5n)], [SRC, TO.toBase58(), ME.toBase58()]))).toEqual([[{at: 0, decimals: 9}]]);
    expect(await none(tokenAfter(NOC, 1_000n), burnIx(NOC))).toEqual([[{at: 0, decimals: 9}]]);
  });

  it('a transaction that failed keeps them (its instructions are still shown); one list per transaction', async () => {
    const failed = await run(decimalsScene(tokenAfter(NOC, 1_000n), {err: {InstructionError: [0, 'InsufficientFunds']}}), [wire([transferIx()]), wire([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1})])]);
    expect(failed.amountDecimals).toEqual([[{at: 0, decimals: 9}], []]);
  });

  it('simStateOf: read back strictly — any other shape makes the stored simulation invalid', async () => {
    const sim = await run(decimalsScene(tokenAfter(NOC, 1_000n)), [wire([transferIx()])]);
    const stored = JSON.parse(JSON.stringify({status: 'ok', sim})) as {status: string; sim: Record<string, unknown>};
    expect(simStateOf(stored)).toEqual({status: 'ok', sim});
    const edits: [string, (s: Record<string, unknown>) => void][] = [
      ['missing', s => delete s.amountDecimals],
      ['a list per transaction missing', s => (s.amountDecimals = [])],
      ['above 18', s => (s.amountDecimals = [[{at: 0, decimals: 19}]])],
      ['a negative index', s => (s.amountDecimals = [[{at: -1, decimals: 9}]])],
      ['a key more', s => (s.amountDecimals = [[{at: 0, decimals: 9, mint: NOC}]])],
      ['not a number', s => (s.amountDecimals = [[{at: 0, decimals: '9'}]])],
    ];
    for (const [name, edit] of edits) {
      const copy = JSON.parse(JSON.stringify(stored)) as typeof stored;
      edit(copy.sim);
      expect([name, simStateOf(copy)]).toEqual([name, null]);
    }
  });
});
