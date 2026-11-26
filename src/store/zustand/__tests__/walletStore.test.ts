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

describe('post-M1d R7 / review r1-6: a persisted core token is relabelled on rehydration', () => {
  const WSOL = 'So11111111111111111111111111111111111111112';
  const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

  it('a wSOL row stored as "SOL" / "Solana" comes back as "wSOL" / "Wrapped SOL"; nothing else changes', async () => {
    const stored = [
      {mint: WSOL, symbol: 'SOL', name: 'Solana', decimals: 9, trust: 'core'},
      {mint: USDC, symbol: 'USDC', name: 'USD Coin', decimals: 6, trust: 'core'},
      {mint: 'VerifiedMint', symbol: 'SOL', name: 'Not ours to rename', decimals: 9, trust: 'verified', logoUri: 'https://cdn/x'},
    ];
    mmkvPublic.set(NAME, JSON.stringify({state: {publicKey: 'P', tokens: stored, tokenBalances: {[WSOL]: '5'}}, version: 0}));
    await useWalletStore.persist.rehydrate();
    const tokens = useWalletStore.getState().tokens;
    expect(tokens[0]).toEqual({mint: WSOL, symbol: 'wSOL', name: 'Wrapped SOL', decimals: 9, trust: 'core'});
    expect(tokens[1]).toEqual(stored[1]);
    expect(tokens[2]).toEqual(stored[2]);
    expect(useWalletStore.getState().tokenBalances).toEqual({[WSOL]: '5'});
  });

  it('a record with no tokens, or a malformed tokens value, rehydrates without throwing', async () => {
    mmkvPublic.set(NAME, JSON.stringify({state: {publicKey: 'P'}, version: 0}));
    await useWalletStore.persist.rehydrate();
    expect(useWalletStore.getState().tokens).toEqual([]);
    mmkvPublic.set(NAME, JSON.stringify({state: {publicKey: 'P', tokens: 'nope'}, version: 0}));
    await useWalletStore.persist.rehydrate();
    expect(useWalletStore.getState().tokens).toEqual([]);
  });

  it('Task 1 still holds through the extended merge: lastSyncFailedAt is null after rehydration', async () => {
    mmkvPublic.set(NAME, JSON.stringify({state: {publicKey: 'P', lastSyncedAt: 5, lastSyncFailedAt: 9}, version: 0}));
    await useWalletStore.persist.rehydrate();
    expect(useWalletStore.getState().lastSyncFailedAt).toBeNull();
  });
});
