import {PublicKey} from '@solana/web3.js';
import {sendTransparentTransfer} from '../sendTransaction';
import * as signAndSendMod from '../signAndSend';
import {KeychainManager} from '../../keychain/keychainModule';

jest.mock('../connection', () => ({getConnection: () => ({}) as never}));

const ABANDON =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// PublicKey is mocked: toBase58() === 'mock-pubkey-<first4bytesHex>'. The cli
// pubkey for the ABANDON seed is hex c5785e18… → 'mock-pubkey-c5785e18'.
const CLI_MOCK_ADDR = 'mock-pubkey-c5785e18';

describe('sendTransparentTransfer', () => {
  afterEach(() => jest.restoreAllMocks());

  it('derives the cli signer and broadcasts, returning the signature', async () => {
    jest
      .spyOn(KeychainManager.prototype, 'retrieveSeed')
      .mockResolvedValue(ABANDON);
    const spy = jest
      .spyOn(signAndSendMod, 'signAndSend')
      .mockResolvedValue({signature: 'SIG123', confirmationStatus: 'confirmed'});

    const result = await sendTransparentTransfer({
      kind: 'sol',
      recipient: new PublicKey('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'),
      lamports: 1_000n,
      priorityFee: 0,
      scheme: {kind: 'cli'},
    });

    expect(result.signature).toBe('SIG123');
    // payer === cli address derived from the abandon seed
    const spec = spy.mock.calls[0][1];
    expect(spec.payer.toBase58()).toBe(CLI_MOCK_ADDR);
    const signers = spy.mock.calls[0][2];
    expect(signers[0].publicKey.toBase58()).toBe(CLI_MOCK_ADDR);
  });
});
