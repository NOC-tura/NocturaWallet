import {PublicKey} from '@solana/web3.js';
import {submitTransparentTransfer} from '../sendTransaction';
import {KeychainManager} from '../../keychain/keychainModule';

const ABANDON =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const mockSendRawTransaction = jest.fn(async () => 'SIG_ABC');
jest.mock('../connection', () => ({
  getConnection: () => ({
    getLatestBlockhash: jest.fn(async () => ({blockhash: 'bh', lastValidBlockHeight: 1})),
    sendRawTransaction: mockSendRawTransaction,
    confirmTransaction: jest.fn(),
  }),
}));

describe('submitTransparentTransfer', () => {
  afterEach(() => jest.restoreAllMocks());

  it('signs + sends and returns the signature without confirming', async () => {
    jest.spyOn(KeychainManager.prototype, 'retrieveSeed').mockResolvedValue(ABANDON);
    const res = await submitTransparentTransfer({
      kind: 'sol',
      recipient: new PublicKey('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'),
      lamports: 1_000n,
      priorityFee: 0,
      scheme: {kind: 'cli'},
    });
    expect(res.signature).toBe('SIG_ABC');
    expect(mockSendRawTransaction).toHaveBeenCalledTimes(1);
  });
});
