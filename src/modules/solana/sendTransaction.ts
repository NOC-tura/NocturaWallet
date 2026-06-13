import {Keypair, PublicKey, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
import {getConnection} from './connection';
import {signAndSend} from './signAndSend';
import {
  buildTransferInstructions,
  buildSPLTransferInstructions,
} from './transactionBuilder';
import type {SignAndSendResult} from './types';
import {KeychainManager} from '../keychain/keychainModule';
import {mnemonicToSeed} from '../keyDerivation/mnemonicUtils';
import {
  deriveTransparentKeypair,
  type TransparentScheme,
} from '../keyDerivation/transparent';
import {zeroize} from '../session/zeroize';

export type SendTransparentParams =
  | {
      kind: 'sol';
      recipient: PublicKey;
      lamports: bigint;
      priorityFee: number;
      scheme: TransparentScheme;
    }
  | {
      kind: 'spl';
      recipient: PublicKey;
      mint: PublicKey;
      amount: bigint;
      decimals: number;
      createAta: boolean;
      priorityFee: number;
      scheme: TransparentScheme;
    };

const keychainManager = new KeychainManager();

/**
 * Retrieve the seed (biometric / passcode gated), derive the signer with the
 * given scheme, build the transfer instructions, and broadcast via signAndSend.
 *
 * The 64-byte secret key is zeroized in a finally block so it never outlives
 * the broadcast.
 */
export async function sendTransparentTransfer(
  params: SendTransparentParams,
): Promise<SignAndSendResult> {
  const mnemonic = await keychainManager.retrieveSeed();
  const seed = await mnemonicToSeed(mnemonic);
  const {secretKey} = deriveTransparentKeypair(seed, params.scheme);
  zeroize(seed);
  try {
    const signer = Keypair.fromSecretKey(secretKey);
    const sender = signer.publicKey;
    const priorityFee = params.priorityFee > 0 ? params.priorityFee : undefined;

    const instructions =
      params.kind === 'sol'
        ? buildTransferInstructions({
            sender,
            recipient: params.recipient,
            lamports: params.lamports,
            priorityFee,
          })
        : buildSPLTransferInstructions({
            sender,
            recipient: params.recipient,
            mint: params.mint,
            amount: params.amount,
            decimals: params.decimals,
            createAta: params.createAta,
            priorityFee,
          });

    return await signAndSend(
      getConnection(),
      {payer: sender, instructions},
      [signer],
    );
  } finally {
    zeroize(secretKey);
  }
}

/**
 * Retrieve the seed (biometric / passcode gated), derive the signer with the
 * given scheme, build the transfer instructions, sign, and broadcast via sendRawTransaction.
 *
 * Returns the signature without waiting for confirmation. The 64-byte secret key
 * is zeroized in a finally block so it never outlives the broadcast.
 */
export async function submitTransparentTransfer(
  params: SendTransparentParams,
): Promise<{signature: string}> {
  const mnemonic = await keychainManager.retrieveSeed();
  const seed = await mnemonicToSeed(mnemonic);
  const {secretKey} = deriveTransparentKeypair(seed, params.scheme);
  zeroize(seed);
  try {
    const signer = Keypair.fromSecretKey(secretKey);
    const sender = signer.publicKey;
    const priorityFee = params.priorityFee > 0 ? params.priorityFee : undefined;
    const instructions =
      params.kind === 'sol'
        ? buildTransferInstructions({
            sender,
            recipient: params.recipient,
            lamports: params.lamports,
            priorityFee,
          })
        : buildSPLTransferInstructions({
            sender,
            recipient: params.recipient,
            mint: params.mint,
            amount: params.amount,
            decimals: params.decimals,
            createAta: params.createAta,
            priorityFee,
          });

    const connection = getConnection();
    const {blockhash} = await connection.getLatestBlockhash();
    const message = new TransactionMessage({
      payerKey: sender,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    tx.sign([signer]);
    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true,
      maxRetries: 0,
    });
    return {signature};
  } finally {
    zeroize(secretKey);
  }
}
