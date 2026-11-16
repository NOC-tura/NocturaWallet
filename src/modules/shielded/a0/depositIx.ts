/* eslint-disable no-bitwise -- byte-level encoding is what this file is about */
/**
 * The A0 `deposit` instruction (spec §1, §5 step 5), byte for byte as the deployed program
 * FeGSS… reads it — held to the landed deposit 3DR6F7oW… by __tests__/depositIx.golden.test.ts.
 *
 *   data = disc f223c68952e1f2b6 | amount u64 LE | commitment [32] | rho [32] | u32 LE 256 | proof [256]
 *        = 8 + 332 = 340 bytes;
 *   accounts (IDL order) = pool r, merkle_tree w, vault w, depositor s+w, depositor_token_account w,
 *        rho_marker w (PDA ["rho", rho]), token_program, system_program.
 *
 * `commitment` and `rho` are field elements in canonical big-endian (< r); a value ≥ r is refused
 * here, before any fee is paid (the circuit could not prove it, and the rho marker would be keyed
 * on a number the proof is not bound to). The amount is a BigInt in base units, 1..2^64-1 (the
 * Rust prover refuses a deposit of 0, §3). The u64 is encoded by hand: Hermes' Buffer polyfill
 * (buffer@5.7.1) has no BigInt read/write methods.
 *
 * The ComputeBudget limit (A0_CU.deposit) is the transaction builder's, not this instruction's.
 */
import {PublicKey, TransactionInstruction} from '@solana/web3.js';
import {
  A0,
  A0_DEPOSIT_ARGS_BYTES,
  A0_IX_DISCRIMINATOR,
  A0_PROOF_BYTES,
  A0_RHO_SEED,
  SYSTEM_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from './constants';
import {FIELD_MODULUS} from './fieldEquations';

export interface A0DepositArgs {
  /** base units of the pool's mint, 1..2^64-1 */
  amount: bigint;
  /** 32 bytes, canonical BE field element */
  commitment: Uint8Array;
  /** 32 bytes, canonical BE field element; also the rho-marker PDA seed */
  rho: Uint8Array;
  /** 256 bytes, the prover's on-chain layout */
  proof: Uint8Array;
}

export interface A0DepositAccounts {
  /** the transparent account that signs, pays the fee and the rho marker's rent */
  depositor: PublicKey;
  /** the token account the amount leaves — the actual holding account, not assumed to be the ATA */
  depositorTokenAccount: PublicKey;
}

const U64_MAX = (1n << 64n) - 1n;

function hexToBytes(h: string): Uint8Array {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(h.slice(2 * i, 2 * i + 2), 16);
  }
  return out;
}

function u64le(v: bigint): Uint8Array {
  const out = new Uint8Array(8);
  let x = v;
  for (let i = 0; i < 8; i++) {
    out[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  return out;
}

function u32le(v: number): Uint8Array {
  return Uint8Array.of(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
}

function canonical32(name: string, b: Uint8Array): void {
  if (b.length !== 32) {
    throw new Error(`a0 deposit: ${name} must be 32 bytes, got ${b.length}`);
  }
  let v = 0n;
  for (const x of b) {
    v = (v << 8n) | BigInt(x);
  }
  if (v >= FIELD_MODULUS) {
    throw new Error(`a0 deposit: ${name} is not a canonical field element (>= r)`);
  }
}

function checkArgs(a: A0DepositArgs): void {
  if (a.amount < 1n || a.amount > U64_MAX) {
    throw new Error('a0 deposit: amount must be in 1..2^64-1 base units');
  }
  canonical32('commitment', a.commitment);
  canonical32('rho', a.rho);
  if (a.proof.length !== A0_PROOF_BYTES) {
    throw new Error(`a0 deposit: proof must be ${A0_PROOF_BYTES} bytes, got ${a.proof.length}`);
  }
}

/** The instruction data, 340 bytes (a fresh array; the inputs are copied). */
export function encodeA0DepositData(a: A0DepositArgs): Uint8Array {
  checkArgs(a);
  const out = new Uint8Array(8 + A0_DEPOSIT_ARGS_BYTES);
  let o = 0;
  for (const part of [
    hexToBytes(A0_IX_DISCRIMINATOR.deposit),
    u64le(a.amount),
    a.commitment,
    a.rho,
    u32le(a.proof.length),
    a.proof,
  ]) {
    out.set(part, o);
    o += part.length;
  }
  return out;
}

/** The global rho marker PDA ["rho", rho] under FeGSS… (rho: 32 bytes, canonical). */
export function a0RhoMarkerPda(rho: Uint8Array): PublicKey {
  canonical32('rho', rho);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(A0_RHO_SEED), Buffer.from(rho)],
    new PublicKey(A0.programId),
  )[0];
}

/** The A0 `deposit` instruction into the devnet pool 8VMe…. */
export function buildA0DepositIx(
  a: A0DepositArgs,
  acc: A0DepositAccounts,
): TransactionInstruction {
  const data = encodeA0DepositData(a);
  return new TransactionInstruction({
    programId: new PublicKey(A0.programId),
    keys: [
      {pubkey: new PublicKey(A0.pool), isSigner: false, isWritable: false},
      {pubkey: new PublicKey(A0.merkleTree), isSigner: false, isWritable: true},
      {pubkey: new PublicKey(A0.vault), isSigner: false, isWritable: true},
      {pubkey: acc.depositor, isSigner: true, isWritable: true},
      {pubkey: acc.depositorTokenAccount, isSigner: false, isWritable: true},
      {pubkey: a0RhoMarkerPda(a.rho), isSigner: false, isWritable: true},
      {pubkey: new PublicKey(TOKEN_PROGRAM_ID), isSigner: false, isWritable: false},
      {pubkey: new PublicKey(SYSTEM_PROGRAM_ID), isSigner: false, isWritable: false},
    ],
    data: Buffer.from(data),
  });
}
