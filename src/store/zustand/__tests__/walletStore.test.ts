/** post-M1d §3.1, R13, r2-1, r3 note 1: lastSyncFailedAt lives in memory only. */
import {mmkvPublic} from '../../mmkv/instances';
import {useWalletStore} from '../walletStore';

const NAME = 'noctura-wallet';

beforeEach(() => {
  useWalletStore.getState().reset();
});

it('markSyncFailed sets lastSyncFailedAt and leaves lastSyncedAt alone', () => {
  useWalletStore.setState({lastSyncedAt: 111});
  useWalletStore.getState().markSyncFailed();
  expect(useWalletStore.getState().lastSyncFailedAt).toEqual(expect.any(Number));
  expect(useWalletStore.getState().lastSyncedAt).toBe(111);
});

it('updateBalances stamps lastSyncedAt and clears lastSyncFailedAt', () => {
  useWalletStore.getState().markSyncFailed();
  useWalletStore.getState().updateBalances('5', '6', {});
  expect(useWalletStore.getState().lastSyncFailedAt).toBeNull();
  expect(useWalletStore.getState().lastSyncedAt).toEqual(expect.any(Number));
});

it('reset → null', () => {
  useWalletStore.getState().markSyncFailed();
  useWalletStore.getState().reset();
  expect(useWalletStore.getState().lastSyncFailedAt).toBeNull();
});

it('r3 note 1: the persisted record never carries lastSyncFailedAt', () => {
  useWalletStore.getState().updateBalances('5', '6', {});
  useWalletStore.getState().markSyncFailed();
  const persisted = JSON.parse(mmkvPublic.getString(NAME)!) as {state: Record<string, unknown>};
  expect('lastSyncFailedAt' in persisted.state).toBe(false);
  expect(persisted.state.lastSyncedAt).toEqual(expect.any(Number)); // positive control: the record is the real one
});

it('r3 note 1 / r2-1: a rehydrated store has it null — even from a record that carries one', async () => {
  mmkvPublic.set(
    NAME,
    JSON.stringify({state: {publicKey: 'P', solBalance: '9', lastSyncedAt: 5, lastSyncFailedAt: 9}, version: 0}),
  );
  await useWalletStore.persist.rehydrate();
  expect(useWalletStore.getState().lastSyncedAt).toBe(5); // positive control: the record was read
  expect(useWalletStore.getState().lastSyncFailedAt).toBeNull();
});
