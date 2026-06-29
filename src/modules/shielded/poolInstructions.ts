import {PublicKey, TransactionInstruction} from '@solana/web3.js';
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
  pool: PublicKey;
  merkleTree: PublicKey;
  vault: PublicKey;
  depositor: PublicKey;     // = fee_payer (transparent keypair)
  depositorTokenAccount: PublicKey;
}

/**
 * deposit(amount: u64, commitment: [u8;32], proof_bytes: Vec<u8>).
 * Data = disc(8) + amount(u64 LE) + commitment(32) + len(u32 LE) + proof_bytes.
 * Accounts (DepositCtx order): pool(ro), merkle_tree(mut), vault(mut),
 * depositor(signer), depositor_token_account(mut), token_program(ro).
 */
export function buildDepositIx(p: DepositIxParams): TransactionInstruction {
  if (p.commitment.length !== 32) throw new Error('commitment must be 32 bytes');
  if (p.proofBytes.length !== 256) throw new Error('proofBytes must be 256 bytes');

  const data = Buffer.concat([
    Buffer.from(depositDiscriminator()),
    Buffer.from(u64le(p.amount)),
    Buffer.from(p.commitment),
    Buffer.from(u32le(p.proofBytes.length)),
    Buffer.from(p.proofBytes),
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
