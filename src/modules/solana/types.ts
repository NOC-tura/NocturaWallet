import type {PublicKey, VersionedTransaction, AddressLookupTableAccount} from '@solana/web3.js';

export interface TransferParams {
  sender: PublicKey;
  recipient: PublicKey;
  lamports: bigint;
  priorityFee?: number; // microlamports
}

export interface SPLTransferParams {
  sender: PublicKey;
  recipient: PublicKey;
  mint: PublicKey;
  amount: bigint; // in smallest unit
  decimals: number;
  priorityFee?: number; // microlamports
  createAta?: boolean; // create ATA if recipient doesn't have one
}

export type PriorityLevel = 'normal' | 'fast' | 'urgent';

export const PRIORITY_PERCENTILES: Record<PriorityLevel, 50 | 75 | 90> = {
  normal: 50,
  fast: 75,
  urgent: 90,
};

export interface SimulationResult {
  success: boolean;
  error?: {
    code: string;
    message: string;
    action: string;
  };
  logs?: string[];
  unitsConsumed?: number;
}

export interface SignAndSendResult {
  signature: string;
  confirmationStatus: 'processed' | 'confirmed' | 'finalized';
}

export interface TokenAccount {
  mint: string;
  owner: string;
  amount: string; // bigint as string
  decimals: number;
  address: string; // token account address
}

export interface ParsedTransaction {
  signature: string;
  slot: number;
  timestamp: number | null;
  type: 'transfer' | 'spl_transfer' | 'unknown';
  amount?: string;
  mint?: string;
  from?: string;
  to?: string;
  fee: number;
  status: 'confirmed' | 'finalized' | 'failed';
}

// Re-export library types used throughout the module so consumers can import
// from a single location rather than mixing direct @solana/web3.js imports with
// local types.
export type {PublicKey, VersionedTransaction, AddressLookupTableAccount};
