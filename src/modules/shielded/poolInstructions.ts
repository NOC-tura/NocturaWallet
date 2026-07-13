import {PublicKey, SystemProgram, TransactionInstruction} from '@solana/web3.js';
import {sha256} from '@noble/hashes/sha2.js';
import {SHIELDED_POOL_PROGRAM_ID} from '../../constants/programs';

const PROGRAM = new PublicKey(SHIELDED_POOL_PROGRAM_ID);
const SPL_TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

/** Anchor global instruction discriminator: sha256("global:<name>")[0:8]. */
function discriminator(name: string): Uint8Array {
  return sha256(Buffer.from(`global:${name}`)).slice(0, 8);
}
export const depositDiscriminator = (): Uint8Array => discriminator('deposit');

/** Encode a u64 as 8 little-endian bytes. Hermes Buffer lacks writeBigUInt64LE. */
function u64le(value: bigint): Uint8Array {
  if (value < 0n || value > 18_446_744_073_709_551_615n) {
    throw new Error(`u64le: out of range: ${value}`);
  }
  const out = new Uint8Array(8);
  let v = value;
  for (let i = 0; i < 8; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

/** Encode a u32 as 4 little-endian bytes (Borsh Vec<u8> length prefix). */
function u32le(value: number): Uint8Array {
  const out = new Uint8Array(4);
  out[0] = value & 0xff;
  out[1] = (value >> 8) & 0xff;
  out[2] = (value >> 16) & 0xff;
  out[3] = (value >> 24) & 0xff;
  return out;
}

export interface DepositIxParams {
  amount: bigint;
  commitment: Uint8Array;   // 32 bytes
  proofBytes: Uint8Array;   // 256 bytes
  ciphertext: Uint8Array;   // 128 bytes — NoteCiphertext memo (amount+noteSecret to own view key)
  pool: PublicKey;
  merkleTree: PublicKey;
  vault: PublicKey;
  depositor: PublicKey;     // = fee_payer (transparent keypair)
  depositorTokenAccount: PublicKey;
}

/**
 * deposit(amount: u64, commitment: [u8;32], proof_bytes: Vec<u8>, ciphertext: Vec<u8>).
 * Data = disc(8) + amount(u64 LE) + commitment(32) + len(u32 LE) + proof_bytes
 *      + len(u32 LE) + ciphertext(128).  The memo lets a restored wallet recover
 *      this deposit note by scanning (see seed-recovery design spec).
 * Accounts (DepositCtx order): pool(ro), merkle_tree(mut), vault(mut),
 * depositor(signer), depositor_token_account(mut), token_program(ro).
 */
export function buildDepositIx(p: DepositIxParams): TransactionInstruction {
  if (p.commitment.length !== 32) throw new Error('commitment must be 32 bytes');
  if (p.proofBytes.length !== 256) throw new Error('proofBytes must be 256 bytes');
  if (p.ciphertext.length !== 128) throw new Error('ciphertext must be 128 bytes');

  const data = Buffer.concat([
    Buffer.from(depositDiscriminator()),
    Buffer.from(u64le(p.amount)),
    Buffer.from(p.commitment),
    Buffer.from(u32le(p.proofBytes.length)),
    Buffer.from(p.proofBytes),
    Buffer.from(u32le(p.ciphertext.length)),
    Buffer.from(p.ciphertext),
  ]);

  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      {pubkey: p.pool, isSigner: false, isWritable: false},
      {pubkey: p.merkleTree, isSigner: false, isWritable: true},
      {pubkey: p.vault, isSigner: false, isWritable: true},
      {pubkey: p.depositor, isSigner: true, isWritable: false},
      {pubkey: p.depositorTokenAccount, isSigner: false, isWritable: true},
      {pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
    ],
    data,
  });
}

export const withdrawDiscriminator = (): Uint8Array => discriminator('withdraw');

export interface WithdrawIxParams {
  merkleRoot: Uint8Array;   // 32
  nullifier: Uint8Array;    // 32
  amount: bigint;
  proofBytes: Uint8Array;   // 256
  pool: PublicKey;
  merkleTree: PublicKey;
  vault: PublicKey;
  destinationTokenAccount: PublicKey;
  nullifierRecord: PublicKey;
  feePayer: PublicKey;
}

/**
 * withdraw(merkle_root: [u8;32], nullifier: [u8;32], amount: u64, proof_bytes).
 * Data = disc(8) + merkle_root(32) + nullifier(32) + amount(u64 LE) + len(u32 LE) + proof.
 * Accounts (WithdrawCtx order): pool(ro), merkle_tree(mut), vault(mut),
 * destination_token_account(mut), nullifier_record(mut/init), fee_payer(signer,mut),
 * token_program(ro), system_program(ro).
 */
export function buildWithdrawIx(p: WithdrawIxParams): TransactionInstruction {
  if (p.merkleRoot.length !== 32) throw new Error('merkleRoot must be 32 bytes');
  if (p.nullifier.length !== 32) throw new Error('nullifier must be 32 bytes');
  if (p.proofBytes.length !== 256) throw new Error('proofBytes must be 256 bytes');

  const data = Buffer.concat([
    Buffer.from(withdrawDiscriminator()),
    Buffer.from(p.merkleRoot),
    Buffer.from(p.nullifier),
    Buffer.from(u64le(p.amount)),
    Buffer.from(u32le(p.proofBytes.length)),
    Buffer.from(p.proofBytes),
  ]);

  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      {pubkey: p.pool, isSigner: false, isWritable: false},
      {pubkey: p.merkleTree, isSigner: false, isWritable: true},
      {pubkey: p.vault, isSigner: false, isWritable: true},
      {pubkey: p.destinationTokenAccount, isSigner: false, isWritable: true},
      {pubkey: p.nullifierRecord, isSigner: false, isWritable: true},
      {pubkey: p.feePayer, isSigner: true, isWritable: true},
      {pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
      {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
    ],
    data,
  });
}

export const transferDiscriminator = (): Uint8Array => discriminator('transfer');

export interface TransferIxParams {
  merkleRoot: Uint8Array;
  nullifier0: Uint8Array;
  nullifier1: Uint8Array;
  outCommitment0: Uint8Array;
  outCommitment1: Uint8Array;
  proofBytes: Uint8Array;
  ciphertext0: Uint8Array;
  ciphertext1: Uint8Array;
  pool: PublicKey;
  merkleTree: PublicKey;
  nullifierRecord0: PublicKey;
  nullifierRecord1: PublicKey;
  feePayer: PublicKey;
  transferVk: PublicKey;
}

/**
 * transfer(merkle_root, nullifier_0, nullifier_1, out_commitment_0, out_commitment_1,
 *          proof_bytes, ciphertext_0, ciphertext_1). No SPL leg.
 * Data = disc(8) + merkle_root(32) + nullifier_0(32) + nullifier_1(32)
 *      + out_commitment_0(32) + out_commitment_1(32)
 *      + len(u32 LE) + proof_bytes(256)
 *      + len(u32 LE) + ciphertext_0(128)
 *      + len(u32 LE) + ciphertext_1(128).
 * Accounts (TransferCtx): pool(ro), merkle_tree(mut), nullifier_record_0(init,mut),
 * nullifier_record_1(init,mut), fee_payer(signer,mut), transfer_vk(ro), system_program(ro).
 */
export function buildTransferIx(p: TransferIxParams): TransactionInstruction {
  const chk = (b: Uint8Array, n: number, name: string) => {
    if (b.length !== n) throw new Error(`${name} must be ${n} bytes`);
  };
  chk(p.merkleRoot, 32, 'merkleRoot');
  chk(p.nullifier0, 32, 'nullifier0');
  chk(p.nullifier1, 32, 'nullifier1');
  chk(p.outCommitment0, 32, 'outCommitment0');
  chk(p.outCommitment1, 32, 'outCommitment1');
  chk(p.proofBytes, 256, 'proofBytes');
  chk(p.ciphertext0, 128, 'ciphertext0');
  chk(p.ciphertext1, 128, 'ciphertext1');

  const data = Buffer.concat([
    Buffer.from(transferDiscriminator()),
    Buffer.from(p.merkleRoot),
    Buffer.from(p.nullifier0),
    Buffer.from(p.nullifier1),
    Buffer.from(p.outCommitment0),
    Buffer.from(p.outCommitment1),
    Buffer.from(u32le(p.proofBytes.length)),
    Buffer.from(p.proofBytes),
    Buffer.from(u32le(p.ciphertext0.length)),
    Buffer.from(p.ciphertext0),
    Buffer.from(u32le(p.ciphertext1.length)),
    Buffer.from(p.ciphertext1),
  ]);

  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      {pubkey: p.pool, isSigner: false, isWritable: false},
      {pubkey: p.merkleTree, isSigner: false, isWritable: true},
      {pubkey: p.nullifierRecord0, isSigner: false, isWritable: true},
      {pubkey: p.nullifierRecord1, isSigner: false, isWritable: true},
      {pubkey: p.feePayer, isSigner: true, isWritable: true},
      {pubkey: p.transferVk, isSigner: false, isWritable: false},
      {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
    ],
    data,
  });
}

export const withdrawChangeDiscriminator = (): Uint8Array => discriminator('withdraw_with_change');

export interface WithdrawWithChangeIxParams {
  merkleRoot: Uint8Array;              // 32
  nullifier: Uint8Array;               // 32
  amount: bigint;
  changeCommitment: Uint8Array;        // 32
  proofBytes: Uint8Array;              // 256
  pool: PublicKey;
  merkleTree: PublicKey;
  vault: PublicKey;
  destinationTokenAccount: PublicKey;
  nullifierRecord: PublicKey;
  feePayer: PublicKey;
  wchangeVk: PublicKey;
}

/**
 * withdraw_with_change(merkle_root[32], nullifier[32], amount:u64, change_commitment[32], proof_bytes).
 * Data = disc(8) + merkle_root(32) + nullifier(32) + amount(u64 LE) + change_commitment(32) + len(u32 LE) + proof.
 * Accounts (WithdrawWithChangeCtx order): the 8 WithdrawCtx accounts + wchange_vk (ro).
 * SYNC POINT: the wchange_vk position is assumed appended LAST; confirm vs the ICO's final ctx at deploy.
 */
export function buildWithdrawWithChangeIx(p: WithdrawWithChangeIxParams): TransactionInstruction {
  if (p.merkleRoot.length !== 32) throw new Error('merkleRoot must be 32 bytes');
  if (p.nullifier.length !== 32) throw new Error('nullifier must be 32 bytes');
  if (p.changeCommitment.length !== 32) throw new Error('changeCommitment must be 32 bytes');
  if (p.proofBytes.length !== 256) throw new Error('proofBytes must be 256 bytes');

  const data = Buffer.concat([
    Buffer.from(withdrawChangeDiscriminator()),
    Buffer.from(p.merkleRoot),
    Buffer.from(p.nullifier),
    Buffer.from(u64le(p.amount)),
    Buffer.from(p.changeCommitment),
    Buffer.from(u32le(p.proofBytes.length)),
    Buffer.from(p.proofBytes),
  ]);

  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      {pubkey: p.pool, isSigner: false, isWritable: false},
      {pubkey: p.merkleTree, isSigner: false, isWritable: true},
      {pubkey: p.vault, isSigner: false, isWritable: true},
      {pubkey: p.destinationTokenAccount, isSigner: false, isWritable: true},
      {pubkey: p.nullifierRecord, isSigner: false, isWritable: true},
      {pubkey: p.feePayer, isSigner: true, isWritable: true},
      // wchange_vk sits BETWEEN fee_payer and token_program per the deployed
      // WithdrawWithChangeCtx (confirmed against the on-chain program), NOT last.
      {pubkey: p.wchangeVk, isSigner: false, isWritable: false},
      {pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
      {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
    ],
    data,
  });
}
