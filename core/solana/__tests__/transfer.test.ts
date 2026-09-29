import {Buffer} from 'buffer';
import {ComputeBudgetProgram, PublicKey, SystemProgram} from '@solana/web3.js';
import {
  BASE_FEE_LAMPORTS_PER_SIGNATURE, InsufficientTokenBalance, SPL_ATA_PROGRAM_ID, SPL_TOKEN_PROGRAM_ID, SYSTEM_ACCOUNT_RENT_LAMPORTS, SplitTokenBalance, TOKEN_ACCOUNT_RENT_LAMPORTS,
  TOKEN_ACCOUNT_SIZE, buildSolTransferInstructions, buildSplTransferInstructions, computeUnitLimitFor, findAssociatedTokenAddress,
  networkFeeLamports, priorityFeeLamports, selectSourceTokenAccount,
} from '../transfer';

const A = new PublicKey('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
const B = new PublicKey('EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o');
const MINT = new PublicKey('B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW');
const TREASURY = new PublicKey('6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd');
const HOLDING = new PublicKey('FpV5mr137k3GfLJqqWnZer12v2KxZfEEQzxXb6sJLABU');

/** SystemProgram.transfer data: u32 LE instruction index 2, then u64 LE lamports. */
function transferLamports(data: Uint8Array): bigint {
  expect([...data.subarray(0, 4)]).toEqual([2, 0, 0, 0]);
  let v = 0n;
  for (let i = 11; i >= 4; i--) v = (v << 8n) | BigInt(data[i] ?? 0);
  return v;
}

describe('fixed costs', () => {
  it('the rent for a new token account is the fixed minimum for 165 bytes', () => {
    expect(TOKEN_ACCOUNT_SIZE).toBe(165);
    // (data + 128 bytes of account overhead) × 3 480 lamports per byte-year × 2 years exempt.
    expect(TOKEN_ACCOUNT_RENT_LAMPORTS).toBe(BigInt((165 + 128) * 3480 * 2));
    expect(TOKEN_ACCOUNT_RENT_LAMPORTS).toBe(2_039_280n);
    expect(SYSTEM_ACCOUNT_RENT_LAMPORTS).toBe(BigInt(128 * 3480 * 2));
  });

  it('prices priority as ceil(price × units / 1e6) and the network fee as 5 000 per signature plus that', () => {
    expect(BASE_FEE_LAMPORTS_PER_SIGNATURE).toBe(5_000n);
    expect(priorityFeeLamports(50_000, 1_000)).toBe(50n);
    expect(priorityFeeLamports(1, 1)).toBe(1n);
    expect(priorityFeeLamports(0, 65_000)).toBe(0n);
    expect(priorityFeeLamports(150_000, 65_000)).toBe(9_750n);
    expect(networkFeeLamports(1, 50_000, 1_000)).toBe(5_050n);
    expect(networkFeeLamports(2, 0, 0)).toBe(10_000n);
    expect(() => priorityFeeLamports(-1, 1)).toThrow();
    expect(() => priorityFeeLamports(1.5, 1)).toThrow();
  });

  it('keeps the per-kind compute-unit limits', () => {
    expect(computeUnitLimitFor({kind: 'sol'})).toBe(1_000);
    expect(computeUnitLimitFor({kind: 'spl'})).toBe(40_000);
    expect(computeUnitLimitFor({kind: 'spl', createAta: true})).toBe(65_000);
  });
});

describe('buildSolTransferInstructions', () => {
  it('budget, transfer — and no markup instruction when there is no markup or it is zero', () => {
    for (const markup of [null, {lamports: 0n, treasury: TREASURY}]) {
      const ixs = buildSolTransferInstructions({sender: A, recipient: B, lamports: 1_000_000n, priorityFee: 50_000, computeUnitLimit: 1_000, markup});
      expect(ixs.map(ix => ix.programId.toBase58())).toEqual([
        ComputeBudgetProgram.programId.toBase58(),
        ComputeBudgetProgram.programId.toBase58(),
        SystemProgram.programId.toBase58(),
      ]);
      expect(transferLamports(ixs[2]!.data)).toBe(1_000_000n);
      expect(ixs[2]!.keys[1]!.pubkey.equals(B)).toBe(true);
    }
  });

  it('a non-zero markup is its own transfer to the treasury, last — never folded into the amount', () => {
    const ixs = buildSolTransferInstructions({sender: A, recipient: B, lamports: 1_000_000n, markup: {lamports: 20_000n, treasury: TREASURY}});
    expect(ixs).toHaveLength(2);
    expect(transferLamports(ixs[0]!.data)).toBe(1_000_000n);
    expect(ixs[1]!.keys[1]!.pubkey.equals(TREASURY)).toBe(true);
    expect(transferLamports(ixs[1]!.data)).toBe(20_000n);
  });
});

describe('buildSplTransferInstructions', () => {
  const tc = (ixs: {programId: PublicKey; data: Uint8Array}[]) => ixs.find(ix => ix.programId.equals(SPL_TOKEN_PROGRAM_ID) && ix.data[0] === 12);

  it('spends from the given holding account (non-canonical) to the recipient ATA, TransferChecked bytes by hand', () => {
    const ixs = buildSplTransferInstructions({sender: A, recipient: B, mint: MINT, amount: 1_000_000n, decimals: 9, sourceTokenAccount: HOLDING, markup: null});
    const ix = tc(ixs);
    expect([...(ix?.data ?? [])]).toEqual([12, 0x40, 0x42, 0x0f, 0, 0, 0, 0, 0, 9]);
    const keys = (ix as unknown as {keys: {pubkey: PublicKey}[]}).keys.map(k => k.pubkey.toBase58());
    expect(keys).toEqual([HOLDING.toBase58(), MINT.toBase58(), findAssociatedTokenAddress(B, MINT).toBase58(), A.toBase58()]);
  });

  it('falls back to the sender ATA when no holding account is given', () => {
    const ix = tc(buildSplTransferInstructions({sender: A, recipient: B, mint: MINT, amount: 1n, decimals: 9, markup: null}));
    expect((ix as unknown as {keys: {pubkey: PublicKey}[]}).keys[0]!.pubkey.equals(findAssociatedTokenAddress(A, MINT))).toBe(true);
  });

  it('creates the recipient ATA first when asked, against the real ATA program', () => {
    const ixs = buildSplTransferInstructions({sender: A, recipient: B, mint: MINT, amount: 1n, decimals: 9, createAta: true, markup: null});
    expect(ixs[0]!.programId.equals(SPL_ATA_PROGRAM_ID)).toBe(true);
    expect(ixs[0]!.data.length).toBe(0);
    expect(ixs[0]!.keys.map(k => k.pubkey.toBase58())).toEqual([
      A.toBase58(), findAssociatedTokenAddress(B, MINT).toBase58(), B.toBase58(), MINT.toBase58(),
      SystemProgram.programId.toBase58(), SPL_TOKEN_PROGRAM_ID.toBase58(),
    ]);
  });

  it('refuses an amount outside u64 and decimals outside 0–9', () => {
    expect(() => buildSplTransferInstructions({sender: A, recipient: B, mint: MINT, amount: 2n ** 64n, decimals: 9, markup: null})).toThrow(/out of u64 range/);
    expect(() => buildSplTransferInstructions({sender: A, recipient: B, mint: MINT, amount: 1n, decimals: 10, markup: null})).toThrow(/invalid decimals/);
  });

  it('encodes the amount without Buffer.writeBigUInt64LE — the Hermes buffer@5.7.1 polyfill has none', () => {
    const proto = Buffer.prototype as unknown as {writeBigUInt64LE?: unknown};
    const saved = proto.writeBigUInt64LE;
    proto.writeBigUInt64LE = undefined;
    try {
      const ix = tc(buildSplTransferInstructions({sender: A, recipient: B, mint: MINT, amount: 2n ** 64n - 1n, decimals: 6, markup: null}));
      expect([...(ix?.data ?? [])]).toEqual([12, 255, 255, 255, 255, 255, 255, 255, 255, 6]);
    } finally {
      proto.writeBigUInt64LE = saved;
    }
  });
});

describe('selectSourceTokenAccount', () => {
  it('returns the account holding the most, or null when there is none', () => {
    expect(selectSourceTokenAccount([{pubkey: 'a', amount: 5n}, {pubkey: 'b', amount: 13_399_619n}])).toBe('b');
    expect(selectSourceTokenAccount([])).toBeNull();
  });

  it('refuses an amount split across accounts — TransferChecked spends from one', () => {
    const accounts = [{pubkey: 'a', amount: 100n}, {pubkey: 'b', amount: 60n}];
    expect(() => selectSourceTokenAccount(accounts, 160n)).toThrow(SplitTokenBalance);
    expect(() => selectSourceTokenAccount(accounts, 160n)).toThrow(/split across/);
    expect(() => selectSourceTokenAccount(accounts, 161n)).toThrow(InsufficientTokenBalance);
    expect(selectSourceTokenAccount(accounts, 100n)).toBe('a');
  });
});
