import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
// Self-import so resolveReferrer calls fetchAllocationRef through the module's
// live export binding, which lets tests `jest.spyOn(presaleBuyModule,
// 'fetchAllocationRef')` intercept it (a direct intra-module call is NOT
// interceptable under the @react-native/babel CJS transform).
import * as self from './presaleBuyModule';
import {PROGRAM_ID, ADMIN_ADDRESS} from '../../constants/programs';
import {findAssociatedTokenAddress} from '../solana/transactionBuilder';
import {USDC_MINT, USDT_MINT} from '../tokens/coreTokens';
import {getConnection} from '../solana/connection';
import {estimatePriorityFee} from '../solana/priorityFee';
import {KeychainManager} from '../keychain/keychainModule';
import {mnemonicToSeed} from '../keyDerivation/mnemonicUtils';
import {deriveTransparentKeypair, type TransparentScheme} from '../keyDerivation/transparent';
import {zeroize} from '../session/zeroize';
import {useReferralCaptureStore} from '../../store/zustand/referralCaptureStore';
import {
  fetchAllocationRef as coreFetchAllocationRef,
  resolveReferrerWith as coreResolveReferrerWith,
} from '../../../core/presale/referrer';
import {
  buildBuyInstructions,
  buildRegisterReferrerInstruction,
  buildSolPurchaseInstruction,
  encodeU64LE,
  estimateNocForSol,
  COMPUTE_UNIT_LIMIT,
  REGISTER_REFERRER_DISCRIMINATOR,
} from '../../../core/presale/buyInstructions';
import {
  derivePresalePdas as coreDerivePresalePdas,
  fetchOnChainAllocation as coreFetchOnChainAllocation,
  fetchTgeTimestamp as coreFetchTgeTimestamp,
} from '../../../core/presale/allocation';

const PROGRAM = new PublicKey(PROGRAM_ID);
const ADMIN = new PublicKey(ADMIN_ADDRESS);

// Anchor 8-byte discriminator for `presale_purchase_with_sol`.

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const PURCHASE_WITH_USDC_DISCRIMINATOR = [150, 34, 181, 239, 229, 123, 187, 128];
const PURCHASE_WITH_USDT_DISCRIMINATOR = [209, 3, 170, 172, 219, 182, 149, 89];

export type StablecoinToken = 'USDC' | 'USDT';

const STABLECOIN: Record<StablecoinToken, {mint: PublicKey; disc: number[]}> = {
  USDC: {mint: new PublicKey(USDC_MINT), disc: PURCHASE_WITH_USDC_DISCRIMINATOR},
  USDT: {mint: new PublicKey(USDT_MINT), disc: PURCHASE_WITH_USDT_DISCRIMINATOR},
};

/** Minimum / maximum purchase, in USD, per the presale (Min $10 · Max $50k/tx). */
export const MIN_PURCHASE_USD = 10;
export const MAX_PURCHASE_USD = 50_000;

export type {PresalePdas} from '../../../core/presale/allocation';
export const derivePresalePdas = coreDerivePresalePdas;
export {
  estimateNocForSol,
  buildSolPurchaseInstruction,
  buildRegisterReferrerInstruction,
  encodeU64LE,
  REGISTER_REFERRER_DISCRIMINATOR,
};

/** The app's chain reader, handed to core: its own Connection, narrow interface. */
const appReader = {getAccountInfo: (address: PublicKey) => getConnection().getAccountInfo(address)};

/**
 * Read the user's authoritative on-chain presale allocation. Delegates to core so the
 * web app reads the same bytes at the same offsets.
 */
export const fetchOnChainAllocation = (user: PublicKey) => coreFetchOnChainAllocation(appReader, user);

/** Read the on-chain TGE timestamp in unix seconds, or null when unreadable. */
export const fetchTgeTimestamp = () => coreFetchTgeTimestamp(appReader);

// ===========================================================================
// Referral (B1): register_referrer instruction + allocation read + resolve
// ===========================================================================


/**
 * Hand-build the `register_referrer(referrer)` instruction. Both PDAs are
 * `init_if_needed` (payer = user), so this works on a fresh wallet. Account
 * order matches the program's RegisterReferrer struct: user_account(w),
 * user_allocation(w), user(signer,w), system_program. The referrer wallet
 * address is the instruction ARG (32 bytes appended to the discriminator), not
 * an account.
 */

/** Read the buyer's on-chain PresaleAllocation referral fields. Delegates to core. */
export const fetchAllocationRef = (user: PublicKey) => coreFetchAllocationRef(appReader, user);



/**
 * Decide how a presale buy should apply a referrer (spec §B). CORRECTNESS: the
 * returned `referrerAllocation` is ALWAYS the PDA of the SAME `effective`
 * referrer that `registerReferrer` sets — the program validates
 * `referrer_allocation` against `["allocation", user_allocation.referrer]`, so a
 * mismatch makes the tx fail.
 *
 * - A captured referrer is acted on only for a first-time buyer with no
 *   on-chain referrer (matches the on-chain one-time 10% bonus + the website).
 * - An already-registered on-chain referrer is honored (no re-register).
 * - No effective referrer → `referrerAllocation` = PDA(default) (the program
 *   skips the bonus), byte-identical to the pre-referral behavior.
 */
/**
 * Decide how a presale buy applies a referrer. Delegates to core, but keeps the
 * `self.` indirection so the existing tests' spies on fetchAllocationRef still reach
 * it — the spy is what proves this behaviour did not change.
 */
export async function resolveReferrer(
  user: PublicKey,
  capturedReferrer: string | null,
): Promise<{
  referrerAllocation: PublicKey;
  registerReferrer: PublicKey | null;
  effectiveReferrerAddress: string | null;
}> {
  return coreResolveReferrerWith(u => self.fetchAllocationRef(u), user, capturedReferrer);
}


/**
 * Encode a u64 as 8 little-endian bytes WITHOUT Buffer.writeBigUInt64LE — the
 * Hermes Buffer polyfill (buffer@5.7.1) lacks the BigInt accessors and throws
 * on-device. Mirrors buildTransferCheckedInstruction in transactionBuilder.ts.
 */

/**
 * Hand-build the `presale_purchase_with_sol(sol_amount)` instruction.
 * Account order is authoritative (matches the program's PresalePurchaseWithSol
 * struct / lib/idl.json): config, user_account, user_allocation,
 * referrer_allocation, pyth_sol_usd_price, user(signer), sol_treasury, system.
 */

/** UI estimate only — actual NOC is computed on-chain from the Pyth SOL/USD price. */

/**
 * Hand-build presale_purchase_with_usdc / _usdt. Payment is an SPL transfer
 * from the buyer's ATA to the ADMIN's ATA (1:1 USD, no Pyth). Account order
 * matches the program's PresalePurchaseWithStablecoin struct.
 */
export function buildStablecoinPurchaseInstruction(
  user: PublicKey,
  token: StablecoinToken,
  amountBaseUnits: bigint,
  referrerAllocation: PublicKey,
): TransactionInstruction {
  const {mint, disc} = STABLECOIN[token];
  const {config, userAccount, userAllocation} = derivePresalePdas(user);
  const userAta = findAssociatedTokenAddress(user, mint);
  const adminAta = findAssociatedTokenAddress(ADMIN, mint);
  const data = Buffer.concat([Buffer.from(disc), encodeU64LE(amountBaseUnits)]);
  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      {pubkey: config, isSigner: false, isWritable: true},
      {pubkey: userAccount, isSigner: false, isWritable: true},
      {pubkey: userAllocation, isSigner: false, isWritable: true},
      {pubkey: referrerAllocation, isSigner: false, isWritable: true},
      {pubkey: userAta, isSigner: false, isWritable: true},
      {pubkey: adminAta, isSigner: false, isWritable: true},
      {pubkey: mint, isSigner: false, isWritable: false},
      {pubkey: user, isSigner: true, isWritable: true},
      {pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
      {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
    ],
    data,
  });
}

/** UI estimate for a stablecoin (1:1 USD) payment. */
export function estimateNocForUsd(usd: number, stagePriceUsd: number): number {
  if (stagePriceUsd <= 0) {
    return 0;
  }
  return usd / stagePriceUsd;
}

const keychainManager = new KeychainManager();

/**
 * Assemble the full SOL-purchase instruction list, bundling a one-time
 * `register_referrer` FIRST (when `resolveReferrer` says so) so the purchase
 * reads the just-set referrer, and passing the resolved `referrerAllocation` to
 * the purchase. The no-referrer path (registerReferrer == null,
 * referrerAllocation == default PDA) is byte-identical to the pre-referral
 * single-purchase tx.
 */

/**
 * Build the (unsigned) purchase tx for pre-submit simulation. Payer = user.
 * Resolves the captured referrer and bundles `register_referrer` identically to
 * the submit path so the simulated tx matches what's broadcast.
 */
export async function buildSolPurchaseTx(user: PublicKey, solLamports: bigint): Promise<VersionedTransaction> {
  const captured = useReferralCaptureStore.getState().capturedReferrer;
  const r = await self.resolveReferrer(user, captured);
  const connection = getConnection();
  const {blockhash} = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: user,
    recentBlockhash: blockhash,
    instructions: buildBuyInstructions(user, solLamports, 0, r),
  }).compileToV0Message();
  return new VersionedTransaction(message);
}

/** Stablecoin analogue of buildBuyInstructions — bundles register first. */
function buildStablecoinInstructions(
  user: PublicKey,
  token: StablecoinToken,
  amountBaseUnits: bigint,
  priorityFeeMicroLamports: number,
  resolved: {referrerAllocation: PublicKey; registerReferrer: PublicKey | null},
) {
  return [
    ComputeBudgetProgram.setComputeUnitLimit({units: COMPUTE_UNIT_LIMIT}),
    ComputeBudgetProgram.setComputeUnitPrice({microLamports: priorityFeeMicroLamports}),
    ...(resolved.registerReferrer
      ? [buildRegisterReferrerInstruction(user, resolved.registerReferrer)]
      : []),
    buildStablecoinPurchaseInstruction(user, token, amountBaseUnits, resolved.referrerAllocation),
  ];
}

/**
 * Unsigned stablecoin purchase tx for pre-submit simulation. Payer = user.
 * Bundles `register_referrer` identically to the submit path.
 */
export async function buildStablecoinPurchaseTx(
  user: PublicKey,
  token: StablecoinToken,
  amountBaseUnits: bigint,
): Promise<VersionedTransaction> {
  const captured = useReferralCaptureStore.getState().capturedReferrer;
  const r = await self.resolveReferrer(user, captured);
  const connection = getConnection();
  const {blockhash} = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: user,
    recentBlockhash: blockhash,
    instructions: buildStablecoinInstructions(user, token, amountBaseUnits, 0, r),
  }).compileToV0Message();
  return new VersionedTransaction(message);
}

/** Sign + broadcast a USDC/USDT purchase. Same safety as submitPresaleBuySol. */
export async function submitPresaleBuyStablecoin(
  token: StablecoinToken,
  amountBaseUnits: bigint,
  scheme: TransparentScheme,
): Promise<{signature: string; lastValidBlockHeight: number; effectiveReferrerAddress: string | null}> {
  const mnemonic = await keychainManager.retrieveSeed();
  const seed = await mnemonicToSeed(mnemonic);
  const {secretKey} = deriveTransparentKeypair(seed, scheme);
  zeroize(seed);
  try {
    const signer = Keypair.fromSecretKey(secretKey);
    const captured = useReferralCaptureStore.getState().capturedReferrer;
    const r = await self.resolveReferrer(signer.publicKey, captured);
    const connection = getConnection();
    const priorityFee = await estimatePriorityFee(connection, 'fast');
    const {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash();
    const message = new TransactionMessage({
      payerKey: signer.publicKey,
      recentBlockhash: blockhash,
      instructions: buildStablecoinInstructions(signer.publicKey, token, amountBaseUnits, priorityFee, r),
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    tx.sign([signer]);
    const raw = tx.serialize();
    let signature: string | null = null;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        signature = await connection.sendRawTransaction(raw, {skipPreflight: false, maxRetries: 2});
        break;
      } catch (e) {
        lastErr = e;
        await new Promise(res => setTimeout(res, 800));
      }
    }
    if (signature === null) {
      throw lastErr instanceof Error ? lastErr : new Error('Failed to broadcast presale buy');
    }
    return {signature, lastValidBlockHeight, effectiveReferrerAddress: r.effectiveReferrerAddress};
  } finally {
    zeroize(secretKey);
  }
}

/**
 * Sign + broadcast the SOL purchase with the transparent keypair. Mirrors
 * submitSwap: the 64-byte secret key is zeroized in finally. skipPreflight is
 * FALSE (Helius's skipPreflight=true path is ~60s slow for program txs);
 * resending the same signed tx is idempotent (network dedups by signature).
 */
export async function submitPresaleBuySol(
  solLamports: bigint,
  scheme: TransparentScheme,
): Promise<{signature: string; lastValidBlockHeight: number; effectiveReferrerAddress: string | null}> {
  const mnemonic = await keychainManager.retrieveSeed();
  const seed = await mnemonicToSeed(mnemonic);
  const {secretKey} = deriveTransparentKeypair(seed, scheme);
  zeroize(seed);
  try {
    const signer = Keypair.fromSecretKey(secretKey);
    const captured = useReferralCaptureStore.getState().capturedReferrer;
    const r = await self.resolveReferrer(signer.publicKey, captured);
    const connection = getConnection();
    const priorityFee = await estimatePriorityFee(connection, 'fast');
    const {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash();
    const message = new TransactionMessage({
      payerKey: signer.publicKey,
      recentBlockhash: blockhash,
      instructions: buildBuyInstructions(signer.publicKey, solLamports, priorityFee, r),
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    tx.sign([signer]);
    const raw = tx.serialize();
    let signature: string | null = null;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        signature = await connection.sendRawTransaction(raw, {skipPreflight: false, maxRetries: 2});
        break;
      } catch (e) {
        lastErr = e;
        await new Promise(res => setTimeout(res, 800));
      }
    }
    if (signature === null) {
      throw lastErr instanceof Error ? lastErr : new Error('Failed to broadcast presale buy');
    }
    return {signature, lastValidBlockHeight, effectiveReferrerAddress: r.effectiveReferrerAddress};
  } finally {
    zeroize(secretKey);
  }
}
