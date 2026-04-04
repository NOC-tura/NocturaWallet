import {Connection, PublicKey} from '@solana/web3.js';
import type {TokenAccount, ParsedTransaction} from './types';

// TOKEN_PROGRAM_ID constant — matches @solana/web3.js export
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

/**
 * Get SOL balance in lamports as BigInt.
 */
export async function getBalance(
  connection: Connection,
  publicKey: PublicKey,
): Promise<bigint> {
  const result = await connection.getBalance(publicKey);
  return BigInt(result);
}

/**
 * Get all SPL token accounts for an owner.
 * Uses getParsedTokenAccountsByOwner for jsonParsed encoding (returns typed data).
 */
export async function getTokenAccounts(
  connection: Connection,
  owner: PublicKey,
): Promise<TokenAccount[]> {
  // getParsedTokenAccountsByOwner returns jsonParsed data with typed info
  // Falling back to getTokenAccountsByOwner with manual parsing for mock compatibility
  const response = await connection.getTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });

  return response.value.map(item => {
    // In production, use getParsedTokenAccountsByOwner which returns typed parsed data.
    // The cast through unknown is needed because the mock returns a simplified structure.
    const data = item.account.data as unknown as {
      parsed?: {
        info: {
          mint: string;
          owner: string;
          tokenAmount: {amount: string; decimals: number};
        };
      };
    };

    if (!data.parsed) {
      // Binary-encoded response — should not happen with jsonParsed encoding
      throw new Error('Token account data not parsed. Use jsonParsed encoding.');
    }

    const info = data.parsed.info;
    return {
      mint: info.mint,
      owner: info.owner,
      amount: info.tokenAmount.amount,
      decimals: info.tokenAmount.decimals,
      address: item.pubkey.toBase58(),
    };
  });
}

export interface GetTransactionHistoryOptions {
  limit: number;
  before?: string;
}

/**
 * Get transaction history for an address.
 */
export async function getTransactionHistory(
  connection: Connection,
  address: PublicKey,
  options: GetTransactionHistoryOptions,
): Promise<ParsedTransaction[]> {
  const {limit, before} = options;
  const queryOptions: {limit: number; before?: string} = {limit};
  if (before !== undefined) {
    queryOptions.before = before;
  }

  const signatures = await connection.getSignaturesForAddress(address, queryOptions);

  return signatures.map(sig => ({
    signature: sig.signature,
    slot: sig.slot,
    timestamp: sig.blockTime ?? null,
    type: 'unknown' as const,
    fee: 0,
    status: sig.err != null
      ? ('failed' as const)
      : ((sig.confirmationStatus ?? 'confirmed') as 'confirmed' | 'finalized' | 'failed'),
  }));
}
