import type {ProofWitness} from '../zkProver/types';

export interface ShieldedNote {
  commitment: string;
  nullifier: string;
  mint: string;
  amount: bigint;
  index: number;
  spent: boolean;
  createdAt: number;
}

export interface ShieldedNoteJson {
  commitment: string;
  nullifier: string;
  mint: string;
  amount: string;
  index: number;
  spent: boolean;
  createdAt: number;
}

export interface DepositParams {
  mint: string;
  amount: bigint;
  senderPubkey: string;
}

export interface ShieldedTransferParams {
  mint: string;
  amount: bigint;
  recipientAddress: string;
  memo?: string;
}

export interface WithdrawParams {
  mint: string;
  amount: bigint;
  destinationPubkey: string;
}

export interface ShieldedTxResult {
  txSignature: string;
  proofType: 'deposit' | 'transfer' | 'withdraw';
  amount: bigint;
  timestamp: number;
}

export interface CircuitConfig {
  maxInputs: number;
  maxOutputs: number;
  treeDepth: number;
}

export interface PrivacyLevel {
  level: 'low' | 'moderate' | 'good';
  message: string;
  color: 'red' | 'yellow' | 'green';
  shouldShow: boolean;
}

export type ConsolidationProgress = {
  currentStep: number;
  totalSteps: number;
};

export type ShieldedScreenStep = 'input' | 'confirm' | 'consolidating' | 'proving' | 'success' | 'error';

/**
 * Provides real witness data for ZK proof generation.
 * Implementation requires:
 * - MerkleModule for Merkle paths
 * - Native BLST bridge for noteSecret derivation from sk_view
 *
 * Until both are available, the provider is null and shielded
 * operations throw rather than silently using zero witnesses.
 */
export interface WitnessProvider {
  /**
   * Build a witness for ZK proof generation.
   *
   * For deposit: note.commitment and note.nullifier are sentinel zeros —
   * the provider MUST derive real values (not echo them through).
   *
   * For transfer/withdraw: note contains the actual commitment/nullifier
   * from the note store.
   */
  buildWitness(
    note: ShieldedNote,
    treeDepth: number,
    recipientAddress?: string,
  ): Promise<ProofWitness>;
}
