import type {Connection, Signer, VersionedTransaction} from '@solana/web3.js';
import type {SignAndSendResult} from './types';

const DEFAULT_MAX_RETRIES = 3;

interface SignAndSendOptions {
  maxRetries?: number;
}

/**
 * Sign and send a transaction with blockhash expiry retry.
 * Each retry: NEW blockhash → NEW signature → re-send.
 * Max 3 retries, then throw TX_TIMEOUT (E022).
 */
export async function signAndSend(
  connection: Connection,
  tx: VersionedTransaction,
  signers: Signer[],
  options?: SignAndSendOptions,
): Promise<SignAndSendResult> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash();
      tx.sign(signers);
      const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: true,
        maxRetries: 0,
      });
      await connection.confirmTransaction(
        {signature, blockhash, lastValidBlockHeight},
        'confirmed',
      );
      const status = await connection.getSignatureStatus(signature);
      const confirmationStatus = status.value?.confirmationStatus ?? 'confirmed';
      return {
        signature,
        confirmationStatus: confirmationStatus as SignAndSendResult['confirmationStatus'],
      };
    } catch (error) {
      const isExpiry = error instanceof Error &&
        (error.message.includes('expired') ||
         error.message.includes('Block height exceeded') ||
         error.message.includes('not confirmed'));

      if (isExpiry && attempt < maxRetries) continue;

      const txError = new Error(`Transaction not confirmed after ${attempt + 1} attempts [E022]`);
      txError.name = 'TxTimeoutError';
      throw txError;
    }
  }
  throw new Error('Transaction not confirmed [E022]');
}
