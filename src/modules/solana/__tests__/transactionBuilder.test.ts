import {PublicKey, SystemProgram, ComputeBudgetProgram} from '@solana/web3.js';
import type {VersionedTransaction} from '@solana/web3.js';
import {buildTransferTx, buildSPLTransferTx} from '../transactionBuilder';

/**
 * Helper to extract instructions from a VersionedTransaction in tests.
 *
 * The production type for VersionedTransaction.message is VersionedMessage
 * which does not expose `.instructions`.  The Jest mock uses MessageV0 which
 * does.  Casting through `unknown` lets us access the mock property without
 * suppressing broader type checking.
 */
function txInstructions(
  tx: VersionedTransaction,
): Array<{data: Uint8Array; programId: unknown; keys: unknown[]}> {
  return (tx.message as unknown as {instructions: Array<{data: Uint8Array; programId: unknown; keys: unknown[]}>})
    .instructions;
}

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

  it('includes a TransferChecked instruction with discriminator byte 12', async () => {
    const tx = await buildSPLTransferTx({
      sender,
      recipient,
      mint,
      amount: 1_000_000_000n,
      decimals: 9,
    });

    // Instructions: [TransferChecked, fee markup SystemProgram.transfer]
    const instructions = txInstructions(tx);
    expect(instructions.length).toBeGreaterThanOrEqual(2);

    // The TransferChecked instruction is the first non-priority-fee instruction.
    // Without createAta and without priorityFee it is index 0.
    const transferCheckedIx = instructions[0];
    expect(transferCheckedIx).toBeDefined();
    expect(transferCheckedIx.data[0]).toBe(12); // discriminator
    // Verify programId is SPL Token Program
    const programId = transferCheckedIx.programId as {toBase58?: () => string};
    if (programId.toBase58) {
      expect(programId.toBase58()).toBe('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    }
  });

  it('encodes amount and decimals correctly in the instruction data', async () => {
    const amount = 500_000_000n;
    const decimals = 6;

    const tx = await buildSPLTransferTx({
      sender,
      recipient,
      mint,
      amount,
      decimals,
    });

    const transferCheckedIx = txInstructions(tx)[0];
    const data = Buffer.from(transferCheckedIx.data);

    // Byte 0: discriminator = 12
    expect(data.readUInt8(0)).toBe(12);
    // Bytes 1-8: amount as u64 LE
    expect(data.readBigUInt64LE(1)).toBe(amount);
    // Byte 9: decimals
    expect(data.readUInt8(9)).toBe(decimals);
  });

  it('includes the ATA creation instruction when createAta is true', async () => {
    const tx = await buildSPLTransferTx({
      sender,
      recipient,
      mint,
      amount: 1_000_000_000n,
      decimals: 9,
      createAta: true,
    });

    // Instructions: [createAta, TransferChecked, fee markup]
    expect(txInstructions(tx).length).toBe(3);
  });

  it('includes priority fee instruction when priorityFee is specified', async () => {
    await buildSPLTransferTx({
      sender,
      recipient,
      mint,
      amount: 1_000_000_000n,
      decimals: 9,
      priorityFee: 5000,
    });

    expect(ComputeBudgetProgram.setComputeUnitPrice).toHaveBeenCalledWith({
      microLamports: 5000,
    });
  });
});
