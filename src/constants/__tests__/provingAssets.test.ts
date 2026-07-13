import {ZKEY_ASSETS, zkeyAsset} from '../provingAssets';

it('declares an entry for every circuit id', () => {
  expect(Object.keys(ZKEY_ASSETS).sort()).toEqual(
    ['deposit', 'transfer', 'withdraw', 'withdraw_change'],
  );
});

it('zkeyAsset throws until an entry is populated (unconfigured is not usable)', () => {
  // With empty url/sha256, the asset is not usable and must fail closed.
  expect(() => zkeyAsset('transfer')).toThrow(/not configured/);
});
