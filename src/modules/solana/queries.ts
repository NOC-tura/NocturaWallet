import {Connection, PublicKey, TOKEN_PROGRAM_ID} from '@solana/web3.js';
import type {TokenAccount, ParsedTransaction} from './types';

export async function getBalance(
  connection: Connection,
  publicKey: PublicKey,
): Promise<bigint> {
  const result = await connection.getBalance(publicKey);
  return BigInt(result);
}

export async function getTokenAccounts(
  connection: Connection,
  owner: PublicKey,
): Promise<TokenAccount[]> {
  const response = await connection.getTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });

  return response.value.map(item => {
    const info = (item.account.data as {parsed: {info: {
      mint: string;
      owner: string;
      tokenAmount: {amount: string; decimals: number};
    }}}).parsed.info;

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

  const signatures = await (connection as Connection & {
    getSignaturesForAddress: (
      address: PublicKey,
      options: {limit: number; before?: string},
    ) => Promise<Array<{
      signature: string;
      slot: number;
      blockTime: number | null;
      confirmationStatus: string | null;
      err: unknown;
    }>>;
  }).getSignaturesForAddress(address, queryOptions);

  return signatures.map(sig => ({
    signature: sig.signature,
    slot: sig.slot,
    timestamp: sig.blockTime ?? null,
    type: 'unknown' as const,
    fee: 0,
    status: sig.err != null
      ? 'failed'
      : ((sig.confirmationStatus ?? 'confirmed') as 'confirmed' | 'finalized' | 'failed'),
  }));
}
