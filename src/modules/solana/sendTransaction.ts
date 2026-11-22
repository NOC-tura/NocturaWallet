import {Keypair, PublicKey, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
import {base58} from '@scure/base';
import {getConnection} from './connection';
import {
  buildTransferInstructions,
  buildSPLTransferInstructions,
  resolveSourceTokenAccount,
  computeUnitLimitFor,
} from './transactionBuilder';
import {KeychainManager} from '../keychain/keychainModule';
import {mnemonicToSeed} from '../keyDerivation/mnemonicUtils';
import {
  deriveTransparentKeypair,
  type TransparentScheme,
} from '../keyDerivation/transparent';
import {sendSignerMismatchError} from '../../copy/accounts';
import {zeroize} from '../session/zeroize';

export type SendTransparentParams =
  | {
      kind: 'sol';
      recipient: PublicKey;
      lamports: bigint;
      priorityFee: number;
      scheme: TransparentScheme;
      /** M1d (spec §3.3): the account's address — the key derived from `scheme` must be it, or nothing is signed */
      expectedSigner: string;
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
      /** M1d (spec §3.3): the account's address — the key derived from `scheme` must be it, or nothing is signed */
      expectedSigner: string;
    };

const keychainManager = new KeychainManager();

/** M1d (spec §3.3, plan A16): the derived key is not the account's — refused before any key object, build or signature. */
export class SendSignerMismatchError extends Error {
  readonly code = 'E_SEND_SIGNER_MISMATCH' as const;
  constructor(expected: string) {
    super(sendSignerMismatchError(expected));
    this.name = 'SendSignerMismatchError';
  }
}

/**
 * Retrieve the seed (biometric / passcode gated), derive the signer with the given scheme, refuse unless it is `expectedSigner` (M1d), build the transfer instructions, sign, and broadcast via sendRawTransaction.
 *
 * Returns the signature without waiting for confirmation. The 64-byte secret key
 * is zeroized in a finally block so it never outlives the broadcast.
 */
export async function submitTransparentTransfer(
  params: SendTransparentParams,
): Promise<{signature: string; lastValidBlockHeight: number}> {
  const mnemonic = await keychainManager.retrieveSeed();
  const seed = await mnemonicToSeed(mnemonic);
  let secretKey: Uint8Array | null = null;
  try {
    // review r1 m8: derived inside the try, so a throwing derivation still zero-fills the seed below
    const derived = deriveTransparentKeypair(seed, params.scheme);
    secretKey = derived.secretKey;
    zeroize(seed);
    // M1d (spec §3.3): the key must derive the account's own address before anything is built or signed
    if (base58.encode(derived.publicKey) !== params.expectedSigner) {
      throw new SendSignerMismatchError(params.expectedSigner);
    }
    const signer = Keypair.fromSecretKey(derived.secretKey);
    const sender = signer.publicKey;
    const priorityFee = params.priorityFee > 0 ? params.priorityFee : undefined;
    // SOL transfer = 2 SystemProgram.transfer (recipient + Noctura fee markup)
    // + 2 ComputeBudget ix ≈ 600 CU; 450 was too tight (ComputationalBudgetExceeded
    // observed on-chain). 1_000 gives margin while keeping the priority fee tiny.
    const computeUnitLimit =
      params.kind === 'sol'
        ? computeUnitLimitFor({kind: 'sol'})
        : computeUnitLimitFor({kind: 'spl', createAta: params.createAta});

    const connection = getConnection();

    // The wallet may hold the mint in a non-canonical token account (not its
    // ATA). Resolve the real source so the transfer spends from the account that
    // actually holds the balance — otherwise the canonical ATA is referenced and
    // the transaction fails on-chain with AccountNotFound.
    const sourceTokenAccount =
      params.kind === 'spl'
        ? (await resolveSourceTokenAccount(connection, sender, params.mint, params.amount)) ??
          undefined
        : undefined;

    const instructions =
      params.kind === 'sol'
        ? buildTransferInstructions({
            sender,
            recipient: params.recipient,
            lamports: params.lamports,
            priorityFee,
            computeUnitLimit,
          })
        : buildSPLTransferInstructions({
            sender,
            recipient: params.recipient,
            mint: params.mint,
            amount: params.amount,
            decimals: params.decimals,
            createAta: params.createAta,
            sourceTokenAccount,
            priorityFee,
            computeUnitLimit,
          });

    const {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash();
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
    return {signature, lastValidBlockHeight};
  } finally {
    zeroize(seed);
    zeroize(secretKey);
  }
}
