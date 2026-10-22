import {Buffer} from 'buffer';
import {PublicKey} from '@solana/web3.js';

/**
 * Encoding helpers shared by every transaction builder in core/ — moved out of core/presale/buyInstructions.ts (which
 * re-exports all three, so its callers are unchanged), so that core/solana does not import presale code: the
 * extension's build without presale carries this module, never buyInstructions.ts (B1d §6.2, review M2).
 */

/** SPL Token and Associated Token program ids — constants, not imports, so core stays dependency-free. */
const SPL_TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const SPL_ATA_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

/** The classic SPL Token program. */
export const SPL_TOKEN_PROGRAM = SPL_TOKEN_PROGRAM_ID.toBase58();

/**
 * Encode a u64 little-endian by hand.
 *
 * `buffer@5.7.1`, which React Native ships, has no `writeBigUInt64LE` — the tidy call
 * works under Jest on Node and throws on a device.
 */
export function encodeU64LE(value: bigint): Buffer {
  const MAX_U64 = 18_446_744_073_709_551_615n;
  if (value < 0n || value > MAX_U64) {
    throw new Error(`presale buy: lamports out of u64 range: ${value}`);
  }
  const buf = Buffer.alloc(8);
  let remaining = value;
  for (let i = 0; i < 8; i++) {
    buf.writeUInt8(Number(remaining & 0xffn), i);
    remaining >>= 8n;
  }
  return buf;
}

/**
 * Associated token address, derived by hand rather than with web3.js's
 * `getAssociatedTokenAddress`. Two reasons, and the second one bit the website: the
 * helper is async for no reason here, and it REFUSES an off-curve owner unless told
 * `allowOwnerOffCurve`. The treasury is a Squads PDA and therefore off-curve, so the
 * tidy call throws where this one simply works.
 */
export function findAssociatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBytes(), SPL_TOKEN_PROGRAM_ID.toBytes(), mint.toBytes()],
    SPL_ATA_PROGRAM_ID,
  );
  return ata;
}
