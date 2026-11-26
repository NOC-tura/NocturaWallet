/**
 * M1d spec §3.4: the selected account's public balances. The MAIN account's are walletStore's (the
 * slot forceSync writes — no request here); any other account's come from the address-keyed query
 * `['accountSnapshot', address]` (the Accounts sheet shares it). Never a 0 for an unknown value:
 * `loading` / `error` are states, `stale` is the last figure with its age (post-M1d §3.1; never to be drawn
 * as current), and NO_PUBLIC_DATA is only ever read behind a not-ready gate.
 * Only the main branch's `data` is referentially stable; the non-main branches build a new object per
 * render (consumers destructure fields; put fields, not `data`, in a dependency list).
 */
import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useWalletStore} from '../store/zustand/walletStore';
import type {TokenMetadata} from '../store/zustand/walletStore';
import {fetchAccountSnapshot} from '../modules/accounts/accountSnapshot';
import {withPoolToken} from '../modules/accounts/poolToken';
import {mainBalanceIsStale, mainBalanceIsUnknown} from '../modules/accounts/staleness';

export interface PublicBalances {
  solBalance: string;
  nocBalance: string;
  tokenBalances: Record<string, string>;
  tokens: TokenMetadata[];
}

export type AccountPublicData =
  | {status: 'loading'}
  | {status: 'error'}
  | ({status: 'ready'; syncedAt: number | null} & PublicBalances)
  | ({status: 'stale'; syncedAt: number; failedAt: number} & PublicBalances);

export const NO_PUBLIC_DATA: PublicBalances = {solBalance: '0', nocBalance: '0', tokenBalances: {}, tokens: []};

export const ACCOUNT_SNAPSHOT_KEY = 'accountSnapshot';

export function useAccountPublicData(account: {address: string; isMain: boolean} | null): {
  data: AccountPublicData;
  /** resolves when the selected non-main account's read settled (at once for main): false when that read failed */
  refetch: () => Promise<boolean>;
} {
  // field selectors (review m3): a walletStore write to an unrelated field (prices) does not re-render here
  const solBalance = useWalletStore(s => s.solBalance);
  const nocBalance = useWalletStore(s => s.nocBalance);
  const tokenBalances = useWalletStore(s => s.tokenBalances);
  const tokens = useWalletStore(s => s.tokens);
  const lastSyncedAt = useWalletStore(s => s.lastSyncedAt);
  const lastSyncFailedAt = useWalletStore(s => s.lastSyncFailedAt);
  const other = account !== null && !account.isMain ? account.address : null;
  const isMain = account !== null && account.isMain;
  const q = useQuery({
    queryKey: [ACCOUNT_SNAPSHOT_KEY, other],
    queryFn: () => fetchAccountSnapshot(other ?? ''),
    enabled: other !== null,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
  });
  const refetch = (): Promise<boolean> =>
    other !== null
      ? q.refetch({cancelRefetch: false}).then(
          r => !r.isError,
          () => false,
        ) // review r1 m11: never cancels a read in flight
      : Promise.resolve(true);
  // plan A11: the main account's held pool token is listed too (display only; walletStore unchanged).
  // Memoised: the object is referentially stable across renders while walletStore's values are.
  const mainData = useMemo<AccountPublicData | null>(() => {
    if (!isMain) return null;
    // controller ruling 2026-11-22 + review r1-1: a main account never read is never 'ready' — the store
    // holds defaults ('0'), not a balance. No failed sync yet → loading; a failed one → error. (The same two
    // states a non-main account has before its first read.)
    if (lastSyncedAt === null) {
      return mainBalanceIsUnknown(lastSyncedAt, lastSyncFailedAt) ? {status: 'error'} : {status: 'loading'};
    }
    const main = withPoolToken({solBalance, nocBalance, tokenBalances, tokens});
    // post-M1d §3.1: this session's last sync failed and an older good read exists → the figure is stale
    // (the `!== null` only narrows lastSyncFailedAt to number for the type; mainBalanceIsStale is not a type guard)
    if (lastSyncFailedAt !== null && mainBalanceIsStale(lastSyncedAt, lastSyncFailedAt)) {
      return {status: 'stale', ...main, syncedAt: lastSyncedAt, failedAt: lastSyncFailedAt};
    }
    return {status: 'ready', ...main, syncedAt: lastSyncedAt};
  }, [isMain, solBalance, nocBalance, tokenBalances, tokens, lastSyncedAt, lastSyncFailedAt]);
  if (account === null) {
    return {data: {status: 'loading'}, refetch};
  }
  if (mainData !== null) {
    return {data: mainData, refetch};
  }
  if (q.isError) {
    // post-M1d §3.1 / R5: a failed re-read keeps the figure read earlier in THIS session (the query cache,
    // gcTime 5 min) and marks it stale — never as current. With nothing cached there is no figure: error.
    if (q.data) {
      return {data: {status: 'stale', ...q.data, syncedAt: q.dataUpdatedAt, failedAt: q.errorUpdatedAt}, refetch};
    }
    return {data: {status: 'error'}, refetch};
  }
  if (q.data) {
    return {data: {status: 'ready', ...q.data, syncedAt: q.dataUpdatedAt}, refetch};
  }
  return {data: {status: 'loading'}, refetch};
}
