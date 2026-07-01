import {ComputeBudgetProgram, type Keypair, type TransactionInstruction} from '@solana/web3.js';
import {getConnection} from '../solana/connection';
import {signAndSend} from '../solana/signAndSend';

/**
 * Self-relay: prepend a ComputeBudget limit, sign as fee_payer, submit + confirm.
 * Reuses signAndSend (blockhash retry + confirmation). Returns the signature.
 */
export async function submitPoolTx(
  poolIx: TransactionInstruction,
  computeUnitLimit: number,
  feePayer: Keypair,
): Promise<string> {
  const connection = getConnection();
  const instructions = [
    ComputeBudgetProgram.setComputeUnitLimit({units: computeUnitLimit}),
    poolIx,
  ];
  const {signature} = await signAndSend(
    connection,
    {payer: feePayer.publicKey, instructions},
    [feePayer],
  );
  return signature;
}

/**
 * Like submitPoolTx but for a list of instructions (e.g. create-ATA + withdraw).
 * Prepends the ComputeBudget limit, signs as fee_payer, submits + confirms.
 */
export async function submitPoolTxMany(
  poolIxs: TransactionInstruction[],
  computeUnitLimit: number,
  feePayer: Keypair,
): Promise<string> {
  const connection = getConnection();
  const instructions = [
    ComputeBudgetProgram.setComputeUnitLimit({units: computeUnitLimit}),
    ...poolIxs,
  ];
  const {signature} = await signAndSend(
    connection, {payer: feePayer.publicKey, instructions}, [feePayer],
  );
  return signature;
}
