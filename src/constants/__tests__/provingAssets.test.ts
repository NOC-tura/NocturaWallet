import {
  ZKEY_ASSETS,
  circuitAssets,
  EXPECTED_NPUBLIC,
  ZKEY_PROGRAM_ID,
  ZKEY_CLUSTER,
  assertContentAddressed
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

describe('content-addressing', () => {
  it('every pinned URL names the digest it is pinned to', () => {
    for (const [id, circuit] of Object.entries(ZKEY_ASSETS)) {
      for (const [kind, asset] of Object.entries(circuit)) {
        expect(`${id}.${kind} -> ${asset.url}`).toContain(`/h/${asset.sha256}/`);
      }
    }
  });

  it('the mutable /v1/ pointer is NOT pinned — only /h/ carries immutable', () => {
    for (const circuit of Object.values(ZKEY_ASSETS)) {
      for (const asset of Object.values(circuit)) {
        expect(asset.url).not.toContain('/zk-assets/v1/');
      }
    }
  });

  it('assertContentAddressed rejects a URL that does not name its digest', () => {
    // The guard must be shown to fire. `at()` makes the bad case unexpressible in
    // the source, so it is constructed here by hand — which is exactly the edit a
    // future developer could make.
    expect(() =>
      assertContentAddressed({
        deposit: {
          zkey: {url: 'https://api.noc-tura.io/api/v1/zk-assets/v1/deposit_final.zkey', sha256: 'a'.repeat(64)},
          wasm: ZKEY_ASSETS.deposit.wasm,
        },
      }),
    ).toThrow(/does not name its digest/);
  });

  it('assertContentAddressed accepts the real pin set', () => {
    expect(() => assertContentAddressed(ZKEY_ASSETS)).not.toThrow();
  });
});
