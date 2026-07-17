import {
  ZKEY_ASSETS,
  circuitAssets,
  EXPECTED_NPUBLIC,
  ZKEY_PROGRAM_ID,
  ZKEY_CLUSTER,
} from '../provingAssets';
import {SHIELDED_POOL_PROGRAM_ID} from '../programs';

it('declares an entry for every circuit id', () => {
  expect(Object.keys(ZKEY_ASSETS).sort()).toEqual(
    ['deposit', 'transfer', 'withdraw', 'withdraw_change'],
  );
});

it('exposes zkey + wasm pinned assets per circuit', () => {
  const a = circuitAssets('transfer');
  expect(a.zkey.url).toMatch(/transfer_final\.zkey$/);
  expect(a.zkey.sha256).toHaveLength(64);
  expect(a.wasm.url).toMatch(/transfer\.wasm$/);
  expect(a.wasm.sha256).toHaveLength(64);
});

it('nPublic per circuit matches the deployed circuits', () => {
  expect(EXPECTED_NPUBLIC).toEqual({
    deposit: 3,
    withdraw: 5,
    withdraw_change: 6,
    transfer: 6,
  });
});

it('the pinned zkeys target the wallet-configured shielded program', () => {
  expect(ZKEY_PROGRAM_ID).toBe(SHIELDED_POOL_PROGRAM_ID);
  expect(ZKEY_CLUSTER).toBe('devnet');
});

it('circuitAssets throws when an asset url/sha256 is empty (fail-closed)', () => {
  const saved = ZKEY_ASSETS.deposit.wasm.sha256;
  (ZKEY_ASSETS.deposit.wasm as {sha256: string}).sha256 = '';
  expect(() => circuitAssets('deposit')).toThrow(/not configured/);
  (ZKEY_ASSETS.deposit.wasm as {sha256: string}).sha256 = saved;
});
