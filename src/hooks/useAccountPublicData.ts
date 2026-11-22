/**
 * M1d spec §3.4: the selected account's public balances. The MAIN account's are walletStore's (the
 * slot forceSync writes — no request here); any other account's come from the address-keyed query
 * `['accountSnapshot', address]` (the Accounts sheet shares it). Never a 0 for an unknown value:
 * `loading` / `error` are states, and NO_PUBLIC_DATA is only ever read behind a not-ready gate.
 * Only the main branch's `data` is referentially stable; the non-main branches build a new object per
 * render (consumers destructure fields; put fields, not `data`, in a dependency list).
 */
import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useWalletStore} from '../store/zustand/walletStore';
import type {TokenMetadata} from '../store/zustand/walletStore';
import {fetchAccountSnapshot} from '../modules/accounts/accountSnapshot';
import {withPoolToken} from '../modules/accounts/poolToken';

export interface PublicBalances {
  solBalance: string;
  nocBalance: string;
  tokenBalances: Record<string, string>;
  tokens: TokenMetadata[];
}

export type AccountPublicData =
  | {status: 'loading'}
  | {status: 'error'}
  | ({status: 'ready'; syncedAt: number | null} & PublicBalances);

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
    const main = withPoolToken({solBalance, nocBalance, tokenBalances, tokens});
    return {status: 'ready', ...main, syncedAt: lastSyncedAt ?? null};
  }, [isMain, solBalance, nocBalance, tokenBalances, tokens, lastSyncedAt]);
  if (account === null) {
    return {data: {status: 'loading'}, refetch};
  }
  if (mainData !== null) {
    return {data: mainData, refetch};
  }
  if (q.isError) {
    // review r1 N1 (as the Accounts sheet): a failed re-read never presents the older figure as current
    return {data: {status: 'error'}, refetch};
  }
  if (q.data) {
    return {data: {status: 'ready', ...q.data, syncedAt: q.dataUpdatedAt}, refetch};
  }
  return {data: {status: 'loading'}, refetch};
}
