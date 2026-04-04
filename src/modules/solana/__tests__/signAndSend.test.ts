import {Connection, VersionedTransaction, Keypair} from '@solana/web3.js';
import {signAndSend} from '../signAndSend';

describe('signAndSend', () => {
  let connection: Connection;
  const mockTx = new VersionedTransaction({} as never);
  const mockSigner = Keypair.fromSecretKey(new Uint8Array(64));

  beforeEach(() => {
    connection = new Connection('https://mock-rpc.com');
    jest.clearAllMocks();
  });

  it('returns signature and confirmation status on success', async () => {
    const result = await signAndSend(connection, mockTx, [mockSigner]);
    expect(result.signature).toBeDefined();
    expect(typeof result.signature).toBe('string');
    expect(result.confirmationStatus).toBe('confirmed');
  });

  it('throws with E022 after max retries', async () => {
    (connection.confirmTransaction as jest.Mock).mockRejectedValue(
      new Error('Transaction was not confirmed'),
    );
    (connection.getSignatureStatus as jest.Mock).mockResolvedValue({value: null});

    await expect(signAndSend(connection, mockTx, [mockSigner], {maxRetries: 1}))
      .rejects.toThrow('E022');
  });

  it('retries with new blockhash on expiry', async () => {
    let attempt = 0;
    (connection.confirmTransaction as jest.Mock).mockImplementation(async () => {
      attempt++;
      if (attempt < 2) throw new Error('Transaction expired');
      return {value: {err: null}};
    });

    const result = await signAndSend(connection, mockTx, [mockSigner], {maxRetries: 3});
    expect(result.signature).toBeDefined();
    expect(connection.getLatestBlockhash).toHaveBeenCalledTimes(attempt);
  });

  it('each retry uses a NEW blockhash', async () => {
    const blockhashes: string[] = [];
    (connection.getLatestBlockhash as jest.Mock).mockImplementation(async () => {
      const bh = 'blockhash-' + Date.now() + '-' + Math.random();
      blockhashes.push(bh);
      return {blockhash: bh, lastValidBlockHeight: 999999};
    });

    let attempt = 0;
    (connection.confirmTransaction as jest.Mock).mockImplementation(async () => {
      attempt++;
      if (attempt < 2) throw new Error('Block height exceeded');
      return {value: {err: null}};
    });

    await signAndSend(connection, mockTx, [mockSigner], {maxRetries: 3});
    const unique = new Set(blockhashes);
    expect(unique.size).toBe(blockhashes.length);
  });
});
