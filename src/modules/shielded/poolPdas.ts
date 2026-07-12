import {PublicKey} from '@solana/web3.js';
import {SHIELDED_POOL_PROGRAM_ID} from '../../constants/programs';

const PROGRAM = new PublicKey(SHIELDED_POOL_PROGRAM_ID);
const SPL_TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const SPL_ATA_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

/** pool config PDA: ["pool", mint]. */
export function poolPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('pool'), mint.toBuffer()], PROGRAM)[0];
}

/** merkle tree PDA: ["merkle", pool]. */
export function merkleTreePda(pool: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('merkle'), pool.toBuffer()], PROGRAM)[0];
}

/** nullifier marker PDA: ["nullifier", nullifier32] (the 32-byte field element BE). */
export function nullifierPda(nullifier32: Uint8Array): PublicKey {
  if (nullifier32.length !== 32) {
    throw new Error(`nullifierPda: expected 32 bytes, got ${nullifier32.length}`);
  }
  return PublicKey.findProgramAddressSync(
    [Buffer.from('nullifier'), Buffer.from(nullifier32)], PROGRAM)[0];
}

/** withdraw-change VK account PDA: ["wchange_vk", pool]. */
export function wchangeVkPda(pool: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('wchange_vk'), pool.toBuffer()], PROGRAM)[0];
}

/** transfer VK account PDA: ["transfer_vk", pool]. */
export function transferVkPda(pool: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('transfer_vk'), pool.toBuffer()], PROGRAM)[0];
}

/**
 * Pool's vault token account = the off-curve ATA of the pool PDA for `mint`.
 * (allowOwnerOffCurve: the pool is a PDA, so its ATA is derived the same way but
 * the owner is not on the ed25519 curve — the ATA derivation itself is identical.)
 */
export function vaultAta(pool: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [pool.toBuffer(), SPL_TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    SPL_ATA_PROGRAM_ID)[0];
}
