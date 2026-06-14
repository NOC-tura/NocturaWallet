import {
  PublicKey,
  SystemProgram,
  ComputeBudgetProgram,
  TransactionMessage,
  TransactionInstruction,
  VersionedTransaction,
} from '@solana/web3.js';
import type {Connection} from '@solana/web3.js';
import {getConnection} from './connection';
import {getAccountInfo} from './queries';
import {NOCTURA_FEE_TREASURY, TRANSPARENT_FEES} from '../../constants/programs';
import type {TransferParams, SPLTransferParams} from './types';

// SPL Token program ID
const SPL_TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
);
// SPL Associated Token Account program ID
const SPL_ATA_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bRS',
);

/**
 * Derive the Associated Token Account (ATA) address for a given wallet and mint.
 *
 * Uses the canonical deterministic derivation:
 *   PDA seeds: [walletAddress, TOKEN_PROGRAM_ID, mintAddress]
 *   Program:   SPL_ATA_PROGRAM_ID
 *
 * This mirrors @solana/spl-token's getAssociatedTokenAddress().
 */
export function findAssociatedTokenAddress(
  walletAddress: PublicKey,
  mintAddress: PublicKey,
): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [
      walletAddress.toBuffer(),
      SPL_TOKEN_PROGRAM_ID.toBuffer(),
      mintAddress.toBuffer(),
    ],
    SPL_ATA_PROGRAM_ID,
  );
  return ata;
}

/**
 * Resolve whether a recipient needs their Associated Token Account created for
 * `mint`. Returns true ONLY when the ATA does not yet exist on-chain — sending
 * to a recipient who already holds the token must NOT prepend a create-ATA
 * instruction (it fails with "account already in use"). Falls through to the
 * caller's optimistic default only on RPC error (handled by the caller).
 */
export async function resolveCreateAta(
  connection: Connection,
  recipient: PublicKey,
  mint: PublicKey,
): Promise<boolean> {
  const ata = findAssociatedTokenAddress(recipient, mint);
  const info = await getAccountInfo(connection, ata);
  return !info.exists;
}

/**
 * Resolve the sender's source token account for `mint`. A wallet may hold a
 * token in a NON-canonical token account (not its ATA) — using the derived ATA
 * as the transfer source then fails on-chain with AccountNotFound. Returns the
 * owned account with the largest balance for the mint, or null when the owner
 * holds no account for it.
 */
export async function resolveSourceTokenAccount(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
): Promise<PublicKey | null> {
  const response = await connection.getParsedTokenAccountsByOwner(owner, {mint});
  let best: {pubkey: PublicKey; amount: bigint} | null = null;
  for (const {pubkey, account} of response.value) {
    const parsed = account.data.parsed as {
      info?: {tokenAmount?: {amount?: string}};
    };
    const amount = BigInt(parsed.info?.tokenAmount?.amount ?? '0');
    if (best === null || amount > best.amount) {
      best = {pubkey, amount};
    }
  }
  return best === null ? null : best.pubkey;
}

/**
 * Build an SPL Token TransferChecked instruction manually.
 * Mirrors @solana/spl-token's createTransferCheckedInstruction().
 *
 * Instruction data layout (10 bytes):
 *   [12]              — instruction discriminator (TransferChecked = 12)
 *   [amount: u64 LE]  — 8 bytes, little-endian unsigned 64-bit
 *   [decimals: u8]    — 1 byte
 */
function buildTransferCheckedInstruction(
  source: PublicKey,
  mint: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: bigint,
  decimals: number,
): TransactionInstruction {
  const MAX_U64 = 18_446_744_073_709_551_615n;
  if (amount < 0n || amount > MAX_U64) {
    throw new Error(`TransferChecked: amount out of u64 range: ${amount}`);
  }
  if (decimals < 0 || decimals > 9 || decimals !== Math.floor(decimals)) {
    throw new Error(`TransferChecked: invalid decimals: ${decimals}`);
  }

  const data = Buffer.alloc(10);
  data.writeUInt8(12, 0); // TransferChecked discriminator
  // Encode the u64 amount as little-endian. We do NOT use Buffer.writeBigUInt64LE:
  // the Hermes Buffer polyfill (buffer@5.7.1) does not implement the BigInt
  // accessors, so calling it throws "undefined is not a function" on-device.
  // writeUInt8 + BigInt shifts are available in Hermes.
  let remaining = amount;
  for (let i = 0; i < 8; i++) {
    data.writeUInt8(Number(remaining & 0xffn), 1 + i);
    remaining >>= 8n;
  }
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

/**
 * Build a createAssociatedTokenAccount instruction.
 *
 * This mirrors @solana/spl-token's createAssociatedTokenAccountInstruction().
 * The instruction layout is:
 *   - payer       (writable, signer)
 *   - ata         (writable)
 *   - owner
 *   - mint
 *   - system program
 *   - token program
 *
 * The instruction has no data payload (the ATA program infers all from accounts).
 */
function buildCreateAtaInstruction(
  payer: PublicKey,
  ata: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      {pubkey: payer, isSigner: true, isWritable: true},
      {pubkey: ata, isSigner: false, isWritable: true},
      {pubkey: owner, isSigner: false, isWritable: false},
      {pubkey: mint, isSigner: false, isWritable: false},
      {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
      {pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
    ],
    programId: SPL_ATA_PROGRAM_ID,
    data: Buffer.alloc(0),
  });
}

/**
 * Build the instruction list for a native SOL transfer: optional priority fee,
 * the recipient transfer, and the Noctura fee-markup transfer. Exposed so
 * signAndSend can rebuild the transaction with a fresh blockhash per retry.
 */
export function buildTransferInstructions(
  params: TransferParams,
): TransactionInstruction[] {
  const {sender, recipient, lamports, priorityFee, computeUnitLimit} = params;
  const instructions: TransactionInstruction[] = [];

  if (computeUnitLimit !== undefined) {
    instructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({units: computeUnitLimit}),
    );
  }

  if (priorityFee !== undefined) {
    instructions.push(
      ComputeBudgetProgram.setComputeUnitPrice({microLamports: priorityFee}),
    );
  }

  instructions.push(
    SystemProgram.transfer({
      fromPubkey: sender,
      toPubkey: recipient,
      lamports,
    }),
  );

  instructions.push(
    SystemProgram.transfer({
      fromPubkey: sender,
      toPubkey: new PublicKey(NOCTURA_FEE_TREASURY),
      lamports: TRANSPARENT_FEES.transferMarkup,
    }),
  );

  return instructions;
}

export async function buildTransferTx(
  params: TransferParams,
): Promise<VersionedTransaction> {
  const connection = getConnection();
  const {blockhash} = await connection.getLatestBlockhash();

  const message = new TransactionMessage({
    payerKey: params.sender,
    recentBlockhash: blockhash,
    instructions: buildTransferInstructions(params),
  }).compileToV0Message();

  return new VersionedTransaction(message);
}

/**
 * Build the instruction list for an SPL token transfer: optional priority fee,
 * optional recipient ATA creation, the TransferChecked, and the Noctura
 * fee-markup transfer. Exposed so signAndSend can rebuild per retry.
 */
export function buildSPLTransferInstructions(
  params: SPLTransferParams,
): TransactionInstruction[] {
  const {sender, recipient, mint, amount, decimals, priorityFee, computeUnitLimit, createAta, sourceTokenAccount} = params;

  const instructions: TransactionInstruction[] = [];

  if (computeUnitLimit !== undefined) {
    instructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({units: computeUnitLimit}),
    );
  }

  if (priorityFee !== undefined) {
    instructions.push(
      ComputeBudgetProgram.setComputeUnitPrice({microLamports: priorityFee}),
    );
  }

  // Derive the recipient's Associated Token Account for the given mint.
  // Following the @solana/spl-token pattern: getAssociatedTokenAddress() +
  // createAssociatedTokenAccountInstruction() when the ATA does not exist.
  const recipientAta = findAssociatedTokenAddress(recipient, mint);

  if (createAta === true) {
    // Prepend ATA creation instruction so the recipient can receive the token.
    // In production, check whether the ATA already exists (getAccountInfo) and
    // only prepend this instruction when it is absent to avoid wasting fees.
    instructions.push(
      buildCreateAtaInstruction(sender, recipientAta, recipient, mint),
    );
  }

  // Source account to spend from. Prefer an explicitly resolved account (the
  // wallet may hold the mint in a non-canonical account that is NOT its ATA),
  // falling back to the canonical ATA when none was provided.
  const senderAta = sourceTokenAccount ?? findAssociatedTokenAddress(sender, mint);

  // SPL Token TransferChecked instruction — verifies both amount and decimals
  // on-chain to guard against mint substitution attacks.
  instructions.push(
    buildTransferCheckedInstruction(
      senderAta,
      mint,
      recipientAta,
      sender,
      amount,
      decimals,
    ),
  );

  // Noctura fee markup transfer
  instructions.push(
    SystemProgram.transfer({
      fromPubkey: sender,
      toPubkey: new PublicKey(NOCTURA_FEE_TREASURY),
      lamports: TRANSPARENT_FEES.transferMarkup,
    }),
  );

  return instructions;
}

export async function buildSPLTransferTx(
  params: SPLTransferParams,
): Promise<VersionedTransaction> {
  const connection = getConnection();
  const {blockhash} = await connection.getLatestBlockhash();

  const message = new TransactionMessage({
    payerKey: params.sender,
    recentBlockhash: blockhash,
    instructions: buildSPLTransferInstructions(params),
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
