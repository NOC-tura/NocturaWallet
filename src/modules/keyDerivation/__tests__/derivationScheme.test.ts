import {storeTransparentScheme, loadTransparentScheme} from '../derivationScheme';
import {mmkvPublic} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';

describe('transparent derivation scheme persistence', () => {
  afterEach(() => mmkvPublic.remove(MMKV_KEYS.WALLET_TRANSPARENT_DERIVATION));

  it('defaults to slip10 account 0 when unset', () => {
    expect(loadTransparentScheme()).toEqual({kind: 'slip10', account: 0});
  });

  it('round-trips a cli scheme', () => {
    storeTransparentScheme({kind: 'cli'});
    expect(loadTransparentScheme()).toEqual({kind: 'cli'});
  });

  it('round-trips a slip10 account-2 scheme', () => {
    storeTransparentScheme({kind: 'slip10', account: 2});
    expect(loadTransparentScheme()).toEqual({kind: 'slip10', account: 2});
  });
});
