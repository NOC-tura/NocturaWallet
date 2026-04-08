import {Connection, PublicKey} from '@solana/web3.js';
import {rpcLimiter} from './rpcLimiter';
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
  return rpcLimiter.execute(`getBalance:${publicKey.toBase58()}`, async () => {
    const result = await connection.getBalance(publicKey);
    return BigInt(result);
  });
}

/**
 * Get all SPL token accounts for an owner.
 * Uses getParsedTokenAccountsByOwner for jsonParsed encoding (returns typed data).
 */
export async function getTokenAccounts(
  connection: Connection,
  owner: PublicKey,
): Promise<TokenAccount[]> {
  return rpcLimiter.execute(`getTokenAccounts:${owner.toBase58()}`, async () => {
    // getParsedTokenAccountsByOwner returns jsonParsed data with typed info,
    // avoiding manual binary decoding of SPL Token account layout.
    const response = await connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_PROGRAM_ID,
    });

    return response.value.map(item => {
      const info = item.account.data.parsed.info as {
        mint: string;
        owner: string;
        tokenAmount: {amount: string; decimals: number};
      };
      return {
        mint: info.mint,
        owner: info.owner,
        amount: info.tokenAmount.amount,
        decimals: info.tokenAmount.decimals,
        address: item.pubkey.toBase58(),
      };
    });
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
  // Include 'before' cursor in key so paginated calls are not deduplicated
  const cursorKey = before ?? 'head';
  return rpcLimiter.execute(
    `getTransactionHistory:${address.toBase58()}:${limit}:${cursorKey}`,
    async () => {
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
    },
  );
}
