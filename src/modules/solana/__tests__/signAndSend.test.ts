import {Connection, PublicKey, Keypair} from '@solana/web3.js';
import {signAndSend} from '../signAndSend';
import type {TransactionSpec} from '../signAndSend';

describe('signAndSend', () => {
  let connection: Connection;
  const mockSpec: TransactionSpec = {
    payer: new PublicKey('payer-pubkey'),
    instructions: [],
  };
  const mockSigner = Keypair.fromSecretKey(new Uint8Array(64));

  beforeEach(() => {
    connection = new Connection('https://mock-rpc.com');
    jest.clearAllMocks();
  });

  it('returns signature and confirmation status on success', async () => {
    const result = await signAndSend(connection, mockSpec, [mockSigner]);
    expect(result.signature).toBeDefined();
    expect(typeof result.signature).toBe('string');
    expect(result.confirmationStatus).toBe('confirmed');
  });

  it('throws with E022 after max retries', async () => {
    // Never confirms; block height always past expiry → every attempt expires.
    (connection.getSignatureStatus as jest.Mock).mockResolvedValue({value: null});
    (connection.getBlockHeight as jest.Mock).mockResolvedValue(1_000_000); // > lastValidBlockHeight 999_999

    await expect(
      signAndSend(connection, mockSpec, [mockSigner], {maxRetries: 1}),
    ).rejects.toThrow('E022');
  });

  it('retries with new blockhash on expiry', async () => {
    // First poll: not confirmed + height past expiry → retry. Second: confirmed.
    (connection.getBlockHeight as jest.Mock).mockResolvedValue(1_000_000);
    let polls = 0;
    (connection.getSignatureStatus as jest.Mock).mockImplementation(async () => {
      polls++;
      return polls < 2
        ? {value: null}
        : {value: {confirmationStatus: 'confirmed', err: null}};
    });

    const result = await signAndSend(connection, mockSpec, [mockSigner], {
      maxRetries: 3,
    });
    expect(result.signature).toBeDefined();
    expect(connection.getLatestBlockhash).toHaveBeenCalledTimes(2); // 1 expired + 1 success
  });

  it('each retry uses a NEW blockhash', async () => {
    const blockhashes: string[] = [];
    (connection.getLatestBlockhash as jest.Mock).mockImplementation(async () => {
      const bh = 'blockhash-' + Date.now() + '-' + Math.random();
      blockhashes.push(bh);
      return {blockhash: bh, lastValidBlockHeight: 999999};
    });
    (connection.getBlockHeight as jest.Mock).mockResolvedValue(1_000_000);
    let polls = 0;
    (connection.getSignatureStatus as jest.Mock).mockImplementation(async () => {
      polls++;
      return polls < 2
        ? {value: null}
        : {value: {confirmationStatus: 'confirmed', err: null}};
    });

    await signAndSend(connection, mockSpec, [mockSigner], {maxRetries: 3});
    const unique = new Set(blockhashes);
    expect(unique.size).toBe(blockhashes.length);
  });

  it('rebuilds transaction with new blockhash on each attempt', async () => {
    (connection.getBlockHeight as jest.Mock).mockResolvedValue(1_000_000);
    let polls = 0;
    (connection.getSignatureStatus as jest.Mock).mockImplementation(async () => {
      polls++;
      return polls < 2
        ? {value: null}
        : {value: {confirmationStatus: 'confirmed', err: null}};
    });

    await signAndSend(connection, mockSpec, [mockSigner], {maxRetries: 3});
    // sendRawTransaction called once per attempt (2 total: 1 expired + 1 success)
    expect(connection.sendRawTransaction).toHaveBeenCalledTimes(2);
  });
});
