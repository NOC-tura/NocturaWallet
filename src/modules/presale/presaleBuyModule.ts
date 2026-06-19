import {PublicKey, SystemProgram, TransactionInstruction} from '@solana/web3.js';
import {PROGRAM_ID, ADMIN_ADDRESS, SOL_TREASURY, PYTH_SOL_USD_ACCOUNT} from '../../constants/programs';

const PROGRAM = new PublicKey(PROGRAM_ID);
const ADMIN = new PublicKey(ADMIN_ADDRESS);
const PYTH = new PublicKey(PYTH_SOL_USD_ACCOUNT);
const TREASURY = new PublicKey(SOL_TREASURY);

// Anchor 8-byte discriminator for `presale_purchase_with_sol`.
const PURCHASE_WITH_SOL_DISCRIMINATOR = [161, 153, 65, 238, 160, 236, 43, 165];

/** On-chain minimum purchase, in USD (the program rejects below $25). */
export const MIN_PURCHASE_USD = 25;

export interface PresalePdas {
  config: PublicKey;
  userAccount: PublicKey;
  userAllocation: PublicKey;
  referrerAllocation: PublicKey;
}

/** Derive the four PDAs the purchase instruction needs. */
export function derivePresalePdas(user: PublicKey): PresalePdas {
  const [config] = PublicKey.findProgramAddressSync([Buffer.from('config'), ADMIN.toBytes()], PROGRAM);
  const [userAccount] = PublicKey.findProgramAddressSync([Buffer.from('user'), user.toBytes()], PROGRAM);
  const [userAllocation] = PublicKey.findProgramAddressSync([Buffer.from('allocation'), user.toBytes()], PROGRAM);
  // No referrer in B1: the program skips the bonus when the referrer allocation
  // is the PDA of the default (all-zero) pubkey.
  const [referrerAllocation] = PublicKey.findProgramAddressSync(
    [Buffer.from('allocation'), PublicKey.default.toBytes()],
    PROGRAM,
  );
  return {config, userAccount, userAllocation, referrerAllocation};
}

/**
 * Encode a u64 as 8 little-endian bytes WITHOUT Buffer.writeBigUInt64LE — the
 * Hermes Buffer polyfill (buffer@5.7.1) lacks the BigInt accessors and throws
 * on-device. Mirrors buildTransferCheckedInstruction in transactionBuilder.ts.
 */
function encodeU64LE(value: bigint): Buffer {
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
 * Hand-build the `presale_purchase_with_sol(sol_amount)` instruction.
 * Account order is authoritative (matches the program's PresalePurchaseWithSol
 * struct / lib/idl.json): config, user_account, user_allocation,
 * referrer_allocation, pyth_sol_usd_price, user(signer), sol_treasury, system.
 */
export function buildSolPurchaseInstruction(user: PublicKey, solLamports: bigint): TransactionInstruction {
  const {config, userAccount, userAllocation, referrerAllocation} = derivePresalePdas(user);
  const data = Buffer.concat([Buffer.from(PURCHASE_WITH_SOL_DISCRIMINATOR), encodeU64LE(solLamports)]);
  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      {pubkey: config, isSigner: false, isWritable: true},
      {pubkey: userAccount, isSigner: false, isWritable: true},
      {pubkey: userAllocation, isSigner: false, isWritable: true},
      {pubkey: referrerAllocation, isSigner: false, isWritable: true},
      {pubkey: PYTH, isSigner: false, isWritable: false},
      {pubkey: user, isSigner: true, isWritable: true},
      {pubkey: TREASURY, isSigner: false, isWritable: true},
      {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
    ],
    data,
  });
}

/** UI estimate only — actual NOC is computed on-chain from the Pyth SOL/USD price. */
export function estimateNocForSol(solAmount: number, solUsd: number, stagePriceUsd: number): number {
  if (stagePriceUsd <= 0) {
    return 0;
  }
  return (solAmount * solUsd) / stagePriceUsd;
}
