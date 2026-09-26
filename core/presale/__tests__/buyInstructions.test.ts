import {PublicKey} from '@solana/web3.js';
import {
  buildBuyInstructions,
  buildSolPurchaseInstruction,
  buildStablecoinPurchaseInstruction,
  findAssociatedTokenAddress,
  encodeU64LE,
} from '../buyInstructions';
import {derivePresalePdas} from '../allocation';

const USER = new PublicKey('Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B');
const R2 = new PublicKey('9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4');
/** The live treasury, as the program's config holds it. */
const TREASURY = new PublicKey('6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd');

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
    const ix = buildSolPurchaseInstruction(USER, 1_000_000_000n, PublicKey.default, TREASURY);
    expect(ix.data.length).toBe(16);
    expect([...ix.data.subarray(8)]).toEqual([...encodeU64LE(1_000_000_000n)]);
  });

  it('keeps the authoritative account order, with the referrer allocation fourth', () => {
    const ix = buildSolPurchaseInstruction(USER, 1n, R2, TREASURY);
    const {config, userAccount, userAllocation} = derivePresalePdas(USER);
    expect(ix.keys[0]!.pubkey.toBase58()).toBe(config.toBase58());
    expect(ix.keys[1]!.pubkey.toBase58()).toBe(userAccount.toBase58());
    expect(ix.keys[2]!.pubkey.toBase58()).toBe(userAllocation.toBase58());
    expect(ix.keys[3]!.pubkey.toBase58()).toBe(R2.toBase58());
    expect(ix.keys[5]!.pubkey.toBase58()).toBe(USER.toBase58());
    expect(ix.keys[5]!.isSigner).toBe(true);
  });

  it('carries whatever TREASURY it is given — never a constant of its own', () => {
    // The regression this pins: on 2026-09-21 the program began validating the purchase
    // destination against config.sol_treasury, and both the website and this wallet were
    // still deriving it from a built-in admin address. The account list had not moved, so
    // both concluded nothing had to change; the value inside one slot was what moved.
    const elsewhere = new PublicKey('BMLGUnWW2odX2sNnDcbvf5EFQJwrCtLaX6ka2rXfeKYi');
    const ix = buildSolPurchaseInstruction(USER, 1n, R2, elsewhere);
    expect(ix.keys[6]!.pubkey.toBase58()).toBe(elsewhere.toBase58());
    expect(ix.keys[6]!.pubkey.toBase58()).not.toBe(TREASURY.toBase58());
  });

  it('carries whatever referrer allocation it is given — never one derived from the buyer', () => {
    // The program validates referrer_allocation against ["allocation", user_allocation.referrer],
    // so a value derived from the buyer makes every referred buyer's transaction fail.
    const mine = buildSolPurchaseInstruction(USER, 1n, R2, TREASURY).keys[3]!.pubkey.toBase58();
    expect(mine).toBe(R2.toBase58());
    expect(mine).not.toBe(derivePresalePdas(USER).referrerAllocation.toBase58());
  });
});

describe('buildBuyInstructions', () => {
  const resolved = {referrerAllocation: PublicKey.default, registerReferrer: null};

  it('sets a compute unit limit and price before the purchase', () => {
    const ixs = buildBuyInstructions(USER, 1n, 1000, resolved, TREASURY);
    expect(ixs.length).toBe(3);
    expect(ixs[0]!.programId.toBase58()).toBe('ComputeBudget111111111111111111111111111111');
    expect(ixs[1]!.programId.toBase58()).toBe('ComputeBudget111111111111111111111111111111');
  });

  it('carries the priority fee into the instruction data (positive control)', () => {
    const cheap = buildBuyInstructions(USER, 1n, 0, resolved, TREASURY)[1]!.data;
    const dear = buildBuyInstructions(USER, 1n, 25_000, resolved, TREASURY)[1]!.data;
    expect([...cheap]).not.toEqual([...dear]);
  });

  it('bundles register_referrer only when one is resolved', () => {
    const without = buildBuyInstructions(USER, 1n, 0, resolved, TREASURY);
    const with_ = buildBuyInstructions(USER, 1n, 0, {referrerAllocation: R2, registerReferrer: R2}, TREASURY);
    expect(with_.length).toBe(without.length + 1);
  });
});

describe('buildStablecoinPurchaseInstruction — the destination', () => {
  const ADMIN = new PublicKey('KnZ5bRuaCb3JEAYgt9CJ69eWQ7i5dp5cASbTmLj39qr');
  const USDC = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

  it('pays the TREASURY, not the admin — the regression that was live for an evening', () => {
    // 2026-09-21: the program gained `stablecoin_ata_for_admin.owner == config.sol_treasury`
    // while both the wallet and the website still derived that account from ADMIN. Every
    // USDC/USDT purchase failed with InvalidTokenAccountOwner. The account LIST had not
    // moved, which is why both sides concluded nothing had to change.
    const {referrerAllocation} = derivePresalePdas(USER);
    const ix = buildStablecoinPurchaseInstruction(USER, 'USDC', 10_000_000n, referrerAllocation, TREASURY);
    expect(ix.keys[5]!.pubkey.toBase58()).toBe(findAssociatedTokenAddress(TREASURY, USDC).toBase58());
  });

  it('and those two really are different addresses (the control this test needs)', () => {
    // Without this the assertion above passes in any environment that derives both to the
    // same value — which is precisely what the app's Jest suite does, and why this test
    // lives in core rather than beside the code it came from.
    expect(findAssociatedTokenAddress(TREASURY, USDC).toBase58()).not.toBe(
      findAssociatedTokenAddress(ADMIN, USDC).toBase58(),
    );
  });

  it('carries whichever treasury it is handed, so a moved treasury is followed', () => {
    const elsewhere = new PublicKey('BMLGUnWW2odX2sNnDcbvf5EFQJwrCtLaX6ka2rXfeKYi');
    const {referrerAllocation} = derivePresalePdas(USER);
    const ix = buildStablecoinPurchaseInstruction(USER, 'USDT', 10_000_000n, referrerAllocation, elsewhere);
    expect(ix.keys[5]!.pubkey.toBase58()).not.toBe(
      buildStablecoinPurchaseInstruction(USER, 'USDT', 10_000_000n, referrerAllocation, TREASURY)
        .keys[5]!.pubkey.toBase58(),
    );
  });
});
