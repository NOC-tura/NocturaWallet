import {
  PublicKey,
  SystemProgram,
  ComputeBudgetProgram,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import {getConnection} from './connection';
import {NOCTURA_FEE_TREASURY, TRANSPARENT_FEES} from '../../constants/programs';
import type {TransferParams, SPLTransferParams} from './types';

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
  const {sender, priorityFee} = params;
  const connection = getConnection();
  const {blockhash} = await connection.getLatestBlockhash();

  const instructions = [];

  if (priorityFee !== undefined) {
    instructions.push(
      ComputeBudgetProgram.setComputeUnitPrice({microLamports: priorityFee}),
    );
  }

  // SPL token transfer instructions are stubbed pending @solana/spl-token
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
