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
    // skipPreflight is intentionally FALSE: Helius's skipPreflight=true
    // sendTransaction path is pathologically slow for Jupiter swap txs (it
    // retries internally for ~60s → the request times out with HTTP 504 /
    // JSON-RPC -32504 and the tx never lands). With preflight ON, Helius
    // simulates (sub-second) and forwards quickly, and an invalid swap is
    // rejected with a real error instead of a 504 hang. A small retry covers a
    // genuinely transient send error (resending the same signed tx is
    // idempotent — the network dedups by signature).
    let signature: string | null = null;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        signature = await connection.sendRawTransaction(raw, {
          skipPreflight: false,
          maxRetries: 2,
        });
        break;
      } catch (e) {
        lastErr = e;
        // A deterministic preflight failure (e.g. slippage) won't recover on
        // retry, but a transient network/gateway error can — keep it cheap.
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
