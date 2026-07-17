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
import {markSpentByIndex, markSpentByCommitment, setNoteIndex, addNote} from './noteStore';
import {mmkvSecure, initSecureMmkv} from '../../store/mmkv/instances';
import {deriveSecureStorageKey} from '../keychain/secureStorageKey';
import {hexToBytes, bytesToHex, decToHex64} from './fieldCodec';
import {SHIELDED_CU} from '../../constants/programs';
import type {ShieldedNote} from './types';
import {buildWithdrawChangeWitness} from './withdrawChangeWitness';
import {randomFieldElement} from './noteCrypto';
import {resolveLeafIndex} from './leafResolver';
import {encryptNote, randomBytes} from './noteEncryption';
import {getViewPublicKey} from './shieldedIdentity';

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
  onStep?: (label: string) => void,
): Promise<UnshieldWithChangeResult> {
  ensureSecureMmkv(seed);
  const mint = new PublicKey(mintBase58);
  const destTokenAccount = findAssociatedTokenAddress(feePayer.publicKey, mint);

  onStep?.('1/5 syncing tree…');
  const {leaves, onChainRoots} = await syncLeaves(mintBase58);
  const changeNoteSecret = randomFieldElement();

  // Resolve the input note's on-chain leaf index if it was stored with a sentinel
  // (a change note whose index wasn't known at creation). Backfill it so the
  // Merkle path is built for the correct leaf and future reads are correct.
  let inputNote = note;
  if (inputNote.index < 0) {
    const idx = leaves.indexOf(decToHex64(inputNote.commitment));
    if (idx < 0) {
      throw new Error('This shielded note is not on-chain yet — try again in a moment');
    }
    inputNote = {...inputNote, index: idx};
    setNoteIndex(mintBase58, inputNote.commitment, idx);
  }

  onStep?.('2/5 building witness…');
  const w = buildWithdrawChangeWitness({
    seed, note: inputNote, withdrawAmount, changeNoteSecret, destTokenAccount, leaves,
  });

  if (!onChainRoots.includes(bytesToHex(w.merkleRoot32))) {
    throw new MerkleRootStaleError();
  }

  onStep?.('3/5 proving…');
  const proof = await proveShielded('withdraw_change', w.params);
  if (proof.publicInputs[5] !== w.changeCommitmentDec) {
    throw new Error('Prover changeCommitment mismatch — aborting unshield');
  }
  const proofBytes = hexToBytes(proof.proofBytes);
  if (proofBytes.length !== PROOF_BYTES_LEN) {
    throw new Error(`proofBytes must be ${PROOF_BYTES_LEN} bytes`);
  }

  // Recovery memo for the same-owner change note: encrypt (changeAmount,
  // changeNoteSecret) to our own view key so a restored wallet recovers it.
  // Emit a self-recoverable memo ONLY for a real change note. A whole-note
  // unshield has changeAmount==0 and stores no note (see the addNote guard
  // below); a recoverable 0-memo would make scanIncomingNotes resurrect a
  // spurious unspent 0-note on restore, so use a non-recoverable random filler
  // (the ix requires 128 bytes; scan's G1 parse rejects random bytes).
  const ciphertext =
    w.changeAmount > 0n
      ? encryptNote(getViewPublicKey(seed), w.changeAmount, changeNoteSecret)
      : randomBytes(128);

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
    ciphertext,
  });
  const createAtaIx = buildCreateAtaIdempotentInstruction(
    feePayer.publicKey, destTokenAccount, feePayer.publicKey, mint,
  );

  onStep?.('4/5 submitting…');
  const txSignature = await submitPoolTxMany(
    [createAtaIx, withdrawIx], SHIELDED_CU.withdrawChange, feePayer,
  );

  // submitPoolTxMany confirmed the tx over HTTP polling (getSignatureStatus,
  // which also surfaces an on-chain error) — so the withdraw already succeeded.
  // Do NOT re-fetch it in a blocking loop (a stalled getTransaction hung the flow
  // here on-device). Record the change note (with its secret) FIRST — resolving
  // its leaf index best-effort, or a sentinel to backfill on spend — then mark the
  // input spent. Neither step can hang or lose the change.
  onStep?.('5/5 recording…');
  if (w.changeAmount > 0n) {
    const changeLeafIndex = await resolveLeafIndex(
      txSignature, w.changeCommitmentDec, mintBase58,
    );
    addNote({
      commitment: w.changeCommitmentDec,
      nullifier: '',
      mint: mintBase58,
      amount: w.changeAmount,
      index: changeLeafIndex, // may be UNRESOLVED_INDEX; backfilled when spent
      spent: false,
      createdAt: Date.now(),
      noteSecret: changeNoteSecret.toString(),
    });
  }

  markSpentByCommitment(mintBase58, inputNote.commitment);

  return {txSignature, withdrawn: withdrawAmount, change: w.changeAmount};
}
