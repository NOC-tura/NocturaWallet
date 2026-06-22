import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {PROGRAM_ID, ADMIN_ADDRESS, SOL_TREASURY, PYTH_SOL_USD_ACCOUNT} from '../../constants/programs';
import {findAssociatedTokenAddress} from '../solana/transactionBuilder';
import {USDC_MINT, USDT_MINT} from '../tokens/coreTokens';
import {getConnection} from '../solana/connection';
import {estimatePriorityFee} from '../solana/priorityFee';
import {KeychainManager} from '../keychain/keychainModule';
import {mnemonicToSeed} from '../keyDerivation/mnemonicUtils';
import {deriveTransparentKeypair, type TransparentScheme} from '../keyDerivation/transparent';
import {zeroize} from '../session/zeroize';

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

/**
 * Hand-build presale_purchase_with_usdc / _usdt. Payment is an SPL transfer
 * from the buyer's ATA to the ADMIN's ATA (1:1 USD, no Pyth). Account order
 * matches the program's PresalePurchaseWithStablecoin struct.
 */
export function buildStablecoinPurchaseInstruction(
  user: PublicKey,
  token: StablecoinToken,
  amountBaseUnits: bigint,
): TransactionInstruction {
  const {mint, disc} = STABLECOIN[token];
  const {config, userAccount, userAllocation, referrerAllocation} = derivePresalePdas(user);
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

function buildBuyInstructions(user: PublicKey, solLamports: bigint, priorityFeeMicroLamports: number) {
  return [
    ComputeBudgetProgram.setComputeUnitLimit({units: COMPUTE_UNIT_LIMIT}),
    ComputeBudgetProgram.setComputeUnitPrice({microLamports: priorityFeeMicroLamports}),
    buildSolPurchaseInstruction(user, solLamports),
  ];
}

/** Build the (unsigned) purchase tx for pre-submit simulation. Payer = user. */
export async function buildSolPurchaseTx(user: PublicKey, solLamports: bigint): Promise<VersionedTransaction> {
  const connection = getConnection();
  const {blockhash} = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: user,
    recentBlockhash: blockhash,
    instructions: buildBuyInstructions(user, solLamports, 0),
  }).compileToV0Message();
  return new VersionedTransaction(message);
}

function buildStablecoinInstructions(
  user: PublicKey,
  token: StablecoinToken,
  amountBaseUnits: bigint,
  priorityFeeMicroLamports: number,
) {
  return [
    ComputeBudgetProgram.setComputeUnitLimit({units: COMPUTE_UNIT_LIMIT}),
    ComputeBudgetProgram.setComputeUnitPrice({microLamports: priorityFeeMicroLamports}),
    buildStablecoinPurchaseInstruction(user, token, amountBaseUnits),
  ];
}

/** Unsigned stablecoin purchase tx for pre-submit simulation. Payer = user. */
export async function buildStablecoinPurchaseTx(
  user: PublicKey,
  token: StablecoinToken,
  amountBaseUnits: bigint,
): Promise<VersionedTransaction> {
  const connection = getConnection();
  const {blockhash} = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: user,
    recentBlockhash: blockhash,
    instructions: buildStablecoinInstructions(user, token, amountBaseUnits, 0),
  }).compileToV0Message();
  return new VersionedTransaction(message);
}

/** Sign + broadcast a USDC/USDT purchase. Same safety as submitPresaleBuySol. */
export async function submitPresaleBuyStablecoin(
  token: StablecoinToken,
  amountBaseUnits: bigint,
  scheme: TransparentScheme,
): Promise<{signature: string; lastValidBlockHeight: number}> {
  const mnemonic = await keychainManager.retrieveSeed();
  const seed = await mnemonicToSeed(mnemonic);
  const {secretKey} = deriveTransparentKeypair(seed, scheme);
  zeroize(seed);
  try {
    const signer = Keypair.fromSecretKey(secretKey);
    const connection = getConnection();
    const priorityFee = await estimatePriorityFee(connection, 'fast');
    const {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash();
    const message = new TransactionMessage({
      payerKey: signer.publicKey,
      recentBlockhash: blockhash,
      instructions: buildStablecoinInstructions(signer.publicKey, token, amountBaseUnits, priorityFee),
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
        await new Promise(r => setTimeout(r, 800));
      }
    }
    if (signature === null) {
      throw lastErr instanceof Error ? lastErr : new Error('Failed to broadcast presale buy');
    }
    return {signature, lastValidBlockHeight};
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
): Promise<{signature: string; lastValidBlockHeight: number}> {
  const mnemonic = await keychainManager.retrieveSeed();
  const seed = await mnemonicToSeed(mnemonic);
  const {secretKey} = deriveTransparentKeypair(seed, scheme);
  zeroize(seed);
  try {
    const signer = Keypair.fromSecretKey(secretKey);
    const connection = getConnection();
    const priorityFee = await estimatePriorityFee(connection, 'fast');
    const {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash();
    const message = new TransactionMessage({
      payerKey: signer.publicKey,
      recentBlockhash: blockhash,
      instructions: buildBuyInstructions(signer.publicKey, solLamports, priorityFee),
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
        await new Promise(r => setTimeout(r, 800));
      }
    }
    if (signature === null) {
      throw lastErr instanceof Error ? lastErr : new Error('Failed to broadcast presale buy');
    }
    return {signature, lastValidBlockHeight};
  } finally {
    zeroize(secretKey);
  }
}
