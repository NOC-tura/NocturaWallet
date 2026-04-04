import type {Connection, Signer, VersionedTransaction, TransactionInstruction, AddressLookupTableAccount} from '@solana/web3.js';
import {PublicKey, TransactionMessage, VersionedTransaction as VTx} from '@solana/web3.js';
import type {SignAndSendResult} from './types';

const DEFAULT_MAX_RETRIES = 3;

interface SignAndSendOptions {
  maxRetries?: number;
}

/**
 * Parameters for building a fresh transaction on each retry attempt.
 * signAndSend needs to rebuild the transaction with a new blockhash on each retry,
 * because blockhash is part of the signed message — you cannot re-sign with a new
 * blockhash without rebuilding the message.
 */
export interface TransactionSpec {
  payer: PublicKey;
  instructions: TransactionInstruction[];
  addressLookupTableAccounts?: AddressLookupTableAccount[];
}

/**
 * Build a fresh VersionedTransaction with the given blockhash.
 */
function buildTx(spec: TransactionSpec, blockhash: string): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: spec.payer,
    recentBlockhash: blockhash,
    instructions: spec.instructions as TransactionInstruction[],
  }).compileToV0Message(spec.addressLookupTableAccounts);

  return new VTx(message);
}

/**
 * Sign and send a transaction with blockhash expiry retry.
 *
 * Strategy (from spec):
 *   1. getLatestBlockhash → build tx → sign → send
 *   2. Poll confirmTransaction with lastValidBlockHeight
 *   3. If expired → NEW blockhash → NEW tx → NEW signature → re-send
 *   4. Max 3 retries, then throw TX_TIMEOUT (E022)
 *
 * ⚠️ Each retry requires a NEW blockhash + NEW signature.
 *    The transaction is REBUILT from the original instructions each time.
 */
export async function signAndSend(
  connection: Connection,
  spec: TransactionSpec,
  signers: Signer[],
  options?: SignAndSendOptions,
): Promise<SignAndSendResult> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 1. Fresh blockhash for each attempt
      const {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash();

      // 2. Build fresh tx with new blockhash + sign
      const tx = buildTx(spec, blockhash);
      tx.sign(signers);

      // 3. Send
      const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: true, // Already simulated before reaching signAndSend
        maxRetries: 0, // We handle retries ourselves
      });

      // 4. Confirm with block height check
      await connection.confirmTransaction(
        {signature, blockhash, lastValidBlockHeight},
        'confirmed',
      );

      // 5. Get final status
      const status = await connection.getSignatureStatus(signature);
      const confirmationStatus = status.value?.confirmationStatus ?? 'confirmed';

      return {
        signature,
        confirmationStatus: confirmationStatus as SignAndSendResult['confirmationStatus'],
      };
    } catch (error) {
      const isExpiry =
        error instanceof Error &&
        (error.message.includes('expired') ||
          error.message.includes('Block height exceeded') ||
          error.message.includes('not confirmed'));

      if (isExpiry && attempt < maxRetries) {
        // Retry with new blockhash — loop continues
        continue;
      }

      const txError = new Error(
        `Transaction not confirmed after ${attempt + 1} attempts [E022]`,
      );
      txError.name = 'TxTimeoutError';
      throw txError;
    }
  }

  throw new Error('Transaction not confirmed [E022]');
}
