import {Connection, PublicKey} from '@solana/web3.js';
import {getBalance, getTokenAccounts, getTransactionHistory} from '../queries';

describe('getBalance', () => {
  it('returns bigint (not number)', async () => {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    (connection.getBalance as jest.Mock).mockResolvedValueOnce(2_500_000_000);

    const owner = new PublicKey('So11111111111111111111111111111111111111112');
    const result = await getBalance(connection, owner);

    expect(typeof result).toBe('bigint');
    expect(result).toBe(2_500_000_000n);
  });

  it('calls RPC with correct pubkey', async () => {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    (connection.getBalance as jest.Mock).mockResolvedValueOnce(0);

    const owner = new PublicKey('So11111111111111111111111111111111111111112');
    await getBalance(connection, owner);

    expect(connection.getBalance).toHaveBeenCalledWith(owner);
  });
});

describe('getTokenAccounts', () => {
  it('parses token account response correctly', async () => {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const owner = new PublicKey('So11111111111111111111111111111111111111112');

    const mockAccount = {
      pubkey: new PublicKey('TokenAccountAddr111111111111111111111111111'),
      account: {
        data: {
          parsed: {
            info: {
              mint: 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW',
              owner: 'So11111111111111111111111111111111111111112',
              tokenAmount: {
                amount: '1000000000',
                decimals: 9,
                uiAmount: 1.0,
                uiAmountString: '1',
              },
            },
          },
        },
      },
    };

    (connection.getParsedTokenAccountsByOwner as jest.Mock).mockResolvedValueOnce({
      value: [mockAccount],
    });

    const result = await getTokenAccounts(connection, owner);

    expect(result).toHaveLength(1);
    expect(result[0].mint).toBe('B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW');
    expect(result[0].owner).toBe('So11111111111111111111111111111111111111112');
    expect(result[0].amount).toBe('1000000000');
    expect(result[0].decimals).toBe(9);
    expect(result[0].address).toBe('TokenAccountAddr111111111111111111111111111');
  });

  it('returns empty array for no accounts', async () => {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const owner = new PublicKey('So11111111111111111111111111111111111111112');

    (connection.getParsedTokenAccountsByOwner as jest.Mock).mockResolvedValueOnce({
      value: [],
    });

    const result = await getTokenAccounts(connection, owner);

    expect(result).toEqual([]);
  });
});

describe('getTransactionHistory', () => {
  it('returns parsed transactions with confirmed/failed status from getSignaturesForAddress', async () => {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const address = new PublicKey('So11111111111111111111111111111111111111112');

    const mockSignatures = [
      {
        signature: 'sig1111111111111111111111111111111111111111111111111111111111111111',
        slot: 100,
        blockTime: 1700000000,
        confirmationStatus: 'confirmed',
        err: null,
      },
      {
        signature: 'sig2222222222222222222222222222222222222222222222222222222222222222',
        slot: 101,
        blockTime: 1700000001,
        confirmationStatus: 'finalized',
        err: {InstructionError: [0, 'Custom']},
      },
    ];

    (connection.getSignaturesForAddress as jest.Mock).mockResolvedValueOnce(mockSignatures);

    const result = await getTransactionHistory(connection, address, {limit: 10});

    expect(result).toHaveLength(2);
    expect(result[0].signature).toBe(mockSignatures[0].signature);
    expect(result[0].slot).toBe(100);
    expect(result[0].timestamp).toBe(1700000000);
    expect(result[0].status).toBe('confirmed');

    expect(result[1].signature).toBe(mockSignatures[1].signature);
    expect(result[1].status).toBe('failed');
  });

  it('passes limit and before options to getSignaturesForAddress', async () => {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const address = new PublicKey('So11111111111111111111111111111111111111112');

    (connection.getSignaturesForAddress as jest.Mock).mockResolvedValueOnce([]);

    await getTransactionHistory(connection, address, {
      limit: 5,
      before: 'some-signature',
    });

    expect(connection.getSignaturesForAddress).toHaveBeenCalledWith(address, {
      limit: 5,
      before: 'some-signature',
    });
  });
});
