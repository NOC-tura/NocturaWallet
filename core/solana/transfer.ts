import {Buffer} from 'buffer';
import {ComputeBudgetProgram, PublicKey, SystemProgram, TransactionInstruction} from '@solana/web3.js';
import {encodeU64LE, findAssociatedTokenAddress} from '../presale/buyInstructions';

/**
 * SOL and SPL transfer building, shared by the app and the extension (spec §4 "Moves into core/").
 * Moved from src/modules/solana/transactionBuilder.ts; what stayed there binds this to the app's fee
 * store and its stateful RPC client. Everything here is pure: the markup, the source token account
 * and the priority fee are explicit inputs.
 *
 * `Buffer` is imported, not assumed global (a Vite bundle has none), and every u64 is encoded by
 * hand: buffer@5.7.1, which the app ships on Hermes, has no writeBigUInt64LE.
 */
export {findAssociatedTokenAddress};

export const SPL_TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const SPL_ATA_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

/** Solana's base fee per signature (solana.com/docs/core/fees). */
export const BASE_FEE_LAMPORTS_PER_SIGNATURE = 5_000n;

/** An SPL Token account's data length. */
export const TOKEN_ACCOUNT_SIZE = 165;

/**
 * The rent-exempt minimum for a 165-byte token account: (165 + 128 bytes of account overhead) ×
 * 3 480 lamports per byte-year × 2 years = 2 039 280. Fixed, so the cost of creating the
 * recipient's token account can be shown before signing without the rent-exemption RPC method,
 * which the coordinator proxy refuses (spec §4).
 */
export const TOKEN_ACCOUNT_RENT_LAMPORTS = 2_039_280n;

/**
 * The rent-exempt minimum for a plain (0-byte) system account: (0 + 128) × 3 480 × 2 = 890 880.
 * A SOL balance may be 0 or at least this — the runtime refuses a transfer that leaves an account
 * (or creates one) in between. The send engine refuses such a send before simulating, and B1b-2's
 * MAX math uses it.
 */
export const SYSTEM_ACCOUNT_RENT_LAMPORTS = 890_880n;

const MAX_U64 = 18_446_744_073_709_551_615n;

/** The Noctura fee as its own transfer. Null, or zero lamports, means no instruction at all. */
export interface Markup {
  lamports: bigint;
  treasury: PublicKey;
}

/**
 * Compute-unit limit for a transfer — the single source: the send path and the simulation must
 * request the same budget, or the simulation is of a different transaction.
 */
export function computeUnitLimitFor(params: {kind: 'sol'} | {kind: 'spl'; createAta?: boolean}): number {
  if (params.kind === 'sol') return 1_000;
  return params.createAta ? 65_000 : 40_000;
}

/** ceil(price µlamports/CU × limit / 1 000 000) lamports, in BigInt. */
export function priorityFeeLamports(microLamportsPerCu: number, computeUnitLimit: number): bigint {
  for (const v of [microLamportsPerCu, computeUnitLimit]) {
    if (!Number.isSafeInteger(v) || v < 0) throw new RangeError(`priority fee inputs must be non-negative integers: ${v}`);
  }
  return (BigInt(microLamportsPerCu) * BigInt(computeUnitLimit) + 999_999n) / 1_000_000n;
}

/** The network fee a transaction pays: 5 000 lamports per signature plus its priority fee. */
export function networkFeeLamports(signatures: number, microLamportsPerCu: number, computeUnitLimit: number): bigint {
  if (!Number.isSafeInteger(signatures) || signatures < 1) throw new RangeError(`signatures must be a positive integer: ${signatures}`);
  return BASE_FEE_LAMPORTS_PER_SIGNATURE * BigInt(signatures) + priorityFeeLamports(microLamportsPerCu, computeUnitLimit);
}

/**
 * SPL Token TransferChecked (discriminator 12): [12][amount u64 LE][decimals u8]. Keys: source,
 * mint, destination, owner (signer). Checks amount and decimals on chain against the mint.
 */
export function buildTransferCheckedInstruction(
  source: PublicKey,
  mint: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: bigint,
  decimals: number,
): TransactionInstruction {
  if (amount < 0n || amount > MAX_U64) throw new Error(`TransferChecked: amount out of u64 range: ${amount}`);
  if (decimals < 0 || decimals > 9 || decimals !== Math.floor(decimals)) throw new Error(`TransferChecked: invalid decimals: ${decimals}`);
  const data = Buffer.alloc(10);
  data.writeUInt8(12, 0);
  data.set(encodeU64LE(amount), 1);
  data.writeUInt8(decimals, 9);
  return new TransactionInstruction({
    keys: [
      {pubkey: source, isSigner: false, isWritable: true},
      {pubkey: mint, isSigner: false, isWritable: false},
      {pubkey: destination, isSigner: false, isWritable: true},
      {pubkey: owner, isSigner: true, isWritable: false},
    ],
    programId: SPL_TOKEN_PROGRAM_ID,
    data,
  });
}

function ataKeys(payer: PublicKey, ata: PublicKey, owner: PublicKey, mint: PublicKey) {
  return [
    {pubkey: payer, isSigner: true, isWritable: true},
    {pubkey: ata, isSigner: false, isWritable: true},
    {pubkey: owner, isSigner: false, isWritable: false},
    {pubkey: mint, isSigner: false, isWritable: false},
    {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
    {pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
  ];
}

/** Associated Token Account "Create": no data; fails if the account exists. */
export function buildCreateAtaInstruction(payer: PublicKey, ata: PublicKey, owner: PublicKey, mint: PublicKey): TransactionInstruction {
  return new TransactionInstruction({keys: ataKeys(payer, ata, owner, mint), programId: SPL_ATA_PROGRAM_ID, data: Buffer.alloc(0)});
}

/** Associated Token Account "CreateIdempotent" (data byte 1): a no-op if the account exists. */
export function buildCreateAtaIdempotentInstruction(payer: PublicKey, ata: PublicKey, owner: PublicKey, mint: PublicKey): TransactionInstruction {
  return new TransactionInstruction({keys: ataKeys(payer, ata, owner, mint), programId: SPL_ATA_PROGRAM_ID, data: Buffer.from([1])});
}

function pushBudget(instructions: TransactionInstruction[], computeUnitLimit?: number, priorityFee?: number): void {
  if (computeUnitLimit !== undefined) instructions.push(ComputeBudgetProgram.setComputeUnitLimit({units: computeUnitLimit}));
  if (priorityFee !== undefined) instructions.push(ComputeBudgetProgram.setComputeUnitPrice({microLamports: priorityFee}));
}

/** The markup is appended only when one is actually charged — never an undisclosed zero-value line. */
function pushMarkup(instructions: TransactionInstruction[], sender: PublicKey, markup: Markup | null): void {
  if (markup === null || markup.lamports <= 0n) return;
  instructions.push(SystemProgram.transfer({fromPubkey: sender, toPubkey: markup.treasury, lamports: markup.lamports}));
}

export interface SolTransferInput {
  sender: PublicKey;
  recipient: PublicKey;
  lamports: bigint;
  /** µlamports per compute unit. */
  priorityFee?: number;
  computeUnitLimit?: number;
  markup: Markup | null;
}

export function buildSolTransferInstructions(p: SolTransferInput): TransactionInstruction[] {
  const instructions: TransactionInstruction[] = [];
  pushBudget(instructions, p.computeUnitLimit, p.priorityFee);
  instructions.push(SystemProgram.transfer({fromPubkey: p.sender, toPubkey: p.recipient, lamports: p.lamports}));
  pushMarkup(instructions, p.sender, p.markup);
  return instructions;
}

export interface SplTransferInput {
  sender: PublicKey;
  recipient: PublicKey;
  mint: PublicKey;
  /** Smallest unit. */
  amount: bigint;
  decimals: number;
  priorityFee?: number;
  computeUnitLimit?: number;
  /** Create the recipient's ATA first (its rent is TOKEN_ACCOUNT_RENT_LAMPORTS, paid by the sender). */
  createAta?: boolean;
  /** The sender's account to spend from; the derived ATA when absent. */
  sourceTokenAccount?: PublicKey;
  markup: Markup | null;
}

export function buildSplTransferInstructions(p: SplTransferInput): TransactionInstruction[] {
  const instructions: TransactionInstruction[] = [];
  pushBudget(instructions, p.computeUnitLimit, p.priorityFee);
  const recipientAta = findAssociatedTokenAddress(p.recipient, p.mint);
  if (p.createAta === true) instructions.push(buildCreateAtaInstruction(p.sender, recipientAta, p.recipient, p.mint));
  // A wallet may hold the mint in a NON-canonical account (not its ATA): spend from the account
  // that actually holds it, falling back to the canonical ATA only when none was resolved.
  const source = p.sourceTokenAccount ?? findAssociatedTokenAddress(p.sender, p.mint);
  instructions.push(buildTransferCheckedInstruction(source, p.mint, recipientAta, p.sender, p.amount, p.decimals));
  pushMarkup(instructions, p.sender, p.markup);
  return instructions;
}

export class SplitTokenBalance extends Error {
  constructor(largest: bigint, required: bigint) {
    super(
      'This balance is split across several token accounts. ' +
        `The largest holds ${largest} of the ${required} needed — ` +
        'send a smaller amount, or consolidate the accounts first.',
    );
    this.name = 'SplitTokenBalance';
  }
}

export class InsufficientTokenBalance extends Error {
  constructor(total: bigint, required: bigint) {
    super(`Insufficient token balance: holding ${total}, need ${required}.`);
    this.name = 'InsufficientTokenBalance';
  }
}

/**
 * The account to spend from: the one holding the most of the mint, or null when there is none.
 * TransferChecked spends from ONE account and is all-or-nothing while the displayed balance is the
 * SUM across accounts, so an amount no single account covers is refused here — split across
 * accounts, or simply more than is held — rather than failing on chain with an opaque error.
 */
export function selectSourceTokenAccount<T>(accounts: readonly {pubkey: T; amount: bigint}[], requiredAmount?: bigint): T | null {
  let best: {pubkey: T; amount: bigint} | null = null;
  let total = 0n;
  for (const a of accounts) {
    total += a.amount;
    if (best === null || a.amount > best.amount) best = a;
  }
  if (best === null) return null;
  if (requiredAmount !== undefined && best.amount < requiredAmount) {
    if (total >= requiredAmount) throw new SplitTokenBalance(best.amount, requiredAmount);
    throw new InsufficientTokenBalance(total, requiredAmount);
  }
  return best.pubkey;
}
