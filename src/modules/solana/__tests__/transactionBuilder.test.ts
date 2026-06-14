import {PublicKey, SystemProgram, ComputeBudgetProgram} from '@solana/web3.js';
import type {VersionedTransaction} from '@solana/web3.js';
import {
  buildTransferTx,
  buildSPLTransferTx,
  buildTransferInstructions,
  buildSPLTransferInstructions,
} from '../transactionBuilder';

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

describe('instruction builders', () => {
  const A = new PublicKey('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
  const B = new PublicKey('EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o');
  const MINT = new PublicKey('B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW');

  it('SOL transfer yields transfer + fee-markup instructions', () => {
    const ix = buildTransferInstructions({sender: A, recipient: B, lamports: 1_000n});
    // recipient transfer + Noctura fee markup transfer = 2 (no priority fee)
    expect(ix.length).toBe(2);
  });

  it('priority fee prepends a compute-budget instruction', () => {
    const ix = buildTransferInstructions({
      sender: A,
      recipient: B,
      lamports: 1_000n,
      priorityFee: 15_000,
    });
    expect(ix.length).toBe(3);
  });

  it('SPL transfer with createAta yields ata + transfer + fee-markup', () => {
    const ix = buildSPLTransferInstructions({
      sender: A,
      recipient: B,
      mint: MINT,
      amount: 1_000n,
      decimals: 9,
      createAta: true,
    });
    expect(ix.length).toBe(3);
  });

  it('prepends a setComputeUnitLimit when computeUnitLimit is given', () => {
    const ix = buildTransferInstructions({
      sender: A, recipient: B, lamports: 1_000n, priorityFee: 15_000, computeUnitLimit: 450,
    });
    // priority-price + compute-limit + recipient transfer + fee markup = 4
    expect(ix.length).toBe(4);
  });

  // The TransferChecked instruction is the 10-byte one whose first byte is the
  // discriminator 12. Layout: [12][amount u64 little-endian (8 bytes)][decimals u8].
  const findTransferChecked = (ixs: {data: Uint8Array}[]) =>
    ixs.find(ix => ix.data.length === 10 && ix.data[0] === 12);

  it('encodes the TransferChecked u64 amount as little-endian bytes', () => {
    const ix = buildSPLTransferInstructions({
      sender: A, recipient: B, mint: MINT, amount: 500_000_000n, decimals: 9, createAta: false,
    });
    const tc = findTransferChecked(ix);
    expect(tc).toBeDefined();
    // 500_000_000 = 0x1DCD6500 → LE: 00 65 CD 1D 00 00 00 00
    expect([...tc!.data]).toEqual([12, 0x00, 0x65, 0xcd, 0x1d, 0, 0, 0, 0, 9]);
  });

  it('builds the TransferChecked without Buffer.writeBigUInt64LE (Hermes polyfill lacks it)', () => {
    // The Hermes Buffer polyfill (buffer@5.7.1) has no writeBigUInt64LE. Simulate
    // that environment by removing the method, then confirm the amount is still
    // encoded correctly via manual little-endian byte writes.
    type BufProto = {writeBigUInt64LE?: (value: bigint, offset?: number) => number};
    const proto = Buffer.prototype as unknown as BufProto;
    const original = proto.writeBigUInt64LE;
    proto.writeBigUInt64LE = undefined;
    try {
      const ix = buildSPLTransferInstructions({
        sender: A, recipient: B, mint: MINT, amount: 1n, decimals: 0, createAta: false,
      });
      const tc = findTransferChecked(ix);
      expect(tc).toBeDefined();
      expect([...tc!.data]).toEqual([12, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
    } finally {
      proto.writeBigUInt64LE = original;
    }
  });
});

// ── resolveCreateAta ──────────────────────────────────────────────────────────
import {resolveCreateAta, findAssociatedTokenAddress} from '../transactionBuilder';
import {getAccountInfo} from '../queries';

jest.mock('../queries', () => ({
  getAccountInfo: jest.fn(),
}));

const mockGetAccountInfo = getAccountInfo as jest.MockedFunction<typeof getAccountInfo>;

describe('resolveCreateAta', () => {
  const recipient = new PublicKey('So11111111111111111111111111111111111111112');
  const mint = new PublicKey('TokenAccountAddr111111111111111111111111111');
  const fakeConn = {} as never; // getAccountInfo is mocked, connection unused

  it('returns false when the recipient ATA already exists (no creation needed)', async () => {
    mockGetAccountInfo.mockResolvedValue({exists: true, executable: false});
    expect(await resolveCreateAta(fakeConn, recipient, mint)).toBe(false);
  });

  it('returns true when the recipient ATA does not exist (must be created)', async () => {
    mockGetAccountInfo.mockResolvedValue({exists: false, executable: false});
    expect(await resolveCreateAta(fakeConn, recipient, mint)).toBe(true);
  });

  it('checks the canonical ATA address for the recipient + mint', async () => {
    mockGetAccountInfo.mockResolvedValue({exists: true, executable: false});
    await resolveCreateAta(fakeConn, recipient, mint);
    const expectedAta = findAssociatedTokenAddress(recipient, mint);
    expect(mockGetAccountInfo).toHaveBeenCalledWith(fakeConn, expectedAta);
  });
});
