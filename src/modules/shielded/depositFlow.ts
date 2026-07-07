import {PublicKey, type Keypair} from '@solana/web3.js';
import {getConnection} from '../solana/connection';
import {proveShielded} from '../zkProver/zkProverModule';
import {buildDepositNote} from './depositWitness';
import {buildDepositIx} from './poolInstructions';
import {submitPoolTx} from './poolTx';
import {poolPda, merkleTreePda, vaultAta} from './poolPdas';
import {resolveSourceTokenAccount} from '../solana/transactionBuilder';
import {addNote} from './noteStore';
import {resolveLeafIndex} from './leafResolver';
import {SHIELDED_CU} from '../../constants/programs';
import {mmkvSecure, initSecureMmkv} from '../../store/mmkv/instances';
import {deriveSecureStorageKey} from '../keychain/secureStorageKey';

const PROOF_BYTES_LEN = 256;

/**
 * Ensure the encrypted (secure) MMKV is initialized before the note store is
 * used. The app never wired initSecureMmkv() anywhere (it was designed but
 * unwired — see store/mmkv/instances.ts + walletStore comment), so the first
 * real noteStore consumer (the shield deposit) must initialize it. The
 * encryption key is derived DETERMINISTICALLY from the seed (sha256(seed ||
 * domain), first 16 bytes) so notes persist + decrypt across sessions and are
 * recoverable from the mnemonic. Idempotent: no-op if already initialized.
 *
 * NOTE: the proper fix wires this at unlock/onboarding for ALL secure-MMKV
 * consumers; this deposit-flow guard unblocks the shield path.
 */
function ensureSecureMmkv(seed: Uint8Array): void {
  if (mmkvSecure()) return;
  initSecureMmkv(deriveSecureStorageKey(seed));
}

/** Decimal field-element string -> 32-byte big-endian Uint8Array. */
function decToBe32(dec: string): Uint8Array {
  let v = BigInt(dec);
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {out[i] = Number(v & 0xffn); v >>= 8n;}
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/**
 * Parse leaf_index from the Deposit event in the tx log messages.
 * Anchor event layout: 8-byte disc + commitment[32] + leaf_index(u64 LE) + root[32].
 * Returns the leaf index as a number (safe: tree has < 2^20 leaves).
 */
export function parseDepositLeafIndex(logs: string[]): number {
  for (const line of logs) {
    const m = line.match(/^Program data: (.+)$/);
    if (!m) continue;
    const buf = Buffer.from(m[1]!, 'base64');
    if (buf.length < 8 + 32 + 8 + 32) continue;
    let idx = 0n;
    for (let i = 0; i < 8; i++) idx |= BigInt(buf[8 + 32 + i]!) << BigInt(8 * i);
    return Number(idx);
  }
  throw new Error('Deposit event not found in transaction logs');
}

export interface DepositResult {txSignature: string; leafIndex: number; amount: bigint;}

/**
 * Shield `amount` of `mint` into the pool. Self-relay: the transparent keypair is
 * the depositor + fee_payer. Stores the real note with its on-chain leaf_index.
 */
export async function depositShield(
  seed: Uint8Array,
  feePayer: Keypair,
  mintBase58: string,
  amount: bigint,
  onStep?: (label: string, detail?: string) => void,
): Promise<DepositResult> {
  const mint = new PublicKey(mintBase58);
  // The note store writes to the encrypted MMKV — make sure it's initialized
  // (the app never wired initSecureMmkv elsewhere). Seed-derived key, idempotent.
  ensureSecureMmkv(seed);
  onStep?.('1/4 building note…');
  const {params, note} = buildDepositNote(seed, amount, mint);

  onStep?.('2/4 proving…');
  const proof = await proveShielded('deposit', params);
  const proofBytes = hexToBytes(proof.proofBytes);
  if (proofBytes.length !== PROOF_BYTES_LEN) {
    throw new Error(`proofBytes must be ${PROOF_BYTES_LEN} bytes`);
  }

  const pool = poolPda(mint);
  const connection = getConnection();
  const depositorTokenAccount = await resolveSourceTokenAccount(
    connection, feePayer.publicKey, mint);
  if (!depositorTokenAccount) {
    throw new Error('No token account holds the mint to shield');
  }

  const ix = buildDepositIx({
    amount,
    commitment: decToBe32(note.commitment),
    proofBytes,
    pool,
    merkleTree: merkleTreePda(pool),
    vault: vaultAta(pool, mint),
    depositor: feePayer.publicKey,
    depositorTokenAccount,
  });

  onStep?.('3/4 submitting…');
  const txSignature = await submitPoolTx(ix, SHIELDED_CU.deposit, feePayer);

  // submitPoolTx confirmed the tx via HTTP polling (which also surfaces on-chain
  // errors), so the deposit already succeeded. Do NOT block on a plain
  // getTransaction to read the leaf index (an unbounded RN fetch on a
  // just-confirmed tx hung the shield here) — resolve it time-bounded, with a
  // sentinel backfilled on spend if the RPC can't surface it promptly.
  onStep?.('4/4 recording…');
  const leafIndex = await resolveLeafIndex(txSignature, note.commitment, mintBase58);

  addNote({
    commitment: note.commitment,
    nullifier: '', // computed at withdraw time from noteSecret + leafIndex
    mint: mintBase58,
    amount,
    index: leafIndex, // may be UNRESOLVED_INDEX; backfilled when spent
    spent: false,
    createdAt: Date.now(),
    noteSecret: note.noteSecret,
  });

  return {txSignature, leafIndex, amount};
}
