jest.mock('../../sslPinning/pinnedFetch', () => ({pinnedFetch: jest.fn()}));
jest.mock('../merkleSync', () => ({syncLeaves: jest.fn()}));

const mockGetSignatureStatus = jest.fn();
jest.mock('../../solana/connection', () => ({
  getConnection: () => ({getSignatureStatus: mockGetSignatureStatus}),
}));

import {
  submitTransferViaRelayer,
  RelayerError,
  RelayerDisabledError,
  RelayerAlreadySpentError,
  type RelayerTransferInput,
} from '../relayerSubmit';
import {pinnedFetch} from '../../sslPinning/pinnedFetch';
import {syncLeaves} from '../merkleSync';
import {decToHex64} from '../fieldCodec';

const mockFetch = pinnedFetch as jest.Mock;
const mockSync = syncLeaves as jest.Mock;

const RECIP_DEC = '40';
const baseInput = (): RelayerTransferInput => ({
  mint: 'AtjVK2z561wDYo5EvougJKAo9AJ4KdduxSbiF173aiAe',
  merkleRoot: new Uint8Array(32).fill(0x11),
  nullifier0: new Uint8Array(32).fill(0x22),
  nullifier1: new Uint8Array(32).fill(0x33),
  outCommitment0: new Uint8Array(32).fill(0x44),
  outCommitment1: new Uint8Array(32).fill(0x55),
  proofBytes: new Uint8Array(256).fill(0x66),
  publicInputs: ['r', 'n0', 'n1', '40', '50', 'mh'],
  ciphertext0: new Uint8Array(128).fill(0x77),
  ciphertext1: new Uint8Array(128).fill(0x88),
  cuLimit: 152000,
  recipientCommitmentDec: RECIP_DEC,
});

beforeEach(() => {
  mockFetch.mockReset();
  mockSync.mockReset();
  mockGetSignatureStatus.mockReset();
  // Default: the signature confirms cleanly on-chain.
  mockGetSignatureStatus.mockResolvedValue({
    value: {err: null, confirmationStatus: 'confirmed'},
  });
});

describe('submitTransferViaRelayer', () => {
  it('POSTs the frozen payload (hex fields + kind + cuLimit) to /relayer/submit', async () => {
    mockFetch.mockResolvedValue({status: 200, json: async () => ({txSignature: 'SIG'})});
    await submitTransferViaRelayer(baseInput());

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/relayer\/submit$/);
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.kind).toBe('transfer');
    expect(body.cuLimit).toBe(152000);
    expect(body.merkleRoot).toBe('11'.repeat(32));
    expect(body.nullifier0).toBe('22'.repeat(32));
    expect(body.nullifier1).toBe('33'.repeat(32));
    expect(body.outCommitment0).toBe('44'.repeat(32));
    expect(body.outCommitment1).toBe('55'.repeat(32));
    expect(body.proofBytes).toBe('66'.repeat(256));
    expect(body.ciphertext0).toBe('77'.repeat(128));
    expect(body.ciphertext1).toBe('88'.repeat(128));
    expect(body.publicInputs).toEqual(['r', 'n0', 'n1', '40', '50', 'mh']);
  });

  it('200 → confirms the signature on-chain, then returns it', async () => {
    mockFetch.mockResolvedValue({status: 200, json: async () => ({txSignature: 'REAL_SIG'})});
    const res = await submitTransferViaRelayer(baseInput());
    expect(res).toEqual({txSignature: 'REAL_SIG', alreadyLanded: false});
    expect(mockGetSignatureStatus).toHaveBeenCalledWith('REAL_SIG', {searchTransactionHistory: true});
    expect(mockSync).not.toHaveBeenCalled();
  });

  it('200 but the tx FAILED on-chain → throws, never a false success (defense vs coordinator ERRCLS-2)', async () => {
    mockFetch.mockResolvedValue({status: 200, json: async () => ({txSignature: 'FAILED_SIG'})});
    mockGetSignatureStatus.mockResolvedValue({
      value: {err: {InstructionError: [0, {Custom: 0}]}, confirmationStatus: 'confirmed'},
    });
    await expect(submitTransferViaRelayer(baseInput())).rejects.toThrow(RelayerError);
  });

  it('200 without a txSignature → throws', async () => {
    mockFetch.mockResolvedValue({status: 200, json: async () => ({})});
    await expect(submitTransferViaRelayer(baseInput())).rejects.toThrow(RelayerError);
  });

  it('409 + our recipient commitment IS on-chain → alreadyLanded success (no sig)', async () => {
    mockFetch.mockResolvedValue({status: 409, json: async () => ({alreadySpent: true})});
    mockSync.mockResolvedValue({leaves: [decToHex64(RECIP_DEC)]});
    const res = await submitTransferViaRelayer(baseInput());
    expect(res).toEqual({txSignature: '', alreadyLanded: true});
  });

  it('409 + our commitment NOT on-chain → throws AlreadySpent (input spent elsewhere)', async () => {
    mockFetch.mockResolvedValue({status: 409, json: async () => ({alreadySpent: true})});
    mockSync.mockResolvedValue({leaves: ['deadbeef']});
    await expect(submitTransferViaRelayer(baseInput())).rejects.toThrow(RelayerAlreadySpentError);
  });

  it('409 + sync fails → treats as NOT landed (surfaces error, never false success)', async () => {
    mockFetch.mockResolvedValue({status: 409, json: async () => ({alreadySpent: true})});
    mockSync.mockRejectedValue(new Error('rpc down'));
    await expect(submitTransferViaRelayer(baseInput())).rejects.toThrow(RelayerAlreadySpentError);
  });

  it('503 → throws RelayerDisabledError', async () => {
    mockFetch.mockResolvedValue({status: 503, json: async () => ({})});
    await expect(submitTransferViaRelayer(baseInput())).rejects.toThrow(RelayerDisabledError);
  });

  it('502 → throws RelayerError', async () => {
    mockFetch.mockResolvedValue({status: 502, json: async () => ({error: 'submit failed'})});
    await expect(submitTransferViaRelayer(baseInput())).rejects.toThrow(RelayerError);
  });
});
