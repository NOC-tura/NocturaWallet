import {PublicKey, type Keypair} from '@solana/web3.js';
import {proveShielded} from '../zkProver/zkProverModule';
import {syncLeaves} from './merkleSync';
import {selectTransferInputs} from './noteSelect';
import {buildTransferWitness} from './transferWitness';
import {encryptNote} from './noteEncryption';
import {buildTransferIx} from './poolInstructions';
import {submitPoolTxMany} from './poolTx';
import {poolPda, merkleTreePda, nullifierPda, transferVkPda} from './poolPdas';
import {getNotes, markSpentByCommitment, addNote, setNoteIndex} from './noteStore';
import {getViewPublicKey} from './shieldedIdentity';
import {decodeShieldedAddress} from './shieldedAddressCodec';
import {randomFieldElement} from './noteCrypto';
import {resolveLeafIndex} from './leafResolver';
import {hexToBytes, bytesToHex, decToHex64} from './fieldCodec';
import {mmkvSecure, initSecureMmkv} from '../../store/mmkv/instances';
import {deriveSecureStorageKey} from '../keychain/secureStorageKey';
import {MerkleRootStaleError} from './withdrawFlow';
import {SHIELDED_CU} from '../../constants/programs';

const PROOF_BYTES_LEN = 256;

function ensureSecureMmkv(seed: Uint8Array): void {
  if (mmkvSecure()) return;
  initSecureMmkv(deriveSecureStorageKey(seed));
}

export interface TransferResult {
  txSignature: string;
  sent: bigint;
  change: bigint;
}

/**
 * Send a private (shielded → shielded) transfer of `amount` to `recipientAddress`
 * (a noc1… shielded address). 2-in/2-out: select 1 or 2 owned input notes, build
 * the transfer witness, prove, cross-check the prover's out-commitments, encrypt
 * out_0 to the recipient's view key and out_1 (self change) to our own, submit the
 * transfer ix, mark the inputs spent, and store ONLY the self-change note.
 *
 * The recipient output (out_0) is NEVER stored locally — only the recipient can
 * discover it via note scanning of the on-chain ciphertext. Mirrors
 * unshieldWithChange's ordering: record the change note (best-effort leaf index or
 * a sentinel to backfill on spend) BEFORE marking inputs spent, so no step can hang
 * or lose value after a confirmed tx.
 */
export async function sendPrivateTransfer(
  seed: Uint8Array,
  feePayer: Keypair,
  mint: string,
  recipientAddress: string,
  amount: bigint,
  onStep?: (label: string) => void,
): Promise<TransferResult> {
  ensureSecureMmkv(seed);
  const recipientViewKeyG1 = decodeShieldedAddress(recipientAddress); // 48 B

  onStep?.('1/5 syncing tree…');
  const {leaves, onChainRoots} = await syncLeaves(mint);

  const unspent = getNotes(mint).filter(n => !n.spent);
  const inputs = selectTransferInputs(unspent, amount);
  if (inputs === null) {
    throw new Error('insufficient shielded balance for this transfer');
  }

  // Backfill any input note stored with a sentinel index (change notes whose
  // on-chain leaf index wasn't known at creation) so the Merkle path is built for
  // the correct leaf. Commitments are stored as decimal → hex for the leaf lookup.
  const resolvedInputs = inputs.map(note => {
    if (note.index >= 0) return note;
    const idx = leaves.indexOf(decToHex64(note.commitment));
    if (idx < 0) {
      throw new Error('This shielded note is not on-chain yet — try again in a moment');
    }
    setNoteIndex(mint, note.commitment, idx);
    return {...note, index: idx};
  });

  const outNoteSecrets: [bigint, bigint] = [randomFieldElement(), randomFieldElement()];
  const dummyNoteSecret = randomFieldElement();

  onStep?.('2/5 building witness…');
  const w = buildTransferWitness({
    seed,
    realInputs: resolvedInputs,
    recipientViewKeyG1,
    mint,
    transferAmount: amount,
    leaves,
    outNoteSecrets,
    dummyNoteSecret,
  });

  if (!onChainRoots.includes(bytesToHex(w.merkleRoot32))) {
    throw new MerkleRootStaleError();
  }

  onStep?.('3/5 proving…');
  const proof = await proveShielded('transfer', w.params);
  if (
    proof.publicInputs[3] !== w.outCommitmentDec[0] ||
    proof.publicInputs[4] !== w.outCommitmentDec[1]
  ) {
    throw new Error('Prover outCommitment mismatch — aborting transfer');
  }
  const proofBytes = hexToBytes(proof.proofBytes);
  if (proofBytes.length !== PROOF_BYTES_LEN) {
    throw new Error(`proofBytes must be ${PROOF_BYTES_LEN} bytes`);
  }

  // out_0 → recipient (their view key); out_1 → self change (our own view key).
  const ct0 = encryptNote(recipientViewKeyG1, amount, w.recipientOut.noteSecret);
  const ct1 = encryptNote(getViewPublicKey(seed), w.change, w.changeOut.noteSecret);

  const pool = poolPda(new PublicKey(mint));
  const ix = buildTransferIx({
    merkleRoot: w.merkleRoot32,
    nullifier0: w.nullifier32[0],
    nullifier1: w.nullifier32[1],
    outCommitment0: w.outCommitment32[0],
    outCommitment1: w.outCommitment32[1],
    proofBytes,
    ciphertext0: ct0,
    ciphertext1: ct1,
    pool,
    merkleTree: merkleTreePda(pool),
    nullifierRecord0: nullifierPda(w.nullifier32[0]),
    nullifierRecord1: nullifierPda(w.nullifier32[1]),
    feePayer: feePayer.publicKey,
    transferVk: transferVkPda(pool),
  });

  onStep?.('4/5 submitting…');
  const txSignature = await submitPoolTxMany([ix], SHIELDED_CU.transfer, feePayer);

  // submitPoolTxMany confirmed the tx (getSignatureStatus, which surfaces on-chain
  // errors) — the transfer succeeded on-chain. Mark the inputs spent FIRST: this is
  // the critical, must-not-be-skipped step. It is a pure synchronous MMKV write that
  // cannot hang or throw, and skipping it would leave the input note spendable AND
  // let the dashboard scan re-add the received output → local balance inflation.
  onStep?.('5/5 recording…');
  for (const n of resolvedInputs) {
    markSpentByCommitment(mint, n.commitment);
  }

  // Record the self-change note (best-effort). out_1 is encrypted to our OWN view
  // key, so even if this fails, the dashboard scan rediscovers it — storing it here
  // is only for instant feedback. Wrapped so a post-submit RPC/bookkeeping failure
  // can never surface as an error after a confirmed, already-recorded transfer.
  if (w.change > 0n) {
    try {
      const idx = await resolveLeafIndex(txSignature, w.changeOut.commitment, mint);
      addNote({
        commitment: w.changeOut.commitment,
        nullifier: '',
        mint,
        amount: w.change,
        index: idx, // may be UNRESOLVED_INDEX; backfilled when spent
        spent: false,
        createdAt: Date.now(),
        noteSecret: w.changeOut.noteSecret.toString(),
      });
    } catch {
      // best-effort — the scan will rediscover the self-change note
    }
  }

  return {txSignature, sent: amount, change: w.change};
}
