import {submitSwap} from '../submitSwap';

// babel-jest allows variables prefixed with 'mock' to be referenced inside jest.mock factories
const mockSendRawTransaction = jest.fn(async () => 'SWAPSIG');
const mockZeroize = jest.fn();

jest.mock('../../solana/connection', () => ({
  getConnection: () => ({sendRawTransaction: mockSendRawTransaction}),
}));
jest.mock('../jupiter', () => ({
  getSwapTransaction: jest.fn(async () => ({swapTransaction: 'BASE64', lastValidBlockHeight: 999})),
}));
jest.mock('../../keychain/keychainModule', () => ({
  KeychainManager: jest.fn().mockImplementation(() => ({retrieveSeed: async () => 'seed words'})),
}));
jest.mock('../../keyDerivation/mnemonicUtils', () => ({mnemonicToSeed: async () => new Uint8Array(64)}));
jest.mock('../../session/zeroize', () => ({zeroize: (x: Uint8Array) => mockZeroize(x)}));
jest.mock('../../keyDerivation/transparent', () => ({
  deriveTransparentKeypair: () => ({secretKey: new Uint8Array(64)}),
}));
jest.mock('@solana/web3.js', () => {
  const actual = jest.requireActual('@solana/web3.js');
  return {
    ...actual,
    Keypair: {fromSecretKey: () => ({publicKey: {toBase58: () => 'OWNER'}})},
    VersionedTransaction: {deserialize: () => ({sign: jest.fn(), serialize: () => new Uint8Array([1])})},
  };
});

describe('submitSwap', () => {
  beforeEach(() => {
    mockSendRawTransaction.mockReset();
    mockSendRawTransaction.mockResolvedValue('SWAPSIG');
  });

  it('signs the Jupiter tx and broadcasts, returning the signature', async () => {
    const r = await submitSwap({quoteRaw: {route: true}, scheme: {kind: 'cli'} as never});
    expect(r.signature).toBe('SWAPSIG');
    expect(r.lastValidBlockHeight).toBe(999);
    expect(mockSendRawTransaction).toHaveBeenCalled();
    expect(mockZeroize).toHaveBeenCalled(); // secret key wiped
  });

  it('retries the broadcast on a transient send timeout (idempotent resend)', async () => {
    mockSendRawTransaction
      .mockRejectedValueOnce(new Error('504 request timed out'))
      .mockRejectedValueOnce(new Error('504 request timed out'))
      .mockResolvedValueOnce('RETRYSIG');
    const r = await submitSwap({quoteRaw: {route: true}, scheme: {kind: 'cli'} as never});
    expect(r.signature).toBe('RETRYSIG');
    expect(mockSendRawTransaction).toHaveBeenCalledTimes(3);
  });

  it('throws after all broadcast attempts fail', async () => {
    mockSendRawTransaction.mockReset();
    mockSendRawTransaction.mockRejectedValue(new Error('504 request timed out'));
    await expect(submitSwap({quoteRaw: {route: true}, scheme: {kind: 'cli'} as never})).rejects.toThrow();
  });
});
