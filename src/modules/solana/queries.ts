import {Connection, PublicKey} from '@solana/web3.js';
import {rpcLimiter} from './rpcLimiter';
import type {TokenAccount, ParsedTransaction} from './types';
import {NOC_MINT, NOCTURA_FEE_TREASURY} from '../../constants/programs';
import {formatTokenAmount} from '../../utils/parseTokenAmount';

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

export interface TxDetail {
  signature: string;
  status: 'confirmed' | 'finalized' | 'failed';
  type: string; // 'Send' | 'Transaction'
  from: string;
  to: string | null;
  amount: string | null; // human
  tokenSymbol: string; // 'SOL' | 'NOC' | ''
  feeLamports: bigint;
  slot: number;
  blockTime: number | null;
  memo: string | null;
}

/**
 * Fetch and parse a single transaction for the detail screen. Best-effort —
 * missing fields stay null/'' rather than throwing. Returns null when the RPC
 * has not indexed the signature yet (caller retries).
 */
export async function getTransactionDetail(
  connection: Connection,
  signature: string,
): Promise<TxDetail | null> {
  const tx = (await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
  })) as null | {
    slot?: number;
    blockTime?: number | null;
    meta?: {fee?: number; err?: unknown} | null;
    transaction?: {message?: {accountKeys?: Array<{pubkey?: unknown}>; instructions?: unknown[]}};
  };
  if (!tx) return null;

  const meta = tx.meta ?? {};
  const keys = tx.transaction?.message?.accountKeys ?? [];
  const firstKey = keys[0]?.pubkey as unknown;
  const from =
    typeof firstKey === 'string'
      ? firstKey
      : (firstKey as {toString?: () => string})?.toString?.() ?? '';

  let to: string | null = null;
  let amount: string | null = null;
  let tokenSymbol = '';
  let type = 'Transaction';
  let memo: string | null = null;

  const instructions = (tx.transaction?.message?.instructions ?? []) as Array<{
    program?: string;
    parsed?: {type?: string; info?: Record<string, unknown>} | string;
  }>;

  for (const ix of instructions) {
    if (ix.program === 'spl-memo') {
      memo =
        typeof ix.parsed === 'string'
          ? ix.parsed
          : ((ix.parsed?.info as unknown as string) ?? memo);
      continue;
    }
    if (to) continue;
    const parsed = typeof ix.parsed === 'object' ? ix.parsed : undefined;
    const info = parsed?.info ?? {};
    const destination = info.destination as string | undefined;
    if (!destination || destination === NOCTURA_FEE_TREASURY) continue;

    if (ix.program === 'system' && parsed?.type === 'transfer') {
      to = destination;
      amount = formatTokenAmount(BigInt((info.lamports as number) ?? 0), 9);
      tokenSymbol = 'SOL';
      type = 'Send';
    } else if (
      ix.program === 'spl-token' &&
      (parsed?.type === 'transferChecked' || parsed?.type === 'transfer')
    ) {
      to = destination; // NOTE: SPL destination is the recipient ATA, not the owner wallet (v1 limitation)
      const ta = info.tokenAmount as {uiAmountString?: string; amount?: string} | undefined;
      amount = ta?.uiAmountString ?? ta?.amount ?? null;
      tokenSymbol = info.mint === NOC_MINT ? 'NOC' : '';
      type = 'Send';
    }
  }

  return {
    signature,
    status: meta.err ? 'failed' : 'confirmed',
    type,
    from,
    to,
    amount,
    tokenSymbol,
    feeLamports: BigInt(meta.fee ?? 0),
    slot: tx.slot ?? 0,
    blockTime: tx.blockTime ?? null,
    memo,
  };
}
