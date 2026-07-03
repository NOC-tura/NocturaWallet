import {PublicKey} from '@solana/web3.js'; // value import — also serves as the type
import {nullifier, mintHash, recipientField, noteCommitment} from './noteCrypto';
import {getPkRecipientHash} from './shieldedIdentity';
import {computeMerklePath} from '../merkle/merkleModule';
import {decToBe32, hexToDec} from './fieldCodec';
import type {ShieldedProveParams} from '../zkProver/types';
import type {ShieldedNote} from './types';

export interface WithdrawChangeWitnessInput {
  seed: Uint8Array;
  note: ShieldedNote;
  withdrawAmount: bigint;
  changeNoteSecret: bigint;
  destTokenAccount: PublicKey;
  leaves: string[]; // hex commitments, dense by leaf index (from merkleSync)
}

export interface WithdrawChangeWitness {
  params: ShieldedProveParams;
  nullifier32: Uint8Array;        // BE 32B — ix arg + nullifier PDA seed
  merkleRoot32: Uint8Array;       // BE 32B — ix arg
  changeCommitment32: Uint8Array; // BE 32B — ix arg (new change-note leaf)
  changeCommitmentDec: string;    // decimal — cross-check against prover publicInputs[5]
  changeAmount: bigint;           // note.amount - withdrawAmount
}

/**
 * Witness + /zk/prove params for a partial (change-output) unshield.
 * Public inputs (circuit order): [merkleRoot, nullifier, withdrawAmount,
 * recipientField, mintHash, changeCommitment]. The circuit RECOMPUTES the change
 * commitment from (pkRecipientHash, changeAmount, mintHash, changeNoteSecret), so
 * it is NOT sent as a param — the wallet computes it locally for the ix arg + a
 * cross-check against the prover's returned publicInputs[5]. Change is same-owner
 * (pkRecipientHash + mintHash reused from the input note).
 *
 * merklePath/merklePathIndices are decimal-string arrays (indices as '0'/'1',
 * LSB-first). See project_shielded_c2_contract for the signal contract.
 */
export function buildWithdrawChangeWitness(
  input: WithdrawChangeWitnessInput,
): WithdrawChangeWitness {
  const {seed, note, withdrawAmount, changeNoteSecret, destTokenAccount, leaves} = input;

  if (withdrawAmount < 0n || withdrawAmount > note.amount) {
    throw new Error(
      `withdrawAmount ${withdrawAmount} out of range (0..${note.amount})`,
    );
  }

  const changeAmount = note.amount - withdrawAmount;

  const pkH = getPkRecipientHash(seed);
  const mH = mintHash(new PublicKey(note.mint).toBytes());
  const nul = nullifier({noteSecret: BigInt(note.noteSecret), leafIndex: note.index});
  const recip = recipientField(destTokenAccount.toBytes());
  const {root, siblings, pathIndices} = computeMerklePath(leaves, note.index);
  const merkleRootDec = hexToDec(root);

  // The circuit declares changeCommitment as a PUBLIC INPUT signal (and internally
  // constrains it == poseidon5(...)), so snarkjs fullProve requires it in the
  // input JSON. The wallet computes it locally and passes it as a param; it is
  // also returned for the ix arg + a cross-check against publicInputs[5].
  const changeCommitment = noteCommitment({
    pkRecipientHash: pkH,
    amount: changeAmount,
    mintHash: mH,
    noteSecret: changeNoteSecret,
  });

  const params: ShieldedProveParams = {
    merkleRoot: merkleRootDec,
    nullifier: nul.toString(),
    withdrawAmount: withdrawAmount.toString(),
    recipientField: recip.toString(),
    mintHash: mH.toString(),
    changeCommitment: changeCommitment.toString(),
    noteSecret: BigInt(note.noteSecret).toString(),
    pkRecipientHash: pkH.toString(),
    inputAmount: note.amount.toString(),
    leafIndex: note.index.toString(),
    merklePath: siblings.map(hexToDec),
    merklePathIndices: pathIndices.map(b => b.toString()),
    changeNoteSecret: changeNoteSecret.toString(),
    changeAmount: changeAmount.toString(),
  };

  return {
    params,
    nullifier32: decToBe32(nul.toString()),
    merkleRoot32: decToBe32(merkleRootDec),
    changeCommitment32: decToBe32(changeCommitment.toString()),
    changeCommitmentDec: changeCommitment.toString(),
    changeAmount,
  };
}
