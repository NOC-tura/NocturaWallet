import {PublicKey, SystemProgram, ComputeBudgetProgram} from '@solana/web3.js';
import {buildTransferTx, buildSPLTransferTx} from '../transactionBuilder';

jest.mock('../connection', () => ({
  getConnection: () => ({
    getLatestBlockhash: jest.fn(async () => ({
      blockhash: 'test-blockhash',
      lastValidBlockHeight: 999,
    })),
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('buildTransferTx', () => {
  const sender = new PublicKey('So11111111111111111111111111111111111111112');
  const recipient = new PublicKey('TokenAccountAddr111111111111111111111111111');

  it('builds a VersionedTransaction (has message property)', async () => {
    const tx = await buildTransferTx({
      sender,
      recipient,
      lamports: 1_000_000n,
    });

    expect(tx).toBeDefined();
    expect(tx.message).toBeDefined();
  });

  it('calls SystemProgram.transfer for the user transfer', async () => {
    await buildTransferTx({
      sender,
      recipient,
      lamports: 1_000_000n,
    });

    expect(SystemProgram.transfer).toHaveBeenCalledWith(
      expect.objectContaining({
        fromPubkey: sender,
        toPubkey: recipient,
        lamports: 1_000_000n,
      }),
    );
  });

  it('includes Noctura fee markup (SystemProgram.transfer called twice)', async () => {
    await buildTransferTx({
      sender,
      recipient,
      lamports: 1_000_000n,
    });

    expect(SystemProgram.transfer).toHaveBeenCalledTimes(2);
  });

  it('includes priority fee instruction when priorityFee specified', async () => {
    await buildTransferTx({
      sender,
      recipient,
      lamports: 1_000_000n,
      priorityFee: 5000,
    });

    expect(ComputeBudgetProgram.setComputeUnitPrice).toHaveBeenCalledWith({
      microLamports: 5000,
    });
  });

  it('does not include priority fee instruction when not specified', async () => {
    await buildTransferTx({
      sender,
      recipient,
      lamports: 1_000_000n,
    });

    expect(ComputeBudgetProgram.setComputeUnitPrice).not.toHaveBeenCalled();
  });
});

describe('buildSPLTransferTx', () => {
  const sender = new PublicKey('So11111111111111111111111111111111111111112');
  const recipient = new PublicKey('TokenAccountAddr111111111111111111111111111');
  const mint = new PublicKey('B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW');

  it('builds a VersionedTransaction', async () => {
    const tx = await buildSPLTransferTx({
      sender,
      recipient,
      mint,
      amount: 1_000_000_000n,
      decimals: 9,
    });

    expect(tx).toBeDefined();
    expect(tx.message).toBeDefined();
  });
});
