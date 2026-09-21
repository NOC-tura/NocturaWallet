import {PublicKey} from '@solana/web3.js';
import {
  buildBuyInstructions,
  buildSolPurchaseInstruction,
  encodeU64LE,
} from '../buyInstructions';
import {derivePresalePdas} from '../allocation';

const USER = new PublicKey('Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B');
const R2 = new PublicKey('9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4');

describe('encodeU64LE', () => {
  it('encodes little-endian by hand — buffer@5.7.1 has no writeBigUInt64LE', () => {
    expect([...encodeU64LE(1n)]).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
    expect([...encodeU64LE(2n ** 64n - 1n)]).toEqual([255, 255, 255, 255, 255, 255, 255, 255]);
    expect([...encodeU64LE(0n)]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('refuses a value outside u64 rather than wrapping it silently', () => {
    expect(() => encodeU64LE(-1n)).toThrow(/out of u64 range/);
    expect(() => encodeU64LE(2n ** 64n)).toThrow(/out of u64 range/);
  });
});

describe('buildSolPurchaseInstruction', () => {
  it('puts the discriminator first and the amount after it', () => {
    const ix = buildSolPurchaseInstruction(USER, 1_000_000_000n, PublicKey.default);
    expect(ix.data.length).toBe(16);
    expect([...ix.data.subarray(8)]).toEqual([...encodeU64LE(1_000_000_000n)]);
  });

  it('keeps the authoritative account order, with the referrer allocation fourth', () => {
    const ix = buildSolPurchaseInstruction(USER, 1n, R2);
    const {config, userAccount, userAllocation} = derivePresalePdas(USER);
    expect(ix.keys[0]!.pubkey.toBase58()).toBe(config.toBase58());
    expect(ix.keys[1]!.pubkey.toBase58()).toBe(userAccount.toBase58());
    expect(ix.keys[2]!.pubkey.toBase58()).toBe(userAllocation.toBase58());
    expect(ix.keys[3]!.pubkey.toBase58()).toBe(R2.toBase58());
    expect(ix.keys[5]!.pubkey.toBase58()).toBe(USER.toBase58());
    expect(ix.keys[5]!.isSigner).toBe(true);
  });

  it('carries whatever referrer allocation it is given — never one derived from the buyer', () => {
    // The program validates referrer_allocation against ["allocation", user_allocation.referrer],
    // so a value derived from the buyer makes every referred buyer's transaction fail.
    const mine = buildSolPurchaseInstruction(USER, 1n, R2).keys[3]!.pubkey.toBase58();
    expect(mine).toBe(R2.toBase58());
    expect(mine).not.toBe(derivePresalePdas(USER).referrerAllocation.toBase58());
  });
});

describe('buildBuyInstructions', () => {
  const resolved = {referrerAllocation: PublicKey.default, registerReferrer: null};

  it('sets a compute unit limit and price before the purchase', () => {
    const ixs = buildBuyInstructions(USER, 1n, 1000, resolved);
    expect(ixs.length).toBe(3);
    expect(ixs[0]!.programId.toBase58()).toBe('ComputeBudget111111111111111111111111111111');
    expect(ixs[1]!.programId.toBase58()).toBe('ComputeBudget111111111111111111111111111111');
  });

  it('carries the priority fee into the instruction data (positive control)', () => {
    const cheap = buildBuyInstructions(USER, 1n, 0, resolved)[1]!.data;
    const dear = buildBuyInstructions(USER, 1n, 25_000, resolved)[1]!.data;
    expect([...cheap]).not.toEqual([...dear]);
  });

  it('bundles register_referrer only when one is resolved', () => {
    const without = buildBuyInstructions(USER, 1n, 0, resolved);
    const with_ = buildBuyInstructions(USER, 1n, 0, {referrerAllocation: R2, registerReferrer: R2});
    expect(with_.length).toBe(without.length + 1);
  });
});
