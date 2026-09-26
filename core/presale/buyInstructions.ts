import {Buffer} from 'buffer';
import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  MAINNET_PROGRAM_ID,
  PYTH_SOL_USD_ACCOUNT,
  MAINNET_USDC_MINT,
  MAINNET_USDT_MINT,
} from './addresses';
import {derivePresalePdas} from './allocation';

const PROGRAM = new PublicKey(MAINNET_PROGRAM_ID);
const PYTH = new PublicKey(PYTH_SOL_USD_ACCOUNT);

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
  /**
   * `config.sol_treasury`, READ FROM CHAIN by the caller — never a constant. The program
   * validates this account against config, so a shipped constant that drifts makes every
   * purchase fail, and an installed app cannot be corrected. Required rather than
   * defaulted, so the compiler names every call site if the source ever changes.
   */
  treasury: PublicKey,
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
      {pubkey: treasury, isSigner: false, isWritable: true},
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
  /** `config.sol_treasury`, read from chain — see buildSolPurchaseInstruction. */
  treasury: PublicKey,
): TransactionInstruction[] {
  return [
    ComputeBudgetProgram.setComputeUnitLimit({units: COMPUTE_UNIT_LIMIT}),
    ComputeBudgetProgram.setComputeUnitPrice({microLamports: priorityFeeMicroLamports}),
    ...(resolved.registerReferrer
      ? [buildRegisterReferrerInstruction(user, resolved.registerReferrer)]
      : []),
    buildSolPurchaseInstruction(user, solLamports, resolved.referrerAllocation, treasury),
  ];
}

/** NOC bought for a SOL amount at the current stage price. Pure arithmetic. */
export function estimateNocForSol(solAmount: number, solUsd: number, stagePriceUsd: number): number {
  if (stagePriceUsd <= 0) {
    return 0;
  }
  return (solAmount * solUsd) / stagePriceUsd;
}


/** SPL Token and Associated Token program ids — constants, not imports, so core stays dependency-free. */
const SPL_TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const SPL_ATA_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

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

export type StablecoinToken = 'USDC' | 'USDT';

/** Anchor discriminators for `presale_purchase_with_usdc` / `_usdt`. */
const PURCHASE_WITH_USDC_DISCRIMINATOR = [150, 34, 181, 239, 229, 123, 187, 128];
const PURCHASE_WITH_USDT_DISCRIMINATOR = [209, 3, 170, 172, 219, 182, 149, 89];

const STABLECOIN: Record<StablecoinToken, {mint: PublicKey; disc: number[]}> = {
  USDC: {mint: new PublicKey(MAINNET_USDC_MINT), disc: PURCHASE_WITH_USDC_DISCRIMINATOR},
  USDT: {mint: new PublicKey(MAINNET_USDT_MINT), disc: PURCHASE_WITH_USDT_DISCRIMINATOR},
};

/**
 * Stablecoin purchase. Account order matches the program's PresalePurchaseWithStablecoin:
 * config(w), user_account(w), user_allocation(w), referrer_allocation(w), user_ata(w),
 * TREASURY_ata(w), mint, user(signer,w), token_program, system_program.
 *
 * Slot 5 was the ADMIN's associated account until 2026-09-22, and that is the whole
 * story: the program gained `stablecoin_ata_for_admin.owner == config.sol_treasury`, the
 * account LIST did not change, and every USDC/USDT purchase began failing with
 * InvalidTokenAccountOwner. Nothing about the shape moved — the value in one slot did.
 *
 * Moved here from the app so the derivation can be tested for real: the app's Jest run
 * replaces `findProgramAddressSync` with a stub that keys on the first 16 characters of
 * the seed, so the treasury's ATA and the admin's ATA come out IDENTICAL there and no
 * test in that suite can tell them apart.
 */
export function buildStablecoinPurchaseInstruction(
  user: PublicKey,
  token: StablecoinToken,
  amountBaseUnits: bigint,
  referrerAllocation: PublicKey,
  /** `config.sol_treasury`, read from chain by the caller — never a constant. */
  treasury: PublicKey,
): TransactionInstruction {
  const {mint, disc} = STABLECOIN[token];
  const {config, userAccount, userAllocation} = derivePresalePdas(user);
  const userAta = findAssociatedTokenAddress(user, mint);
  const treasuryAta = findAssociatedTokenAddress(treasury, mint);
  const data = Buffer.concat([Buffer.from(disc), encodeU64LE(amountBaseUnits)]);
  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      {pubkey: config, isSigner: false, isWritable: true},
      {pubkey: userAccount, isSigner: false, isWritable: true},
      {pubkey: userAllocation, isSigner: false, isWritable: true},
      {pubkey: referrerAllocation, isSigner: false, isWritable: true},
      {pubkey: userAta, isSigner: false, isWritable: true},
      {pubkey: treasuryAta, isSigner: false, isWritable: true},
      {pubkey: mint, isSigner: false, isWritable: false},
      {pubkey: user, isSigner: true, isWritable: true},
      {pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
      {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
    ],
    data,
  });
}

/** UI estimate for a stablecoin payment. USDC and USDT are 1:1 with the dollar. */
export function estimateNocForUsd(usd: number, stagePriceUsd: number): number {
  if (stagePriceUsd <= 0) return 0;
  return usd / stagePriceUsd;
}

/**
 * The full stablecoin purchase, bundled exactly like the SOL one: compute budget, the
 * one-time `register_referrer` when there is a referrer to record, then the purchase.
 *
 * Moved out of the app so the web builds the SAME transaction rather than a second
 * implementation of it. Two implementations of a money path is how the destination came
 * to be derived from ADMIN in one place and from config in another.
 */
export function buildStablecoinBuyInstructions(
  user: PublicKey,
  token: StablecoinToken,
  amountBaseUnits: bigint,
  priorityFeeMicroLamports: number,
  resolved: {referrerAllocation: PublicKey; registerReferrer: PublicKey | null},
  treasury: PublicKey,
): TransactionInstruction[] {
  return [
    ComputeBudgetProgram.setComputeUnitLimit({units: COMPUTE_UNIT_LIMIT}),
    ComputeBudgetProgram.setComputeUnitPrice({microLamports: priorityFeeMicroLamports}),
    ...(resolved.registerReferrer
      ? [buildRegisterReferrerInstruction(user, resolved.registerReferrer)]
      : []),
    buildStablecoinPurchaseInstruction(user, token, amountBaseUnits, resolved.referrerAllocation, treasury),
  ];
}

/** The SPL Token program, which a stablecoin purchase touches and a SOL one does not. */
export const SPL_TOKEN_PROGRAM = SPL_TOKEN_PROGRAM_ID.toBase58();

/** Base units per whole token: 9 for SOL, 6 for both stablecoins. */
export const TOKEN_DECIMALS: Record<'SOL' | StablecoinToken, number> = {SOL: 9, USDC: 6, USDT: 6};
