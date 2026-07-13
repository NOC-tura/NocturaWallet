import {ensureZkey, type AssetIO} from '../provingAssets';
import {ZKEY_ASSETS} from '../../../constants/provingAssets';

ZKEY_ASSETS.transfer.url = 'https://assets.example/transfer.zkey';
ZKEY_ASSETS.transfer.sha256 = 'good';

function ioMock(over: Partial<AssetIO> = {}): AssetIO {
  return {
    exists: jest.fn(async () => false),
    download: jest.fn(async () => {}),
    sha256: jest.fn(async () => 'good'),
    remove: jest.fn(async () => {}),
    cachePath: (id: string) => `/cache/${id}.zkey`,
    ...over,
  };
}

it('downloads, verifies, and returns the cache path when absent', async () => {
  const io = ioMock();
  const p = await ensureZkey('transfer', io);
  expect(io.download).toHaveBeenCalledWith('https://assets.example/transfer.zkey', '/cache/transfer.zkey');
  expect(p).toBe('/cache/transfer.zkey');
});

it('uses the cached file (no re-download) when present and hash matches', async () => {
  const io = ioMock({exists: jest.fn(async () => true)});
  await ensureZkey('transfer', io);
  expect(io.download).not.toHaveBeenCalled();
  expect(io.sha256).toHaveBeenCalledWith('/cache/transfer.zkey'); // still re-verified
});

it('REJECTS a hash mismatch and deletes the bad file (no proving)', async () => {
  const io = ioMock({sha256: jest.fn(async () => 'evil')});
  await expect(ensureZkey('transfer', io)).rejects.toThrow(/sha-?256/i);
  expect(io.remove).toHaveBeenCalledWith('/cache/transfer.zkey');
});
