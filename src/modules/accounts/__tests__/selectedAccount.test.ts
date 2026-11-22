/**
 * M1d spec §3.2: the selected account — encrypted MMKV only, default main, a stored scheme that is
 * not listed falls back to main and is rewritten; walletStore.publicKey never moves. The registry
 * is written as raw records (the M1c format), read by the real registry module.
 */
import {clearAllStores, initSecureMmkv, mmkvPublic, mmkvSecure} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';
import {storeTransparentScheme} from '../../keyDerivation/derivationScheme';
import {useWalletStore} from '../../../store/zustand/walletStore';
import {
  readAccountsState,
  refreshAccounts,
  resolveSelection,
  selectAccount,
  useAccountsStore,
} from '../selectedAccount';
import {buildAccountList} from '../accountList';

const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const A1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
const FOREIGN = 'E48cosDiQZK1iDSsyUzhvW4WxJeoKuDk5qgcdkmANV4N';
const REG = 'v1_accounts';
const SEL = 'v1_accounts.selected';
const setRegistry = (accounts: object[]): void => mmkvSecure()!.set(REG, JSON.stringify({schema: 1, accounts}));
const main = {scheme: 'slip10:0', role: 'main', address: MAIN};
const exit3 = {scheme: 'slip10:3', role: 'fresh-exit', address: A3};
const pending1 = {scheme: 'slip10:1', role: 'fresh-pending', address: A1};

beforeEach(() => {
  clearAllStores();
  initSecureMmkv('test-key');
  storeTransparentScheme({kind: 'slip10', account: 0});
  useAccountsStore.setState({forMain: null, state: null}); // M1d: the product module no longer exports a test reset
});

it('the key is v1_accounts.selected (encrypted instance, mmkvKeys.ts [S])', () => {
  expect(MMKV_KEYS.ACCOUNTS_SELECTED).toBe(SEL);
});

it('default: the main account', () => {
  expect(refreshAccounts(MAIN)!.selected).toMatchObject({scheme: 'slip10:0', address: MAIN, isMain: true, label: 'Account 1'});
  expect(mmkvSecure()!.getString(SEL)).toBeUndefined(); // nothing written for a default
});

it('a selection is stored in the ENCRYPTED instance only, as the scheme string', () => {
  setRegistry([main, exit3]);
  refreshAccounts(MAIN);
  const publicBefore = mmkvPublic.getAllKeys().sort();
  expect(selectAccount('slip10:3')).toBe(true);
  expect(mmkvSecure()!.getString(SEL)).toBe('slip10:3');
  expect(mmkvPublic.getAllKeys().sort()).toEqual(publicBefore);
  expect(useAccountsStore.getState().state!.selected).toMatchObject({scheme: 'slip10:3', address: A3, label: 'Account 4', isMain: false});
});

it('persists across a restart (the store forgotten, re-hydrated from MMKV)', () => {
  setRegistry([main, exit3]);
  refreshAccounts(MAIN);
  selectAccount('slip10:3');
  useAccountsStore.setState({forMain: null, state: null}); // M1d: the product module no longer exports a test reset
  expect(refreshAccounts(MAIN)!.selected.scheme).toBe('slip10:3');
});

it('a stored scheme that is not listed (wiped, restored) → main, silently, and the stored value is rewritten', () => {
  setRegistry([main, exit3]);
  mmkvSecure()!.set(SEL, 'slip10:7');
  expect(refreshAccounts(MAIN)!.selected.scheme).toBe('slip10:0');
  expect(mmkvSecure()!.getString(SEL)).toBe('slip10:0');
});

it('a fresh-pending reservation is never selected, and cannot be selected', () => {
  setRegistry([main, pending1]);
  mmkvSecure()!.set(SEL, 'slip10:1');
  expect(refreshAccounts(MAIN)!.selected.scheme).toBe('slip10:0');
  expect(selectAccount('slip10:1')).toBe(false);
  expect(selectAccount('slip10:9')).toBe(false);
  expect(useAccountsStore.getState().state!.selected.scheme).toBe('slip10:0');
});

it('plan A4: an unreadable registry → main in memory, the stored choice KEPT', () => {
  mmkvSecure()!.set(SEL, 'slip10:3');
  mmkvSecure()!.set(REG, '{');
  const s = refreshAccounts(MAIN)!;
  expect(s.selected.scheme).toBe('slip10:0');
  expect(s.list.unreadable).toBe(true);
  expect(mmkvSecure()!.getString(SEL)).toBe('slip10:3');
});

it('no encrypted instance (locked) → main only, the line; a selection of main writes nothing and does not throw', () => {
  clearAllStores();
  storeTransparentScheme({kind: 'slip10', account: 0});
  const s = refreshAccounts(MAIN)!;
  expect(s.list.unreadable).toBe(true);
  expect(s.list.accounts).toHaveLength(1);
  expect(() => selectAccount('slip10:0')).not.toThrow();
});

it('walletStore.publicKey is never changed by a selection (approach 1)', () => {
  useWalletStore.getState().setPublicKey(MAIN);
  setRegistry([main, exit3]);
  refreshAccounts(MAIN);
  selectAccount('slip10:3');
  expect(useWalletStore.getState().publicKey).toBe(MAIN);
});

it('Review Focus 5: a wipe + import in the same process resets the selection; the new wallet starts on its main', () => {
  setRegistry([main, exit3]);
  refreshAccounts(MAIN);
  selectAccount('slip10:3');
  clearAllStores(); // the in-app wipe
  initSecureMmkv('the-next-wallet'); // the import opens a new encrypted instance → the reset hooks fire
  expect(useAccountsStore.getState().state).toBeNull();
  storeTransparentScheme({kind: 'slip10', account: 0});
  const s = refreshAccounts(FOREIGN)!;
  expect(s.selected).toMatchObject({address: FOREIGN, isMain: true});
  expect(s.list.accounts.map(a => a.address)).toEqual([FOREIGN]);
});

it('no wallet → null and an empty store', () => {
  expect(refreshAccounts(null)).toBeNull();
  expect(useAccountsStore.getState().state).toBeNull();
});

it('resolveSelection / readAccountsState: pure reads, nothing written', () => {
  const list = buildAccountList(MAIN, {kind: 'slip10', account: 0}, () => null);
  expect(resolveSelection(list, undefined)).toEqual({selected: list.accounts[0], rewrite: false});
  expect(resolveSelection(list, 'slip10:5').rewrite).toBe(true);
  mmkvSecure()!.set(SEL, 'slip10:5');
  expect(readAccountsState(MAIN).selected.scheme).toBe('slip10:0');
  expect(mmkvSecure()!.getString(SEL)).toBe('slip10:5'); // a read never rewrites; refreshAccounts does
});
