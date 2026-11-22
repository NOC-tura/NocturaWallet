/** M1d spec §3.2: useSelectedAccount() — observable, hydrated from MMKV, the main account by default. */
import {act, renderHook} from '@testing-library/react-native';
import {clearAllStores, initSecureMmkv, mmkvSecure} from '../../store/mmkv/instances';
import {storeTransparentScheme} from '../../modules/keyDerivation/derivationScheme';
import {useWalletStore} from '../../store/zustand/walletStore';
import {selectAccount, useAccountsStore} from '../../modules/accounts/selectedAccount';
import type {WalletAccount} from '../../modules/accounts/accountList';
import {useAccountList, useRefreshAccounts, useSelectedAccount} from '../useSelectedAccount';

const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
const setRegistry = (accounts: object[]): void => mmkvSecure()!.set('v1_accounts', JSON.stringify({schema: 1, accounts}));

beforeEach(() => {
  clearAllStores();
  initSecureMmkv('test-key');
  storeTransparentScheme({kind: 'slip10', account: 0});
  useAccountsStore.setState({forMain: null, state: null}); // M1d: the product module no longer exports a test reset
  useWalletStore.setState({publicKey: MAIN});
});

it('the first render already returns the main account; the store is then hydrated', () => {
  const seen: Array<WalletAccount | null> = [];
  renderHook(() => {
    const v = useSelectedAccount();
    seen.push(v);
    return v;
  });
  // M1d: asserted on the FIRST render (result.current is read after the hydrating effect ran)
  expect(seen[0]).toMatchObject({scheme: 'slip10:0', address: MAIN, label: 'Account 1', role: 'main', isMain: true});
  expect(useAccountsStore.getState().forMain).toBe(MAIN);
});

it('the first render already returns a STORED non-main selection (read from MMKV, not defaulted)', () => {
  setRegistry([{scheme: 'slip10:0', role: 'main', address: MAIN}, {scheme: 'slip10:3', role: 'fresh-exit', address: A3}]);
  mmkvSecure()!.set('v1_accounts.selected', 'slip10:3');
  const seen: Array<WalletAccount | null> = [];
  renderHook(() => {
    const v = useSelectedAccount();
    seen.push(v);
    return v;
  });
  // M1d: first render, before the effect hydrates the store
  expect(seen[0]).toMatchObject({scheme: 'slip10:3', address: A3, label: 'Account 4', isMain: false});
});

it('a selection is observable (spec §3.2 "changes are observable")', () => {
  setRegistry([{scheme: 'slip10:0', role: 'main', address: MAIN}, {scheme: 'slip10:3', role: 'fresh-exit', address: A3}]);
  const {result} = renderHook(() => useSelectedAccount());
  act(() => {
    selectAccount('slip10:3');
  });
  expect(result.current).toMatchObject({scheme: 'slip10:3', label: 'Account 4', number: 4, isMain: false});
});

it('useRefreshAccounts re-reads the registry: an exit that landed appears in the list', () => {
  const lists: Array<number | null> = [];
  const {result} = renderHook(() => {
    const list = useAccountList();
    lists.push(list ? list.accounts.length : null);
    return {list, refresh: useRefreshAccounts()};
  });
  expect(lists[0]).toBe(1); // M1d: the first render already has the list
  expect(result.current.list!.accounts).toHaveLength(1);
  setRegistry([{scheme: 'slip10:0', role: 'main', address: MAIN}, {scheme: 'slip10:3', role: 'fresh-exit', address: A3}]);
  act(() => result.current.refresh());
  expect(result.current.list!.accounts.map(a => a.label)).toEqual(['Account 1', 'Account 4']);
});

it('no wallet loaded → null (plan A5)', () => {
  useWalletStore.setState({publicKey: null});
  const {result} = renderHook(() => useSelectedAccount());
  expect(result.current).toBeNull();
});
