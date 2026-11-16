/**
 * A missing RPC_ENDPOINT falls back to the public endpoint of the build's chain (S13): a devnet
 * build never talks to mainnet under a devnet label.
 */
const mockConnection = jest.fn();
jest.mock('@solana/web3.js', () => ({Connection: function C(...a: unknown[]) { mockConnection(...a); }}));

function connectWith(config: Record<string, string | undefined>): unknown[] {
  jest.resetModules();
  mockConnection.mockClear();
  jest.doMock('react-native-config', () => ({__esModule: true, default: {API_BASE: 'https://x/v1', ...config}}));
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  (require('../connection') as typeof import('../connection')).getConnection();
  warn.mockRestore();
  return mockConnection.mock.calls[0]!;
}

afterEach(() => {
  jest.dontMock('react-native-config');
  jest.resetModules();
});

it('devnet without an RPC_ENDPOINT → the public DEVNET endpoint (http and ws)', () => {
  const [endpoint, opts] = connectWith({NETWORK: 'devnet'});
  expect(endpoint).toBe('https://api.devnet.solana.com');
  expect((opts as {wsEndpoint: string}).wsEndpoint).toBe('wss://api.devnet.solana.com');
});

it('mainnet-beta without an RPC_ENDPOINT → the public mainnet endpoint', () => {
  const [endpoint] = connectWith({NETWORK: 'mainnet-beta'});
  expect(endpoint).toBe('https://api.mainnet-beta.solana.com');
});

it('a configured RPC_ENDPOINT is used as is', () => {
  const [endpoint] = connectWith({NETWORK: 'devnet', HELIUS_RPC_URL: 'https://devnet.example/rpc', HELIUS_WS_URL: 'wss://devnet.example/rpc'});
  expect(endpoint).toBe('https://devnet.example/rpc');
});
