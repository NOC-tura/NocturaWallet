/**
 * M1d spec §3.2: the selected account. Stored in the ENCRYPTED MMKV only (a choice among one's own
 * accounts is itself a link, M1 spec I6) as the scheme string; held in memory in a Zustand store,
 * hydrated by `refreshAccounts`. Default main; a stored scheme that is not listed falls back to
 * main silently and is rewritten — only when the registry was read (plan A4).
 *
 * walletStore.publicKey is NEVER changed here (approach 1): every main-only consumer keeps reading
 * it. A wipe + import replaces the encrypted instance; its reset hook clears this store (Review
 * Focus 5), so the next read starts from the new wallet.
 */
import {create} from 'zustand';
import {mmkvSecure, onSecureMmkvReset} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {loadTransparentScheme} from '../keyDerivation/derivationScheme';
import {loadA0AccountRegistry} from '../shielded/a0/accountRegistry';
import {buildAccountList} from './accountList';
import type {AccountList, WalletAccount} from './accountList';

export interface AccountsState {
  list: AccountList;
  selected: WalletAccount;
}

interface AccountsStore {
  /** the main address the state was read for (walletStore.publicKey then) */
  forMain: string | null;
  state: AccountsState | null;
}

export const useAccountsStore = create<AccountsStore>()(() => ({forMain: null, state: null}));

const KEY = MMKV_KEYS.ACCOUNTS_SELECTED;

export function readAccountList(mainAddress: string): AccountList {
  return buildAccountList(mainAddress, loadTransparentScheme(), () => loadA0AccountRegistry());
}

export function resolveSelection(list: AccountList, stored: string | undefined): {selected: WalletAccount; rewrite: boolean} {
  const main = list.accounts[0]!;
  if (stored === undefined) {
    return {selected: main, rewrite: false};
  }
  const hit = list.accounts.find(a => a.scheme === stored);
  if (hit) {
    return {selected: hit, rewrite: false};
  }
  return {selected: main, rewrite: !list.unreadable};
}

/** The stored choice; with no encrypted instance, the in-memory one (it cannot be stored now). */
function storedSelection(): string | undefined {
  const store = mmkvSecure();
  if (store) {
    return store.getString(KEY);
  }
  return useAccountsStore.getState().state?.selected.scheme;
}

/** The list and the selection as stored now — a read only, nothing written. */
export function readAccountsState(mainAddress: string): AccountsState {
  const list = readAccountList(mainAddress);
  return {list, selected: resolveSelection(list, storedSelection()).selected};
}

let resetHooked = false;
function hookReset(): void {
  if (resetHooked) {
    return;
  }
  resetHooked = true;
  onSecureMmkvReset(() => useAccountsStore.setState({forMain: null, state: null}));
}

/** Re-read the list and the stored selection into the store (the dashboard's focus, the sheet's open). */
export function refreshAccounts(mainAddress: string | null): AccountsState | null {
  hookReset();
  if (!mainAddress) {
    useAccountsStore.setState({forMain: null, state: null});
    return null;
  }
  const list = readAccountList(mainAddress);
  const {selected, rewrite} = resolveSelection(list, storedSelection());
  if (rewrite) {
    mmkvSecure()?.set(KEY, selected.scheme);
  }
  const state: AccountsState = {list, selected};
  useAccountsStore.setState({forMain: mainAddress, state});
  return state;
}

/** Select a LISTED account (never a fresh-pending one): stored (encrypted), then observable. */
export function selectAccount(scheme: string): boolean {
  const {forMain, state} = useAccountsStore.getState();
  if (!state) {
    return false;
  }
  const hit = state.list.accounts.find(a => a.scheme === scheme);
  if (!hit) {
    return false;
  }
  mmkvSecure()?.set(KEY, hit.scheme);
  useAccountsStore.setState({forMain, state: {list: state.list, selected: hit}});
  return true;
}

/** TEST-ONLY: forget the in-memory state (a "restart"). */
export function resetAccountsForTests(): void {
  useAccountsStore.setState({forMain: null, state: null});
}
