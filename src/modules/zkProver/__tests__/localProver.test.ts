// react-native-fs ships Flow-typed source that Jest's babel transform can't
// parse; localProver imports the real rnfsAssetIO as its default `io` param,
// which pulls it in transitively. Mock it the same way rnfsAssetIO.test.ts
// does — its methods are never actually invoked here since ensureZkey/nativeProve
// are mocked below, so this only needs to make the import chain resolve.
jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/caches',
  exists: jest.fn(async () => true),
  downloadFile: jest.fn(() => ({promise: Promise.resolve({statusCode: 200})})),
  hash: jest.fn(async () => 'abc'),
  unlink: jest.fn(async () => {}),
}));

jest.mock('../nativeProverBridge', () => ({
  isProverSupported: jest.fn(() => true),
  nativeProve: jest.fn(async () => ({proofBytes: 'aa'.repeat(256), publicInputs: ['10', '20']})),
}));
jest.mock('../provingAssets', () => ({ensureZkey: jest.fn(async () => '/cache/transfer.zkey')}));

import {localProver} from '../localProver';
import {isProverSupported, nativeProve} from '../nativeProverBridge';
import {ensureZkey} from '../provingAssets';

beforeEach(() => jest.clearAllMocks());

it('supported reflects the native module', () => {
  (isProverSupported as jest.Mock).mockReturnValue(true);
  expect(localProver.supported).toBe(true);
});

it('prove ensures the zkey then delegates to native, returning the proof', async () => {
  const res = await localProver.prove('transfer', {merkleRoot: '5'} as never);
  expect(ensureZkey).toHaveBeenCalledWith('transfer', expect.anything());
  expect(nativeProve).toHaveBeenCalledWith('transfer', JSON.stringify({merkleRoot: '5'}), '/cache/transfer.zkey');
  expect(res.proofBytes).toBe('aa'.repeat(256));
  expect(res.publicInputs).toEqual(['10', '20']);
});
