import {Buffer} from 'buffer';
import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import {MAINNET_PROGRAM_ID, MAINNET_SOL_TREASURY, PYTH_SOL_USD_ACCOUNT} from './addresses';
import {derivePresalePdas} from './allocation';

const PROGRAM = new PublicKey(MAINNET_PROGRAM_ID);
const PYTH = new PublicKey(PYTH_SOL_USD_ACCOUNT);
const TREASURY = new PublicKey(MAINNET_SOL_TREASURY);

/** Anchor 8-byte discriminator for `presale_purchase_with_sol`. */
const PURCHASE_WITH_SOL_DISCRIMINATOR = [161, 153, 65, 238, 160, 236, 43, 165];
/** Anchor 8-byte discriminator for `register_referrer(referrer: Pubkey)`. */
export const REGISTER_REFERRER_DISCRIMINATOR = [122, 229, 215, 169, 100, 145, 198, 120];

export const COMPUTE_UNIT_LIMIT = 120_000;

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
 * Hand-build the `presale_purchase_with_sol(sol_amount)` instruction.
 *
 * Account order is AUTHORITATIVE — it matches the program's PresalePurchaseWithSol
 * struct and lib/idl.json: config, user_account, user_allocation, referrer_allocation,
 * pyth_sol_usd_price, user(signer), sol_treasury, system. Do not reorder.
 */
export function buildSolPurchaseInstruction(
  user: PublicKey,
  solLamports: bigint,
  referrerAllocation: PublicKey,
): TransactionInstruction {
  const {config, userAccount, userAllocation} = derivePresalePdas(user);
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

export function buildRegisterReferrerInstruction(
  user: PublicKey,
  referrer: PublicKey,
): TransactionInstruction {
  const {userAccount, userAllocation} = derivePresalePdas(user);
  const data = Buffer.concat([
    Buffer.from(REGISTER_REFERRER_DISCRIMINATOR),
    Buffer.from(referrer.toBytes()),
  ]);
  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      {pubkey: userAccount, isSigner: false, isWritable: true},
      {pubkey: userAllocation, isSigner: false, isWritable: true},
      {pubkey: user, isSigner: true, isWritable: true},
      {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
    ],
    data,
  });
}

/** Compute budget, optional register_referrer, then the purchase — in that order. */
export function buildBuyInstructions(
  user: PublicKey,
  solLamports: bigint,
  priorityFeeMicroLamports: number,
  resolved: {referrerAllocation: PublicKey; registerReferrer: PublicKey | null},
): TransactionInstruction[] {
  return [
    ComputeBudgetProgram.setComputeUnitLimit({units: COMPUTE_UNIT_LIMIT}),
    ComputeBudgetProgram.setComputeUnitPrice({microLamports: priorityFeeMicroLamports}),
    ...(resolved.registerReferrer
      ? [buildRegisterReferrerInstruction(user, resolved.registerReferrer)]
      : []),
    buildSolPurchaseInstruction(user, solLamports, resolved.referrerAllocation),
  ];
}

/** NOC bought for a SOL amount at the current stage price. Pure arithmetic. */
export function estimateNocForSol(solAmount: number, solUsd: number, stagePriceUsd: number): number {
  if (stagePriceUsd <= 0) {
    return 0;
  }
  return (solAmount * solUsd) / stagePriceUsd;
}
