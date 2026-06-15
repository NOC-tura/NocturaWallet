import {Keypair, VersionedTransaction} from '@solana/web3.js';
import {getConnection} from '../solana/connection';
import {KeychainManager} from '../keychain/keychainModule';
import {mnemonicToSeed} from '../keyDerivation/mnemonicUtils';
import {deriveTransparentKeypair, type TransparentScheme} from '../keyDerivation/transparent';
import {zeroize} from '../session/zeroize';
import {getSwapTransaction} from './jupiter';

const keychainManager = new KeychainManager();

/**
 * Sign a Jupiter-built swap transaction with the transparent keypair and
 * broadcast it. Mirrors submitTransparentTransfer: the 64-byte secret key is
 * zeroized in finally so it never outlives the broadcast.
 */
export async function submitSwap(params: {
  quoteRaw: unknown;
  scheme: TransparentScheme;
}): Promise<{signature: string; lastValidBlockHeight: number}> {
  const mnemonic = await keychainManager.retrieveSeed();
  const seed = await mnemonicToSeed(mnemonic);
  const {secretKey} = deriveTransparentKeypair(seed, params.scheme);
  zeroize(seed);
  try {
    const signer = Keypair.fromSecretKey(secretKey);
    const {swapTransaction, lastValidBlockHeight} = await getSwapTransaction(
      params.quoteRaw,
      signer.publicKey.toBase58(),
    );
    const tx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, 'base64'));
    tx.sign([signer]);
    const connection = getConnection();
    const raw = tx.serialize();
    // Broadcast with a small retry: Helius can return a transient 504 / JSON-RPC
    // -32504 "request timed out" on the larger Jupiter swap tx. Resending the
    // SAME signed transaction is idempotent (the network dedups by signature),
    // so retrying a transient send timeout is safe.
    let signature: string | null = null;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        signature = await connection.sendRawTransaction(raw, {
          skipPreflight: true,
          maxRetries: 2,
        });
        break;
      } catch (e) {
        lastErr = e;
        await new Promise(r => setTimeout(r, 800));
      }
    }
    if (signature === null) {
      throw lastErr instanceof Error ? lastErr : new Error('Failed to broadcast swap');
    }
    return {signature, lastValidBlockHeight};
  } finally {
    zeroize(secretKey);
  }
}
