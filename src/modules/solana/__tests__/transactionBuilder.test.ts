import {PublicKey, SystemProgram, ComputeBudgetProgram} from '@solana/web3.js';
import type {VersionedTransaction} from '@solana/web3.js';
import {
  buildTransferTx,
  buildSPLTransferTx,
  buildTransferInstructions,
  buildSPLTransferInstructions,
  getTransferMarkupLamports,
} from '../transactionBuilder';
import {usePresaleStore} from '../../../store/zustand/presaleStore';
import {TRANSPARENT_FEES} from '../../../constants/programs';

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
  // The app's default state. Tests that exercise the post-TGE markup set this
  // explicitly; without the reset, ordering between tests would decide whether
  // a markup instruction is appended.
  usePresaleStore.setState({tgeStatus: 'pre_tge', isZeroFeeEligible: false});
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

  it('pre-TGE, charges no Noctura markup (one SystemProgram.transfer)', async () => {
    usePresaleStore.setState({tgeStatus: 'pre_tge', isZeroFeeEligible: false});
    await buildTransferTx({sender, recipient, lamports: 1_000_000n});

    expect(SystemProgram.transfer).toHaveBeenCalledTimes(1);
  });

  it('post-TGE, adds the Noctura markup as a second SystemProgram.transfer', async () => {
    usePresaleStore.setState({tgeStatus: 'claimable', isZeroFeeEligible: false});
    await buildTransferTx({sender, recipient, lamports: 1_000_000n});

    expect(SystemProgram.transfer).toHaveBeenCalledTimes(2);
    expect(SystemProgram.transfer).toHaveBeenLastCalledWith(
      expect.objectContaining({lamports: TRANSPARENT_FEES.transferMarkup}),
    );
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

    // Instructions pre-TGE: [TransferChecked] (the markup is waived, so no
    // second SystemProgram.transfer is appended).
    const instructions = txInstructions(tx);
    expect(instructions.length).toBeGreaterThanOrEqual(1);

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

    // Instructions pre-TGE: [createAta, TransferChecked] — markup waived.
    expect(txInstructions(tx).length).toBe(2);
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

  it('omits the fee-markup transfer while the effective markup is zero', () => {
    // Pre-TGE the fee engine returns 0n, and the design's send screen (#12)
    // shows a single "Network fee" line with no Noctura markup row. Appending a
    // 20_000-lamport transfer the UI never shows is an undisclosed charge, and
    // it also makes MAX-send unpayable.
    usePresaleStore.setState({tgeStatus: 'pre_tge', isZeroFeeEligible: false});
    const ix = buildTransferInstructions({sender: A, recipient: B, lamports: 1_000n});
    expect(ix.length).toBe(1);
  });

  it('includes the fee-markup transfer once the markup becomes non-zero', () => {
    usePresaleStore.setState({tgeStatus: 'claimable', isZeroFeeEligible: false});
    const ix = buildTransferInstructions({sender: A, recipient: B, lamports: 1_000n});
    expect(ix.length).toBe(2);
    expect(getTransferMarkupLamports()).toBe(TRANSPARENT_FEES.transferMarkup);
  });

  it('reports the same markup the builder charges', () => {
    // One source of truth: whatever the screen budgets for must equal what the
    // builder appends, or MAX-send and the balance check are wrong again.
    usePresaleStore.setState({tgeStatus: 'pre_tge', isZeroFeeEligible: false});
    const zero = getTransferMarkupLamports();
    const ixZero = buildTransferInstructions({sender: A, recipient: B, lamports: 1_000n});
    expect(zero).toBe(0n);
    expect(ixZero.length).toBe(1);

    usePresaleStore.setState({tgeStatus: 'claimable', isZeroFeeEligible: false});
    const charged = getTransferMarkupLamports();
    const ixCharged = buildTransferInstructions({sender: A, recipient: B, lamports: 1_000n});
    expect(charged).toBeGreaterThan(0n);
    expect(ixCharged.length).toBe(2);
  });

  it('priority fee prepends a compute-budget instruction', () => {
    const ix = buildTransferInstructions({
      sender: A,
      recipient: B,
      lamports: 1_000n,
      priorityFee: 15_000,
    });
    // priority-price + recipient transfer = 2 (markup waived pre-TGE)
    expect(ix.length).toBe(2);
  });

  it('SPL transfer with createAta yields ata + transfer (markup waived)', () => {
    const ix = buildSPLTransferInstructions({
      sender: A,
      recipient: B,
      mint: MINT,
      amount: 1_000n,
      decimals: 9,
      createAta: true,
    });
    expect(ix.length).toBe(2);
  });

  it('prepends a setComputeUnitLimit when computeUnitLimit is given', () => {
    const ix = buildTransferInstructions({
      sender: A, recipient: B, lamports: 1_000n, priorityFee: 15_000, computeUnitLimit: 450,
    });
    // compute-limit + priority-price + recipient transfer = 3 (markup waived)
    expect(ix.length).toBe(3);
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

  it('uses the provided sourceTokenAccount as the TransferChecked source', () => {
    // A wallet may hold the mint in a non-canonical account; the transfer must
    // spend from THAT account, not the derived ATA.
    const source = new PublicKey('FpV5mr137k3GfLJqqWnZer12v2KxZfEEQzxXb6sJLABU');
    const ix = buildSPLTransferInstructions({
      sender: A, recipient: B, mint: MINT, amount: 1_000n, decimals: 9, createAta: false,
      sourceTokenAccount: source,
    });
    const tc = findTransferChecked(ix) as {keys: {pubkey: PublicKey}[]} | undefined;
    expect(tc).toBeDefined();
    // TransferChecked keys: [source, mint, destination, owner] → keys[0] is the source.
    expect(tc!.keys[0].pubkey.toBase58()).toBe(source.toBase58());
  });

  it('falls back to the canonical sender ATA when no sourceTokenAccount is given', () => {
    const ix = buildSPLTransferInstructions({
      sender: A, recipient: B, mint: MINT, amount: 1_000n, decimals: 9, createAta: false,
    });
    const tc = findTransferChecked(ix) as {keys: {pubkey: PublicKey}[]} | undefined;
    expect(tc!.keys[0].pubkey.toBase58()).toBe(findAssociatedTokenAddress(A, MINT).toBase58());
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
import {resolveCreateAta, findAssociatedTokenAddress, resolveSourceTokenAccount} from '../transactionBuilder';
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

// ── resolveSourceTokenAccount ─────────────────────────────────────────────────
describe('resolveSourceTokenAccount', () => {
  const owner = new PublicKey('So11111111111111111111111111111111111111112');
  const mint = new PublicKey('B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW');
  const a1 = new PublicKey('4G8U5nQtNciNaEL7Zimb4DhqeanDMevXp7MLtFvUojwF');
  const a2 = new PublicKey('FpV5mr137k3GfLJqqWnZer12v2KxZfEEQzxXb6sJLABU');

  const connWith = (accts: {pubkey: PublicKey; amount: string}[]) =>
    ({
      getParsedTokenAccountsByOwner: jest.fn(async () => ({
        value: accts.map(a => ({
          pubkey: a.pubkey,
          account: {data: {parsed: {info: {tokenAmount: {amount: a.amount}}}}},
        })),
      })),
    }) as never;

  it('returns the largest-balance account for the mint (handles non-canonical accounts)', async () => {
    const conn = connWith([
      {pubkey: a1, amount: '5'},
      {pubkey: a2, amount: '13399619'},
    ]);
    const result = await resolveSourceTokenAccount(conn, owner, mint);
    expect(result?.toBase58()).toBe(a2.toBase58());
  });

  it('returns null when the owner holds no account for the mint', async () => {
    expect(await resolveSourceTokenAccount(connWith([]), owner, mint)).toBeNull();
  });

  it('throws a clear error when no single account covers the required amount', async () => {
    // Displayed balance is the SUM (100 + 60 = 160), but TransferChecked spends
    // from one account and is all-or-nothing. Sending 160 must fail here with an
    // explanation, not on-chain with an opaque error.
    const conn = connWith([
      {pubkey: a1, amount: '100'},
      {pubkey: a2, amount: '60'},
    ]);
    await expect(resolveSourceTokenAccount(conn, owner, mint, 160n)).rejects.toThrow(
      /split across/i,
    );
  });

  it('returns the largest account when it does cover the required amount', async () => {
    const conn = connWith([
      {pubkey: a1, amount: '100'},
      {pubkey: a2, amount: '60'},
    ]);
    const result = await resolveSourceTokenAccount(conn, owner, mint, 100n);
    expect(result?.toBase58()).toBe(a1.toBase58());
  });
});

// ── createAta uses the real Associated Token Account program ──────────────────
describe('Associated Token Account program id', () => {
  it('builds the create-ATA instruction against the canonical ATA program', () => {
    // The create-ATA instruction has an empty data payload. Its programId MUST
    // be the real ATA program; a typo'd id (the bug that broke every SPL send
    // with on-chain ProgramAccountNotFound → "Check the address") would not
    // exist on-chain. Verified against mainnet.
    const A = new PublicKey('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
    const B = new PublicKey('EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o');
    const MINT = new PublicKey('B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW');
    const ix = buildSPLTransferInstructions({
      sender: A, recipient: B, mint: MINT, amount: 1_000n, decimals: 9, createAta: true,
    });
    const createAtaIx = ix.find(i => i.data.length === 0);
    expect(createAtaIx).toBeDefined();
    expect(createAtaIx!.programId.toBase58()).toBe(
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
    );
  });
});
