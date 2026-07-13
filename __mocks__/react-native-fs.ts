// react-native-fs ships Flow-typed source that Jest's babel transform can't
// parse. Any test that transitively imports it (localProver → rnfsAssetIO →
// react-native-fs, and thus zkProverModule → proveShielded) needs it mocked.
// Placed in the root __mocks__ dir so Jest applies it automatically to every
// suite; suites that exercise the real I/O contract override it inline.
const RNFS = {
  CachesDirectoryPath: '/caches',
  exists: jest.fn(async () => true),
  downloadFile: jest.fn(() => ({promise: Promise.resolve({statusCode: 200})})),
  hash: jest.fn(async () => 'abc'),
  unlink: jest.fn(async () => {}),
};

export default RNFS;
