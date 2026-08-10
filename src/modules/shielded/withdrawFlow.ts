import {PublicKey, type Keypair} from '@solana/web3.js';
import {proveShielded} from '../zkProver/zkProverModule';
import {syncLeaves} from './merkleSync';
import {buildWithdrawWithChangeIx} from './poolInstructions';
import {submitPoolTxMany} from './poolTx';
import {poolPda, merkleTreePda, vaultAta, nullifierPda, wchangeVkPda} from './poolPdas';
import {
  findAssociatedTokenAddress,
  buildCreateAtaIdempotentInstruction,
} from '../solana/transactionBuilder';
import {markSpentByCommitment, setNoteIndex, addNote} from './noteStore';
import {mmkvSecure, initSecureMmkv} from '../../store/mmkv/instances';
import {deriveSecureStorageKey} from '../keychain/secureStorageKey';
import {hexToBytes, bytesToHex, decToHex64} from './fieldCodec';
import {SHIELDED_CU} from '../../constants/programs';
import type {ShieldedNote} from './types';
import {buildWithdrawChangeWitness} from './withdrawChangeWitness';
import {randomFieldElement} from './noteCrypto';
import {resolveLeafIndex, UNRESOLVED_INDEX} from './leafResolver';
import {encryptNote, randomBytes} from './noteEncryption';
import {getViewPublicKey} from './shieldedIdentity';

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
  // which also surfaces an on-chain error) — so the withdraw already succeeded
  // and the money has moved.
  //
  // ORDERING IS LOAD-BEARING. Both bookkeeping writes are synchronous MMKV
  // writes that cannot hang or throw, and BOTH happen before any await. The
  // previous version awaited resolveLeafIndex (up to 32 s: 12 s getTransaction +
  // 20 s resync) *before* either write and without a try/catch, so a post-submit
  // RPC failure — or the process being killed during that window — left:
  //   • the input note not marked spent → its nullifier exists on-chain but the
  //     wallet still counts it, so the balance is permanently inflated and every
  //     future spend that selects it is rejected; and
  //   • the change note unrecorded until a later scan rediscovered it.
  // Resolving the leaf index is pure optimisation and is now strictly last,
  // best-effort, and non-fatal.
  onStep?.('5/5 recording…');
  if (w.changeAmount > 0n) {
    addNote({
      commitment: w.changeCommitmentDec,
      nullifier: '',
      mint: mintBase58,
      amount: w.changeAmount,
      index: UNRESOLVED_INDEX, // backfilled below, or on spend
      spent: false,
      createdAt: Date.now(),
      noteSecret: changeNoteSecret.toString(),
    });
  }

  markSpentByCommitment(mintBase58, inputNote.commitment);

  // Best-effort index backfill. A failure here costs one resync at spend time,
  // never value: the change note is already stored (with a sentinel index) and
  // is independently recoverable from its on-chain memo.
  if (w.changeAmount > 0n) {
    try {
      const changeLeafIndex = await resolveLeafIndex(
        txSignature, w.changeCommitmentDec, mintBase58,
      );
      if (changeLeafIndex >= 0) {
        setNoteIndex(mintBase58, w.changeCommitmentDec, changeLeafIndex);
      }
    } catch {
      // leave the sentinel — resolved on spend
    }
  }

  return {txSignature, withdrawn: withdrawAmount, change: w.changeAmount};
}
