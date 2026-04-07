import {
  PublicKey,
  SystemProgram,
  ComputeBudgetProgram,
  TransactionMessage,
  TransactionInstruction,
  VersionedTransaction,
} from '@solana/web3.js';
import {getConnection} from './connection';
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
function findAssociatedTokenAddress(
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

export async function buildTransferTx(
  params: TransferParams,
): Promise<VersionedTransaction> {
  const {sender, recipient, lamports, priorityFee} = params;
  const connection = getConnection();
  const {blockhash} = await connection.getLatestBlockhash();

  const instructions = [];

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

  const message = new TransactionMessage({
    payerKey: sender,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  return new VersionedTransaction(message);
}

export async function buildSPLTransferTx(
  params: SPLTransferParams,
): Promise<VersionedTransaction> {
  const {sender, recipient, mint, priorityFee, createAta} = params;
  const connection = getConnection();
  const {blockhash} = await connection.getLatestBlockhash();

  const instructions: TransactionInstruction[] = [];

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

  // TODO: add SPL token transfer instruction (spl-token TransferChecked) once
  // @solana/spl-token is integrated. The source ATA is derived from sender/mint
  // and the destination ATA is recipientAta computed above.

  // Noctura fee markup transfer
  instructions.push(
    SystemProgram.transfer({
      fromPubkey: sender,
      toPubkey: new PublicKey(NOCTURA_FEE_TREASURY),
      lamports: TRANSPARENT_FEES.transferMarkup,
    }),
  );

  const message = new TransactionMessage({
    payerKey: sender,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
