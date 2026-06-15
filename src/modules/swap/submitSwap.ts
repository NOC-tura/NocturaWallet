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
    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true,
      maxRetries: 0,
    });
    return {signature, lastValidBlockHeight};
  } finally {
    zeroize(secretKey);
  }
}
