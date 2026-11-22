/**
 * M1d spec §3.2: the selected account and the account list, observable. Before the store is
 * hydrated for this wallet the hook computes the same answer from storage (a read, nothing
 * written) and hydrates in an effect, so the first render already has the right account.
 * Screens read accounts ONLY through this module (one mock in a screen test).
 */
import {useCallback, useEffect, useMemo} from 'react';
import {useWalletStore} from '../store/zustand/walletStore';
import {readAccountsState, refreshAccounts, selectAccount, useAccountsStore} from '../modules/accounts/selectedAccount';
import type {AccountsState} from '../modules/accounts/selectedAccount';
import type {AccountList, WalletAccount} from '../modules/accounts/accountList';

export function useAccounts(): AccountsState | null {
  const mainAddress = useWalletStore(s => s.publicKey) ?? null;
  const forMain = useAccountsStore(s => s.forMain);
  const state = useAccountsStore(s => s.state);
  const hydrated = mainAddress !== null && forMain === mainAddress && state !== null;
  const view = useMemo(
    () => (hydrated ? state : mainAddress !== null ? readAccountsState(mainAddress) : null),
    [hydrated, state, mainAddress],
  );
  useEffect(() => {
    if (mainAddress !== null && !hydrated) {
      refreshAccounts(mainAddress);
    }
  }, [mainAddress, hydrated]);
  return view;
}

export function useSelectedAccount(): WalletAccount | null {
  return useAccounts()?.selected ?? null;
}

export function useAccountList(): AccountList | null {
  return useAccounts()?.list ?? null;
}

export function useSelectAccount(): (scheme: string) => boolean {
  return selectAccount;
}

export function useRefreshAccounts(): () => void {
  const mainAddress = useWalletStore(s => s.publicKey) ?? null;
  return useCallback(() => {
    refreshAccounts(mainAddress);
  }, [mainAddress]);
}
