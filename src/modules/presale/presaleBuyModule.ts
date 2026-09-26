import {
  PublicKey,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
// Self-import so resolveReferrer calls fetchAllocationRef through the module's
// live export binding, which lets tests `jest.spyOn(presaleBuyModule,
// 'fetchAllocationRef')` intercept it (a direct intra-module call is NOT
// interceptable under the @react-native/babel CJS transform).
import * as self from './presaleBuyModule';
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
  buildStablecoinBuyInstructions as coreBuildStablecoinBuyInstructions,
  encodeU64LE,
  estimateNocForSol,
  REGISTER_REFERRER_DISCRIMINATOR,
} from '../../../core/presale/buyInstructions';
import {
  derivePresalePdas as coreDerivePresalePdas,
  fetchOnChainAllocation as coreFetchOnChainAllocation,
  fetchTgeTimestamp as coreFetchTgeTimestamp,
  fetchSolTreasury as coreFetchSolTreasury,
} from '../../../core/presale/allocation';

export type StablecoinToken = 'USDC' | 'USDT';

/**
 * Minimum / maximum purchase, in USD. Moved to `core/presale/purchaseGate.ts`, which also
 * records where these numbers actually come from: the program's CONFIG ACCOUNT, not its
 * constants — the on-chain minimum was lowered from $25 to $10 by an admin.
 */
export {MIN_PURCHASE_USD, MAX_PURCHASE_USD} from '../../../core/presale/purchaseGate';

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

/**
 * The treasury the program validates the purchase destination against, READ FROM CHAIN.
 *
 * Deliberately not a constant. On 2026-09-21 the program began requiring the stablecoin
 * destination to be owned by `config.sol_treasury`; this module derived it from ADMIN, so
 * every USDC/USDT purchase failed the moment the upgrade landed. A constant in a shipped
 * APK cannot be corrected — reading it from the account the program itself checks means
 * the two can never disagree. Routed through `self.` so tests can intercept it.
 */
export const fetchTreasury = () => coreFetchSolTreasury(appReader);

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
/**
 * Moved to `core/presale/buyInstructions.ts` so its address derivation can be tested for
 * real — this suite replaces `findProgramAddressSync` with a stub that keys on the first
 * 16 characters of the seed, which makes the treasury's ATA and the admin's ATA identical
 * here. That is exactly the difference the 2026-09-21 regression turned on.
 */
// Imported as well as re-exported: `export … from` does not bring the name into this
// module's own scope, and buildStablecoinInstructions below calls it.
import {buildStablecoinPurchaseInstruction} from '../../../core/presale/buyInstructions';
export {buildStablecoinPurchaseInstruction};

/** Moved to core so the web quotes the same number. */
export {estimateNocForUsd} from '../../../core/presale/buyInstructions';

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
    instructions: buildBuyInstructions(user, solLamports, 0, r, await self.fetchTreasury()),
  }).compileToV0Message();
  return new VersionedTransaction(message);
}

/** Stablecoin analogue of buildBuyInstructions — bundles register first. */
/** Moved to core, so the phone and the web build the same transaction. */
const buildStablecoinInstructions = coreBuildStablecoinBuyInstructions;

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
    instructions: buildStablecoinInstructions(user, token, amountBaseUnits, 0, r, await self.fetchTreasury()),
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
      instructions: buildStablecoinInstructions(
        signer.publicKey, token, amountBaseUnits, priorityFee, r, await self.fetchTreasury(),
      ),
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
      instructions: buildBuyInstructions(signer.publicKey, solLamports, priorityFee, r, await self.fetchTreasury()),
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
