import {Connection, VersionedTransaction, MessageV0} from '@solana/web3.js';
import {simulateTransaction} from '../simulation';

function makeTx(): VersionedTransaction {
  const msg = new MessageV0({recentBlockhash: 'test-blockhash', instructions: []});
  return new VersionedTransaction(msg);
}

describe('simulateTransaction', () => {
  it('returns {success: true} when simulation passes (err: null)', async () => {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    (connection.simulateTransaction as jest.Mock).mockResolvedValueOnce({
      value: {err: null, logs: [], unitsConsumed: 200_000},
    });

    const result = await simulateTransaction(connection, makeTx());

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("maps 'InsufficientFunds' error → E010", async () => {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    (connection.simulateTransaction as jest.Mock).mockResolvedValueOnce({
      value: {err: 'InsufficientFunds', logs: [], unitsConsumed: 0},
    });

    const result = await simulateTransaction(connection, makeTx());

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('E010');
  });

  it("maps 'InsufficientFundsForRent' → E012", async () => {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    (connection.simulateTransaction as jest.Mock).mockResolvedValueOnce({
      value: {err: 'InsufficientFundsForRent', logs: [], unitsConsumed: 0},
    });

    const result = await simulateTransaction(connection, makeTx());

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('E012');
  });

  it("maps unknown errors → E020 (TX_SIMULATION_FAILED)", async () => {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    (connection.simulateTransaction as jest.Mock).mockResolvedValueOnce({
      value: {err: 'SomeWeirdUnknownError', logs: [], unitsConsumed: 0},
    });

    const result = await simulateTransaction(connection, makeTx());

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('E020');
  });

  it('handles RPC errors gracefully (connection.simulateTransaction rejects)', async () => {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    (connection.simulateTransaction as jest.Mock).mockRejectedValueOnce(
      new Error('Network error'),
    );

    const result = await simulateTransaction(connection, makeTx());

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('E020');
  });

  it('returns logs and unitsConsumed when available', async () => {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    (connection.simulateTransaction as jest.Mock).mockResolvedValueOnce({
      value: {
        err: null,
        logs: ['Program log: Hello', 'Program log: World'],
        unitsConsumed: 50_000,
      },
    });

    const result = await simulateTransaction(connection, makeTx());

    expect(result.success).toBe(true);
    expect(result.logs).toEqual(['Program log: Hello', 'Program log: World']);
    expect(result.unitsConsumed).toBe(50_000);
  });

  it("maps 'AccountNotFound' error → E024", async () => {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    (connection.simulateTransaction as jest.Mock).mockResolvedValueOnce({
      value: {err: 'AccountNotFound', logs: [], unitsConsumed: 0},
    });

    const result = await simulateTransaction(connection, makeTx());

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('E024');
  });
});
