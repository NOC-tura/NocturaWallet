import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {PublicKey, SystemProgram, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
import type {Ext} from '../../ext';
import type {SessionAccount} from '../../vault/accounts';
import type {SimulationOutcome, SolanaReader} from '../../../../core/solana/rpc';
import {setSession} from '../session';
import type {PendingRecord} from '../pendingStore';
import {fakeReader} from './fakeDeps';

/** A real Ed25519 keypair (32 × 0x01 seed): its address is AKnL4NNf3DGWZJS6cPknBuEGnVsV4A4m5tgebLHaRSZ9. */
export const SEED = new Uint8Array(32).fill(1);
export const PUB = ed25519.getPublicKey(SEED);
export const ACCOUNT: SessionAccount = {index: 0, publicKey: base58.encode(PUB), secretKey: base64.encode(new Uint8Array([...SEED, ...PUB]))};
export const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
/** Any 32-byte base58 value serves as a blockhash here. */
export const BLOCKHASH = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
export const HOLDING_SMALL = '4G8U5nQtNciNaEL7Zimb4DhqeanDMevXp7MLtFvUojwF';
export const HOLDING_LARGE = 'FpV5mr137k3GfLJqqWnZer12v2KxZfEEQzxXb6sJLABU';

export async function unlocked(ext: Ext): Promise<void> {
  await setSession(ext, [ACCOUNT]);
}

const SYSTEM = '11111111111111111111111111111111';
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ATA = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
export const SIMULATED_SLOT = 271_408_921;
const u64 = (d: Uint8Array, at: number) => new DataView(d.buffer, d.byteOffset, d.byteLength).getBigUint64(at, true);

/** An SPL token account's 165 bytes: mint, owner, amount (u64 LE at 64). */
export function tokenAccountData(mint: string, owner: string, amount: bigint): Uint8Array {
  const d = new Uint8Array(165);
  d.set(base58.decode(mint), 0);
  d.set(base58.decode(owner), 32);
  new DataView(d.buffer).setBigUint64(64, amount, true);
  return d;
}

/**
 * What a node's simulateTransaction answers for these bytes: the requested accounts after the
 * transaction ran, WITHOUT the network fee (the E2 check accepts either form). System transfers and a
 * recipient token account's rent leave the payer; a TransferChecked leaves its source. `lamports` is the
 * payer's balance before; `holdings` maps a token account to its amount before.
 */
export function simulateAgainst(txBase64: string, addresses: readonly string[], lamports: bigint, holdings: Map<string, {mint: string; amount: bigint}>): SimulationOutcome {
  const message = VersionedTransaction.deserialize(base64.decode(txBase64)).message;
  const keys = message.staticAccountKeys.map(k => k.toBase58());
  const payer = keys[0] ?? '';
  let solOut = 0n;
  const tokenOut = new Map<string, bigint>();
  for (const ix of message.compiledInstructions) {
    const program = keys[ix.programIdIndex];
    const at = (i: number) => keys[ix.accountKeyIndexes[i] ?? -1] ?? '';
    if (program === SYSTEM && ix.data[0] === 2 && at(0) === payer) solOut += u64(ix.data, 4);
    if (program === ATA && at(0) === payer) solOut += 2_039_280n;
    if (program === TOKEN && ix.data[0] === 12) tokenOut.set(at(0), (tokenOut.get(at(0)) ?? 0n) + u64(ix.data, 1));
  }
  const accounts = addresses.map(address => {
    if (address === payer) return {lamports: lamports - solOut, owner: SYSTEM, data: new Uint8Array(0)};
    const h = holdings.get(address);
    if (h === undefined) return null;
    return {lamports: 2_039_280n, owner: TOKEN, data: tokenAccountData(h.mint, payer, h.amount - (tokenOut.get(address) ?? 0n))};
  });
  return {err: null, logs: [], unitsConsumed: 450, slot: SIMULATED_SLOT, accounts: addresses.length === 0 ? null : accounts};
}

/**
 * The reads a SOL send makes: quiet fees, blockhash valid to height 1000, 10 SOL, the recipient an
 * existing wallet, and a simulation consistent with the transaction (E2) — computed from the reader's
 * own balance and token accounts, so an override of either stays consistent.
 */
export function sendReader(overrides: Partial<SolanaReader> = {}): SolanaReader {
  const reader = fakeReader({
    getRecentPrioritizationFees: async () => [],
    getLatestBlockhash: async () => ({blockhash: BLOCKHASH, lastValidBlockHeight: 1000}),
    getBalance: async () => 10_000_000_000n,
    // The recipient's system account exists (a new one must receive ≥ 890 880 lamports — M4).
    getAccountExists: async () => true,
    getAccountKind: async () => 'wallet',
    ...overrides,
  });
  if (overrides.simulateTransaction !== undefined) return reader;
  return {...reader, simulateTransaction: (tx, opts) => consistentSimulation(reader, tx, opts?.accounts ?? [])};
}

/** simulateAgainst with the balance and holdings `reader` reports for ACCOUNT. */
export async function consistentSimulation(reader: SolanaReader, tx: string, addresses: readonly string[]): Promise<SimulationOutcome> {
  const holdings = new Map<string, {mint: string; amount: bigint}>();
  if (addresses.length > 1) {
    for (const h of await reader.getTokenAccountsByOwner(ACCOUNT.publicKey, {programId: TOKEN})) holdings.set(h.pubkey, {mint: h.mint, amount: h.amount});
  }
  return simulateAgainst(tx, addresses, await reader.getBalance(ACCOUNT.publicKey), holdings);
}

/** A pending record with every field set; override what a test is about. */
export const pendingRecord = (over: Partial<PendingRecord> = {}): PendingRecord => ({
  id: 'r1',
  account: 'A',
  signature: 's1',
  wire: 'AQ==',
  lastValidBlockHeight: 1000,
  createdAt: 0,
  lastSentAt: 0,
  state: 'pending',
  detail: null,
  intent: {token: 'SOL', recipient: 'R', amount: '1'},
  expiryNullSeenAt: null,
  ...over,
});

/** A signed v0 transfer from ACCOUNT; `lamports` varies it so two wires differ. */
export function signedWire(lamports = 1n): Uint8Array {
  const payer = new PublicKey(ACCOUNT.publicKey);
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: BLOCKHASH,
    instructions: [SystemProgram.transfer({fromPubkey: payer, toPubkey: new PublicKey(RECIPIENT), lamports})],
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  tx.addSignature(payer, ed25519.sign(message.serialize(), SEED));
  return tx.serialize();
}
