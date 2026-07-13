jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/caches',
  exists: jest.fn(async () => true),
  downloadFile: jest.fn(() => ({promise: Promise.resolve({statusCode: 200})})),
  hash: jest.fn(async () => 'ABCDEF'),
  unlink: jest.fn(async () => {}),
}));

import {rnfsAssetIO} from '../rnfsAssetIO';
import RNFS from 'react-native-fs';

const mockRNFS = RNFS as jest.Mocked<typeof RNFS>;

it('cachePath is under the caches dir, keyed by circuit', () => {
  expect(rnfsAssetIO.cachePath('transfer')).toBe('/caches/noctura-transfer.zkey');
});

it('sha256 lowercases the RNFS hash', async () => {
  expect(await rnfsAssetIO.sha256('/caches/x.zkey')).toBe('abcdef');
});

it('download throws on a non-200 status', async () => {
  mockRNFS.downloadFile.mockReturnValueOnce({promise: Promise.resolve({statusCode: 404})});
  await expect(rnfsAssetIO.download('u', '/caches/x.zkey')).rejects.toThrow(/404/);
});
