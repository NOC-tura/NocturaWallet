import {PublicKey, type Keypair} from '@solana/web3.js';
import {getConnection} from '../solana/connection';
import {proveShielded} from '../zkProver/zkProverModule';
import {syncLeaves} from './merkleSync';
import {buildWithdrawWitness} from './withdrawWitness';
import {buildWithdrawIx, buildWithdrawWithChangeIx} from './poolInstructions';
import {submitPoolTxMany} from './poolTx';
import {poolPda, merkleTreePda, vaultAta, nullifierPda, wchangeVkPda} from './poolPdas';
import {
  findAssociatedTokenAddress,
  buildCreateAtaIdempotentInstruction,
} from '../solana/transactionBuilder';
import {markSpentByIndex, addNote} from './noteStore';
import {mmkvSecure, initSecureMmkv} from '../../store/mmkv/instances';
import {deriveSecureStorageKey} from '../keychain/secureStorageKey';
import {hexToBytes, bytesToHex, decToHex64} from './fieldCodec';
import {SHIELDED_CU} from '../../constants/programs';
import type {ShieldedNote} from './types';
import {buildWithdrawChangeWitness} from './withdrawChangeWitness';
import {randomFieldElement} from './noteCrypto';
import {parseDepositEvents} from './depositEvents';

const PROOF_BYTES_LEN = 256;

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

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

  // Verify the confirmed tx did not revert BEFORE marking the note spent.
  // getTransaction can transiently return null right after confirmation if the
  // serving RPC node lags (Helius round-robin), so poll a few times and FAIL
  // CLOSED if it never resolves — a null result must never be read as success
  // (that could hide a note whose withdraw actually reverted).
  const connection = getConnection();
  let tx = null;
  for (let attempt = 0; attempt < 5 && tx === null; attempt++) {
    tx = await connection.getTransaction(txSignature, {
      maxSupportedTransactionVersion: 0, commitment: 'confirmed',
    });
    if (tx === null && attempt < 4) await sleep(1000);
  }
  if (tx === null) {
    throw new Error(
      `Withdraw ${txSignature} confirmed but could not be fetched to verify — leaving the note unspent; retry to resync`,
    );
  }
  if (tx.meta?.err) {
    throw new Error(`Withdraw transaction reverted on-chain: ${JSON.stringify(tx.meta.err)}`);
  }

  markSpentByIndex(mintBase58, note.index);
  return {txSignature, amount: note.amount};
}

export interface UnshieldWithChangeResult {txSignature: string; withdrawn: bigint; change: bigint;}

/**
 * Partial unshield (change-output): withdraw `withdrawAmount` from `note`, and
 * reinsert the remainder as a self-change note stored locally. Routes ALL
 * unshields (whole-note = changeAmount 0). Marks the input note spent and stores
 * the change note ONLY after a confirmed, non-reverted tx.
 */
export async function unshieldWithChange(
  seed: Uint8Array,
  feePayer: Keypair,
  mintBase58: string,
  note: ShieldedNote,
  withdrawAmount: bigint,
  onStep?: (label: string, detail?: string) => void,
): Promise<UnshieldWithChangeResult> {
  ensureSecureMmkv(seed);
  const mint = new PublicKey(mintBase58);
  const destTokenAccount = findAssociatedTokenAddress(feePayer.publicKey, mint);

  onStep?.('1/5 syncing tree…');
  const {leaves, onChainRoots} = await syncLeaves(mintBase58);
  const changeNoteSecret = randomFieldElement();

  onStep?.('2/5 building witness…');
  const w = buildWithdrawChangeWitness({
    seed, note, withdrawAmount, changeNoteSecret, destTokenAccount, leaves,
  });

  if (!onChainRoots.includes(bytesToHex(w.merkleRoot32))) {
    throw new MerkleRootStaleError();
  }

  // Hand the exact /zk/prove request body up so the UI can copy it to the
  // clipboard (relay to the prover team) — and mark that we've reached the POST.
  onStep?.('3/5 proving…', JSON.stringify({proofType: 'withdraw_change', params: w.params}));
  const proof = await proveShielded('withdraw_change', w.params);
  if (proof.publicInputs[5] !== w.changeCommitmentDec) {
    throw new Error('Prover changeCommitment mismatch — aborting unshield');
  }
  const proofBytes = hexToBytes(proof.proofBytes);
  if (proofBytes.length !== PROOF_BYTES_LEN) {
    throw new Error(`proofBytes must be ${PROOF_BYTES_LEN} bytes`);
  }

  const pool = poolPda(mint);
  const withdrawIx = buildWithdrawWithChangeIx({
    merkleRoot: w.merkleRoot32,
    nullifier: w.nullifier32,
    amount: withdrawAmount,
    changeCommitment: w.changeCommitment32,
    proofBytes,
    pool,
    merkleTree: merkleTreePda(pool),
    vault: vaultAta(pool, mint),
    destinationTokenAccount: destTokenAccount,
    nullifierRecord: nullifierPda(w.nullifier32),
    feePayer: feePayer.publicKey,
    wchangeVk: wchangeVkPda(pool),
  });
  const createAtaIx = buildCreateAtaIdempotentInstruction(
    feePayer.publicKey, destTokenAccount, feePayer.publicKey, mint,
  );

  onStep?.('4/5 submitting…');
  const txSignature = await submitPoolTxMany(
    [createAtaIx, withdrawIx], SHIELDED_CU.withdrawChange, feePayer,
  );

  onStep?.('5/5 confirming…');
  const connection = getConnection();
  let tx = null;
  for (let attempt = 0; attempt < 5 && tx === null; attempt++) {
    tx = await connection.getTransaction(txSignature, {
      maxSupportedTransactionVersion: 0, commitment: 'confirmed',
    });
    if (tx === null && attempt < 4) await sleep(1000);
  }
  if (tx === null) {
    throw new Error(`Withdraw ${txSignature} confirmed but could not be fetched to verify — leaving the note unspent; retry to resync`);
  }
  if (tx.meta?.err) {
    throw new Error(`withdraw_with_change reverted on-chain: ${JSON.stringify(tx.meta.err)}`);
  }

  // Store the change note (with its secret) BEFORE marking the input spent, so a
  // leaf-index lookup failure leaves the input recoverable (unspent) rather than
  // losing the change forever (changeNoteSecret is random and only in memory).
  if (w.changeAmount > 0n) {
    let changeLeafIndex: number | undefined;
    // Fast path: the LeafInserted event in this tx.
    const events = parseDepositEvents(tx.meta?.logMessages ?? []);
    if (events.length > 0) {
      changeLeafIndex = events[0]!.leafIndex;
    } else {
      // Fallback (RPC returned no logs): the change commitment is on-chain now —
      // re-sync and locate it among the leaves (deterministic; random secret ⇒ unique).
      const {leaves: freshLeaves} = await syncLeaves(mintBase58);
      const found = freshLeaves.indexOf(decToHex64(w.changeCommitmentDec));
      if (found >= 0) changeLeafIndex = found;
    }
    if (changeLeafIndex === undefined) {
      throw new Error(
        'Could not locate the change note leaf index — input left unspent; resync and retry',
      );
    }
    addNote({
      commitment: w.changeCommitmentDec,
      nullifier: '',
      mint: mintBase58,
      amount: w.changeAmount,
      index: changeLeafIndex,
      spent: false,
      createdAt: Date.now(),
      noteSecret: changeNoteSecret.toString(),
    });
  }

  markSpentByIndex(mintBase58, note.index);

  return {txSignature, withdrawn: withdrawAmount, change: w.changeAmount};
}
