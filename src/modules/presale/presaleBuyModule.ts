import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {base58} from '@scure/base';
// Self-import so resolveReferrer calls fetchAllocationRef through the module's
// live export binding, which lets tests `jest.spyOn(presaleBuyModule,
// 'fetchAllocationRef')` intercept it (a direct intra-module call is NOT
// interceptable under the @react-native/babel CJS transform).
import * as self from './presaleBuyModule';
import {PROGRAM_ID, ADMIN_ADDRESS, SOL_TREASURY, PYTH_SOL_USD_ACCOUNT} from '../../constants/programs';
import {findAssociatedTokenAddress} from '../solana/transactionBuilder';
import {USDC_MINT, USDT_MINT} from '../tokens/coreTokens';
import {getConnection} from '../solana/connection';
import {estimatePriorityFee} from '../solana/priorityFee';
import {KeychainManager} from '../keychain/keychainModule';
import {mnemonicToSeed} from '../keyDerivation/mnemonicUtils';
import {deriveTransparentKeypair, type TransparentScheme} from '../keyDerivation/transparent';
import {zeroize} from '../session/zeroize';
import {useReferralCaptureStore} from '../../store/zustand/referralCaptureStore';

const PROGRAM = new PublicKey(PROGRAM_ID);
const ADMIN = new PublicKey(ADMIN_ADDRESS);
const PYTH = new PublicKey(PYTH_SOL_USD_ACCOUNT);
const TREASURY = new PublicKey(SOL_TREASURY);

// Anchor 8-byte discriminator for `presale_purchase_with_sol`.
const PURCHASE_WITH_SOL_DISCRIMINATOR = [161, 153, 65, 238, 160, 236, 43, 165];

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

// PresaleAllocation account layout: 8-byte Anchor discriminator + user Pubkey
// (32) → `total_tokens` (u64 LE) at offset 40. This is the AUTHORITATIVE,
// claimable allocation (already includes any referral bonus) — the value the
// website reads. The coordinator's recorded-purchase sum is only approximate.
const ALLOCATION_TOTAL_TOKENS_OFFSET = 40;

/**
 * Read the user's authoritative on-chain presale allocation (`total_tokens`,
 * 9-dec base units) from the `["allocation", user]` PDA. This matches the
 * website and what's actually claimable at TGE; prefer it over the coordinator
 * DB sum. Returns 0 / exists:false when the user has no allocation account.
 */
export async function fetchOnChainAllocation(
  user: PublicKey,
): Promise<{totalTokensBase: string; exists: boolean}> {
  const {userAllocation} = derivePresalePdas(user);
  const info = await getConnection().getAccountInfo(userAllocation);
  if (!info || !info.data || info.data.length < ALLOCATION_TOTAL_TOKENS_OFFSET + 8) {
    return {totalTokensBase: '0', exists: false};
  }
  const data = info.data;
  let total = 0n;
  for (let i = 7; i >= 0; i--) {
    total = (total << 8n) | BigInt(data[ALLOCATION_TOTAL_TOKENS_OFFSET + i]);
  }
  return {totalTokensBase: total.toString(), exists: true};
}

// ===========================================================================
// Referral (B1): register_referrer instruction + allocation read + resolve
// ===========================================================================

/** Anchor 8-byte discriminator for `register_referrer(referrer: Pubkey)`. */
export const REGISTER_REFERRER_DISCRIMINATOR = [122, 229, 215, 169, 100, 145, 198, 120];

/**
 * Hand-build the `register_referrer(referrer)` instruction. Both PDAs are
 * `init_if_needed` (payer = user), so this works on a fresh wallet. Account
 * order matches the program's RegisterReferrer struct: user_account(w),
 * user_allocation(w), user(signer,w), system_program. The referrer wallet
 * address is the instruction ARG (32 bytes appended to the discriminator), not
 * an account.
 */
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

// PresaleAllocation layout (117 bytes): purchase_count (u32 LE) @56, referrer
// (32 bytes) @84. See spec §"PresaleAllocation layout".
const ALLOC_PURCHASE_COUNT_OFFSET = 56;
const ALLOC_REFERRER_OFFSET = 84;
const ALLOCATION_MIN_LEN = 116;

/**
 * Read the buyer's on-chain `PresaleAllocation` referral fields: whether the
 * account exists, its current `referrer` (null when the 32 bytes are all zero /
 * the default key), and `purchase_count`. Used by `resolveReferrer` to decide
 * whether to bundle a one-time `register_referrer` and which
 * `referrer_allocation` to pass.
 */
export async function fetchAllocationRef(
  user: PublicKey,
): Promise<{exists: boolean; referrer: string | null; purchaseCount: number}> {
  const {userAllocation} = derivePresalePdas(user);
  const info = await getConnection().getAccountInfo(userAllocation);
  if (!info || !info.data || info.data.length < ALLOCATION_MIN_LEN) {
    return {exists: false, referrer: null, purchaseCount: 0};
  }
  const data = info.data;
  // u32 LE — `* 2**24` (not `<< 24`) so the high byte never flips the sign.
  const purchaseCount =
    data[ALLOC_PURCHASE_COUNT_OFFSET] |
    (data[ALLOC_PURCHASE_COUNT_OFFSET + 1] << 8) |
    (data[ALLOC_PURCHASE_COUNT_OFFSET + 2] << 16) |
    data[ALLOC_PURCHASE_COUNT_OFFSET + 3] * 2 ** 24;
  const referrerBytes = data.subarray(ALLOC_REFERRER_OFFSET, ALLOC_REFERRER_OFFSET + 32);
  let allZero = true;
  for (let i = 0; i < 32; i++) {
    if (referrerBytes[i] !== 0) {
      allZero = false;
      break;
    }
  }
  const referrer = allZero ? null : new PublicKey(referrerBytes).toBase58();
  return {exists: true, referrer, purchaseCount};
}

/**
 * Validate a captured referrer string as a real 32-byte base58 pubkey that is
 * neither the buyer (self-referral) nor the default/all-zero key. Mirrors the
 * base58-decode + 32-byte-length check used by `parseReferralInput` — the
 * canonical check works regardless of the PublicKey implementation.
 */
function captureIsValid(captured: string | null, user: PublicKey): boolean {
  if (captured === null) {
    return false;
  }
  let decoded: Uint8Array;
  try {
    decoded = base58.decode(captured);
  } catch {
    return false;
  }
  if (decoded.length !== 32) {
    return false;
  }
  return captured !== user.toBase58() && captured !== PublicKey.default.toBase58();
}

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
export async function resolveReferrer(
  user: PublicKey,
  capturedReferrer: string | null,
): Promise<{
  referrerAllocation: PublicKey;
  registerReferrer: PublicKey | null;
  effectiveReferrerAddress: string | null;
}> {
  const a = await self.fetchAllocationRef(user);
  const onChainReferrer = a.exists && a.referrer ? a.referrer : null;
  const capturedValid = captureIsValid(capturedReferrer, user);
  const isFirstPurchase = !a.exists || a.purchaseCount === 0;

  const registerReferrer =
    !onChainReferrer && capturedValid && isFirstPurchase
      ? new PublicKey(capturedReferrer as string)
      : null;
  const effective: PublicKey | null =
    registerReferrer ?? (onChainReferrer ? new PublicKey(onChainReferrer) : null);

  const [referrerAllocation] = PublicKey.findProgramAddressSync(
    [Buffer.from('allocation'), (effective ?? PublicKey.default).toBytes()],
    PROGRAM,
  );
  return {
    referrerAllocation,
    registerReferrer,
    effectiveReferrerAddress: effective?.toBase58() ?? null,
  };
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

/** UI estimate only — actual NOC is computed on-chain from the Pyth SOL/USD price. */
export function estimateNocForSol(solAmount: number, solUsd: number, stagePriceUsd: number): number {
  if (stagePriceUsd <= 0) {
    return 0;
  }
  return (solAmount * solUsd) / stagePriceUsd;
}

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
const COMPUTE_UNIT_LIMIT = 120_000;

/**
 * Assemble the full SOL-purchase instruction list, bundling a one-time
 * `register_referrer` FIRST (when `resolveReferrer` says so) so the purchase
 * reads the just-set referrer, and passing the resolved `referrerAllocation` to
 * the purchase. The no-referrer path (registerReferrer == null,
 * referrerAllocation == default PDA) is byte-identical to the pre-referral
 * single-purchase tx.
 */
function buildBuyInstructions(
  user: PublicKey,
  solLamports: bigint,
  priorityFeeMicroLamports: number,
  resolved: {referrerAllocation: PublicKey; registerReferrer: PublicKey | null},
) {
  return [
    ComputeBudgetProgram.setComputeUnitLimit({units: COMPUTE_UNIT_LIMIT}),
    ComputeBudgetProgram.setComputeUnitPrice({microLamports: priorityFeeMicroLamports}),
    ...(resolved.registerReferrer
      ? [buildRegisterReferrerInstruction(user, resolved.registerReferrer)]
      : []),
    buildSolPurchaseInstruction(user, solLamports, resolved.referrerAllocation),
  ];
}

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
