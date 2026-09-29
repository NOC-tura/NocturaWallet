import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {PublicKey, SystemProgram, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
import type {Ext} from '../../ext';
import type {SessionAccount} from '../../vault/accounts';
import type {SolanaReader} from '../../../../core/solana/rpc';
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

/** The reads a SOL send makes: quiet fees, blockhash valid to height 1000, 10 SOL, simulation passes. */
export function sendReader(overrides: Partial<SolanaReader> = {}): SolanaReader {
  return fakeReader({
    getRecentPrioritizationFees: async () => [],
    getLatestBlockhash: async () => ({blockhash: BLOCKHASH, lastValidBlockHeight: 1000}),
    getBalance: async () => 10_000_000_000n,
    simulateTransaction: async () => ({err: null, logs: [], unitsConsumed: 450}),
    // The recipient's system account exists (a new one must receive ≥ 890 880 lamports — M4).
    getAccountExists: async () => true,
    ...overrides,
  });
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
