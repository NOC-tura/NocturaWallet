import {ensureCircuitAssets, type AssetIO} from '../provingAssets';
import {ZKEY_ASSETS} from '../../../constants/provingAssets';

// Pin known hashes for the transfer circuit so the round-trip is deterministic.
ZKEY_ASSETS.transfer.zkey = {url: 'https://assets.example/transfer.zkey', sha256: 'zk'};
ZKEY_ASSETS.transfer.wasm = {url: 'https://assets.example/transfer.wasm', sha256: 'wa'};

const HASH_BY_PATH: Record<string, string> = {
  '/cache/transfer.zkey': 'zk',
  '/cache/transfer.wasm': 'wa',
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
  const r = await ensureCircuitAssets('transfer', io);
  expect(r).toEqual({zkeyPath: '/cache/transfer.zkey', wasmPath: '/cache/transfer.wasm'});
  expect(io.download).toHaveBeenCalledWith('https://assets.example/transfer.zkey', '/cache/transfer.zkey');
  expect(io.download).toHaveBeenCalledWith('https://assets.example/transfer.wasm', '/cache/transfer.wasm');
  expect(io.download).toHaveBeenCalledTimes(2);
});

it('uses the cached files (no re-download) but still re-verifies both', async () => {
  const io = ioMock({exists: jest.fn(async () => true)});
  await ensureCircuitAssets('transfer', io);
  expect(io.download).not.toHaveBeenCalled();
  expect(io.sha256).toHaveBeenCalledWith('/cache/transfer.zkey');
  expect(io.sha256).toHaveBeenCalledWith('/cache/transfer.wasm');
});

it('REJECTS a zkey hash mismatch and deletes the bad file', async () => {
  const io = ioMock({sha256: jest.fn(async (p: string) => (p.endsWith('.zkey') ? 'evil' : 'wa'))});
  await expect(ensureCircuitAssets('transfer', io)).rejects.toThrow(/sha-?256/i);
  expect(io.remove).toHaveBeenCalledWith('/cache/transfer.zkey');
});

it('REJECTS a wasm hash mismatch and deletes the bad file', async () => {
  const io = ioMock({sha256: jest.fn(async (p: string) => (p.endsWith('.wasm') ? 'evil' : 'zk'))});
  await expect(ensureCircuitAssets('transfer', io)).rejects.toThrow(/sha-?256/i);
  expect(io.remove).toHaveBeenCalledWith('/cache/transfer.wasm');
});
