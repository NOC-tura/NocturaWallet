import {Connection, PublicKey} from '@solana/web3.js';
import {rpcLimiter} from './rpcLimiter';
import type {TokenAccount, ParsedTransaction} from './types';
import {parseTxDetail} from './txDetail';
import type {RawParsedTx, TxDetail} from './txDetail';
import {trustedSymbol} from '../tokens/trustedSymbol';

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
 * Batch SOL balances for many owners in ONE RPC call (getMultipleAccountsInfo).
 * Returns lamports per input pubkey (0n for a null/missing account). Throws if
 * the RPC call itself fails (caller distinguishes this from a genuine 0).
 */
export async function getMultipleBalances(
  connection: Connection,
  publicKeys: PublicKey[],
): Promise<bigint[]> {
  if (publicKeys.length === 0) {
    return [];
  }
  return rpcLimiter.execute(`getMultipleBalances:${publicKeys.length}`, async () => {
    const infos = await connection.getMultipleAccountsInfo(publicKeys);
    return infos.map(info => BigInt(info?.lamports ?? 0));
  });
}

/**
 * One token program's accounts of an owner — the bare read: no limiter key and no time limit. The
 * history's source list (`historyReads.ts`, history spec §3.1) calls it under its own keys and its
 * own time limit; `getTokenAccounts` below is the dashboard's read and is unchanged.
 */
export async function tokenAccountsOf(connection: Connection, owner: PublicKey, programId: PublicKey): Promise<TokenAccount[]> {
  // getParsedTokenAccountsByOwner returns jsonParsed data with typed info,
  // avoiding manual binary decoding of SPL Token account layout.
  const response = await connection.getParsedTokenAccountsByOwner(owner, {programId});
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
}

/**
 * Get all SPL token accounts for an owner (the classic Token program).
 * Uses getParsedTokenAccountsByOwner for jsonParsed encoding (returns typed data).
 */
export async function getTokenAccounts(
  connection: Connection,
  owner: PublicKey,
): Promise<TokenAccount[]> {
  return rpcLimiter.execute(`getTokenAccounts:${owner.toBase58()}`, () => tokenAccountsOf(connection, owner, TOKEN_PROGRAM_ID));
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

export interface AccountInfoSummary {
  exists: boolean;
  executable: boolean;
}

/**
 * Minimal account lookup — whether an address exists on-chain and whether it is
 * an executable (program) account. Used by the simulation risk checks.
 */
export async function getAccountInfo(
  connection: Connection,
  publicKey: PublicKey,
): Promise<AccountInfoSummary> {
  return rpcLimiter.execute(`getAccountInfo:${publicKey.toBase58()}`, async () => {
    const info = await connection.getAccountInfo(publicKey);
    return {exists: info != null, executable: info?.executable === true};
  });
}

export type {TxDetail} from './txDetail';

/**
 * Fetch and parse a single transaction for the detail screen (#27). The parsing is `parseTxDetail`
 * (post-M1d §5) with the trusted symbol source. Returns null when the RPC has not indexed the
 * signature yet (the caller retries).
 */
export async function getTransactionDetail(connection: Connection, signature: string): Promise<TxDetail | null> {
  // R11: the cast names exactly the fields parseTxDetail reads (RawParsedTx), token balances included
  // version 1: the highest web3.js 1.99 parses; at 0 the node refuses every version-1 transaction (-32015)
  const tx = (await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 1,
  })) as unknown as RawParsedTx | null;
  if (!tx) {
    return null;
  }
  return parseTxDetail(tx, signature, trustedSymbol);
}
