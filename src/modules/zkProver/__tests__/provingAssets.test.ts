import {
  assertContentAddressed,
  ensurePinnedAssets,
  type AssetIO,
  type CircuitAssets,
} from '../provingAssets';
import {A0_KEY_ASSETS} from '../../shielded/a0/keyAssets';

// A pinned pair with known hashes, so the round trip is deterministic (not a real key set).
const PAIR: CircuitAssets = {
  zkey: {url: 'https://assets.example/h/zk/test.zkey', sha256: 'zk'},
  wasm: {url: 'https://assets.example/h/wa/test.wasm', sha256: 'wa'},
};

const HASH_BY_PATH: Record<string, string> = {
  '/cache/test.zkey': 'zk',
  '/cache/test.wasm': 'wa',
};

function ioMock(over: Partial<AssetIO> = {}): AssetIO {
  return {
    exists: jest.fn(async () => false),
    download: jest.fn(async () => {}),
    sha256: jest.fn(async (p: string) => HASH_BY_PATH[p] ?? 'other'),
    remove: jest.fn(async () => {}),
    cachePath: (id: string, kind: 'zkey' | 'wasm') => `/cache/${id}.${kind}`,
    ...over,
  };
}

it('downloads + verifies BOTH zkey and wasm, returns both cache paths', async () => {
  const io = ioMock();
  const r = await ensurePinnedAssets('test', PAIR, io);
  expect(r).toEqual({zkeyPath: '/cache/test.zkey', wasmPath: '/cache/test.wasm'});
  expect(io.download).toHaveBeenCalledWith(PAIR.zkey.url, '/cache/test.zkey');
  expect(io.download).toHaveBeenCalledWith(PAIR.wasm.url, '/cache/test.wasm');
  expect(io.download).toHaveBeenCalledTimes(2);
});

it('uses the cached files (no re-download) but still re-verifies both', async () => {
  const io = ioMock({exists: jest.fn(async () => true)});
  await ensurePinnedAssets('test', PAIR, io);
  expect(io.download).not.toHaveBeenCalled();
  expect(io.sha256).toHaveBeenCalledWith('/cache/test.zkey');
  expect(io.sha256).toHaveBeenCalledWith('/cache/test.wasm');
});

it('REJECTS a zkey hash mismatch and deletes the bad file', async () => {
  const io = ioMock({sha256: jest.fn(async (p: string) => (p.endsWith('.zkey') ? 'evil' : 'wa'))});
  await expect(ensurePinnedAssets('test', PAIR, io)).rejects.toThrow(/sha-?256/i);
  expect(io.remove).toHaveBeenCalledWith('/cache/test.zkey');
});

it('REJECTS a wasm hash mismatch and deletes the bad file', async () => {
  const io = ioMock({sha256: jest.fn(async (p: string) => (p.endsWith('.wasm') ? 'evil' : 'zk'))});
  await expect(ensurePinnedAssets('test', PAIR, io)).rejects.toThrow(/sha-?256/i);
  expect(io.remove).toHaveBeenCalledWith('/cache/test.wasm');
});

describe('content-addressing (moved here with the v1 pin set, M1b)', () => {
  it('rejects a URL that does not name its digest (the guard fires)', () => {
    expect(() =>
      assertContentAddressed({
        deposit: {
          zkey: {url: 'https://api.noc-tura.io/api/v1/zk-assets/a0/deposit_final.zkey', sha256: 'a'.repeat(64)},
          wasm: A0_KEY_ASSETS.deposit.wasm,
        },
      }),
    ).toThrow(/does not name its digest/);
  });

  it('accepts the A0 pin set (which keyAssets.ts also asserts at import)', () => {
    expect(() => assertContentAddressed(A0_KEY_ASSETS)).not.toThrow();
  });
});
