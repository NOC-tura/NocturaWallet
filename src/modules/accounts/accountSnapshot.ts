/**
 * M1d spec §3.4 (plan A6): the public data of an account that is NOT the main one — its SOL, its
 * token sums per mint and the display tokens, read by address from the RPC. Never written into
 * walletStore: that slot is the main account's (forceSync, unchanged), which every main-only screen
 * reads. Both reads must succeed: a failure rejects (the screens show "—", never a 0).
 *
 * PRIVACY (review r1 I1): token metadata comes from the CACHED map only (`loadCachedMetadata`). This
 * module never asks the Noctura backend (`fetchTokenMetadata` posts a mint list to the coordinator,
 * the relayer's operator) and never writes mmkvPublic: a non-main account's holdings reach no party
 * but the RPC provider, which #17 names. (The Jupiter verified list it loads is one global list, not
 * this account's.) The held pool token is listed where private balances exist (`withPoolToken`, A11).
 */
import {PublicKey} from '@solana/web3.js';
import {getConnection} from '../solana/connection';
import {getBalance, getTokenAccounts} from '../solana/queries';
import {sumTokenBalancesByMint} from '../solana/tokenBalances';
import {NOC_MINT} from '../../constants/programs';
import {TokenManager} from '../tokens/tokenModule';
import {loadCachedMetadata} from '../tokens/tokenMetadata';
import {withPoolToken} from './poolToken';
import type {TokenMetadata} from '../../store/zustand/walletStore';

const tokenManager = new TokenManager();

export interface AccountSnapshot {
  solBalance: string;
  nocBalance: string;
  tokenBalances: Record<string, string>;
  tokens: TokenMetadata[];
}

export async function fetchAccountSnapshot(address: string): Promise<AccountSnapshot> {
  const connection = getConnection();
  const pk = new PublicKey(address);
  const [lamports, accounts] = await Promise.all([getBalance(connection, pk), getTokenAccounts(connection, pk)]);
  const tokenBalances = sumTokenBalancesByMint(accounts);
  try {
    await tokenManager.fetchVerifiedList();
  } catch {
    // the verified list is unavailable: core tokens only, as forceSync
  }
  return withPoolToken({
    solBalance: lamports.toString(),
    nocBalance: tokenBalances[NOC_MINT] ?? '0',
    tokenBalances,
    tokens: tokenManager.buildDisplayTokens(accounts, loadCachedMetadata()),
  });
}
