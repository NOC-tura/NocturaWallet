// react-native-fs ships Flow-typed source that Jest's babel transform can't
// parse; localProver imports the real rnfsAssetIO as its default `io` param,
// which pulls it in transitively. Mock it the same way rnfsAssetIO.test.ts does —
// its methods are never invoked here since ensureCircuitAssets/nativeProve are
// mocked below, so this only needs to make the import chain resolve.
jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/caches',
  exists: jest.fn(async () => true),
  downloadFile: jest.fn(() => ({promise: Promise.resolve({statusCode: 200})})),
  hash: jest.fn(async () => 'abc'),
  unlink: jest.fn(async () => {}),
}));

jest.mock('../nativeProverBridge', () => ({
  isProverSupported: jest.fn(() => true),
  // transfer nPublic = 6
  nativeProve: jest.fn(async () => ({
    proofBytes: 'aa'.repeat(256),
    publicInputs: ['1', '2', '3', '4', '5', '6'],
  })),
}));
jest.mock('../provingAssets', () => ({
  ensureCircuitAssets: jest.fn(async () => ({
    zkeyPath: '/cache/transfer.zkey',
    wasmPath: '/cache/transfer.wasm',
  })),
}));

import {localProver} from '../localProver';
import {isProverSupported, nativeProve} from '../nativeProverBridge';
import {ensureCircuitAssets} from '../provingAssets';

beforeEach(() => jest.clearAllMocks());

it('supported reflects the native module', () => {
  (isProverSupported as jest.Mock).mockReturnValue(true);
  expect(localProver.supported).toBe(true);
});

it('ensures both assets, passes both paths to native, returns the proof', async () => {
  const res = await localProver.prove('transfer', {merkleRoot: '5'} as never);
  expect(ensureCircuitAssets).toHaveBeenCalledWith('transfer', expect.anything());
  expect(nativeProve).toHaveBeenCalledWith(
    'transfer',
    JSON.stringify({merkleRoot: '5'}),
    '/cache/transfer.zkey',
    '/cache/transfer.wasm',
  );
  expect(res.proofBytes).toBe('aa'.repeat(256));
  expect(res.publicInputs).toHaveLength(6);
});

it('throws when the proof publicInputs length != EXPECTED_NPUBLIC (fail-closed)', async () => {
  (nativeProve as jest.Mock).mockResolvedValueOnce({proofBytes: 'aa', publicInputs: ['1']}); // wrong for transfer (6)
  await expect(localProver.prove('transfer', {} as never)).rejects.toThrow(/public input/i);
});
