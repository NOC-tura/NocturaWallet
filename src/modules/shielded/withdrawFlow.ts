import {PublicKey, type Keypair} from '@solana/web3.js';
import {getConnection} from '../solana/connection';
import {proveShielded} from '../zkProver/zkProverModule';
import {syncLeaves} from './merkleSync';
import {buildWithdrawWitness} from './withdrawWitness';
import {buildWithdrawIx} from './poolInstructions';
import {submitPoolTxMany} from './poolTx';
import {poolPda, merkleTreePda, vaultAta, nullifierPda} from './poolPdas';
import {
  findAssociatedTokenAddress,
  buildCreateAtaIdempotentInstruction,
} from '../solana/transactionBuilder';
import {markSpentByIndex} from './noteStore';
import {mmkvSecure, initSecureMmkv} from '../../store/mmkv/instances';
import {deriveSecureStorageKey} from '../keychain/secureStorageKey';
import {hexToBytes, bytesToHex} from './fieldCodec';
import {SHIELDED_CU} from '../../constants/programs';
import type {ShieldedNote} from './types';

const PROOF_BYTES_LEN = 256;

export class MerkleRootStaleError extends Error {
  constructor() {
    super('Local Merkle root is not in the on-chain history — resync needed');
    this.name = 'MerkleRootStaleError';
  }
}

function ensureSecureMmkv(seed: Uint8Array): void {
  if (mmkvSecure()) return;
  initSecureMmkv(deriveSecureStorageKey(seed));
}

export interface UnshieldResult {txSignature: string; amount: bigint;}

/**
 * Unshield one whole note back to the user's own transparent ATA (self-relay).
 * Sync leaves (RPC) -> verify our root is in root_history -> prove -> withdraw tx
 * (create-ATA-idempotent + withdraw) -> mark the note spent. The note is marked
 * spent ONLY after a confirmed, non-reverted transaction.
 */
export async function unshield(
  seed: Uint8Array,
  feePayer: Keypair,
  mintBase58: string,
  note: ShieldedNote,
): Promise<UnshieldResult> {
  ensureSecureMmkv(seed);
  const mint = new PublicKey(mintBase58);
  const destTokenAccount = findAssociatedTokenAddress(feePayer.publicKey, mint);

  const {leaves, onChainRoots} = await syncLeaves(mintBase58);

  const {params, nullifier32, merkleRoot32} = buildWithdrawWitness({
    seed, note, destTokenAccount, leaves,
  });

  if (!onChainRoots.includes(bytesToHex(merkleRoot32))) {
    throw new MerkleRootStaleError();
  }

  const proof = await proveShielded('withdraw', params);
  const proofBytes = hexToBytes(proof.proofBytes);
  if (proofBytes.length !== PROOF_BYTES_LEN) {
    throw new Error(`proofBytes must be ${PROOF_BYTES_LEN} bytes`);
  }

  const pool = poolPda(mint);
  const withdrawIx = buildWithdrawIx({
    merkleRoot: merkleRoot32,
    nullifier: nullifier32,
    amount: note.amount,
    proofBytes,
    pool,
    merkleTree: merkleTreePda(pool),
    vault: vaultAta(pool, mint),
    destinationTokenAccount: destTokenAccount,
    nullifierRecord: nullifierPda(nullifier32),
    feePayer: feePayer.publicKey,
  });

  const createAtaIx = buildCreateAtaIdempotentInstruction(
    feePayer.publicKey, destTokenAccount, feePayer.publicKey, mint,
  );

  const txSignature = await submitPoolTxMany(
    [createAtaIx, withdrawIx], SHIELDED_CU.withdraw, feePayer,
  );

  const connection = getConnection();
  const tx = await connection.getTransaction(txSignature, {
    maxSupportedTransactionVersion: 0, commitment: 'confirmed',
  });
  if (tx?.meta?.err) {
    throw new Error(`Withdraw transaction reverted on-chain: ${JSON.stringify(tx.meta.err)}`);
  }

  markSpentByIndex(mintBase58, note.index);
  return {txSignature, amount: note.amount};
}
