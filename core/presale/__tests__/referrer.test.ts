import {PublicKey} from '@solana/web3.js';
import {derivePresalePdas} from '../allocation';
import {captureIsValid, resolveReferrerWith, type AllocationRef} from '../referrer';

const USER = new PublicKey('Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B');
const R2 = new PublicKey('9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4');

const refFor = (a: AllocationRef) => async () => a;

describe('resolveReferrerWith', () => {
  it('honours an existing on-chain referrer — the program validates against it', async () => {
    const r = await resolveReferrerWith(
      refFor({exists: true, referrer: R2.toBase58(), purchaseCount: 1}),
      USER,
      null,
    );
    expect(r.referrerAllocation.toBase58()).toBe(derivePresalePdas(R2).userAllocation.toBase58());
    expect(r.registerReferrer).toBeNull();
    expect(r.effectiveReferrerAddress).toBe(R2.toBase58());
  });

  it('ignores a captured referrer once the buyer already has an on-chain one', async () => {
    const other = PublicKey.unique().toBase58();
    const r = await resolveReferrerWith(
      refFor({exists: true, referrer: R2.toBase58(), purchaseCount: 3}),
      USER,
      other,
    );
    expect(r.referrerAllocation.toBase58()).toBe(derivePresalePdas(R2).userAllocation.toBase58());
    expect(r.registerReferrer).toBeNull();
  });

  it('registers a captured referrer for a first-time buyer, and points at the same one', async () => {
    const r = await resolveReferrerWith(
      refFor({exists: false, referrer: null, purchaseCount: 0}),
      USER,
      R2.toBase58(),
    );
    expect(r.registerReferrer?.toBase58()).toBe(R2.toBase58());
    expect(r.referrerAllocation.toBase58()).toBe(derivePresalePdas(R2).userAllocation.toBase58());
  });

  it('does not register a captured referrer once purchases exist', async () => {
    const r = await resolveReferrerWith(
      refFor({exists: true, referrer: null, purchaseCount: 2}),
      USER,
      R2.toBase58(),
    );
    expect(r.registerReferrer).toBeNull();
    expect(r.referrerAllocation.toBase58()).toBe(
      derivePresalePdas(PublicKey.default).userAllocation.toBase58(),
    );
  });

  it('falls back to the default PDA when there is no referrer at all (positive control)', async () => {
    const r = await resolveReferrerWith(refFor({exists: false, referrer: null, purchaseCount: 0}), USER, null);
    expect(r.referrerAllocation.toBase58()).toBe(
      derivePresalePdas(PublicKey.default).userAllocation.toBase58(),
    );
    expect(r.effectiveReferrerAddress).toBeNull();
  });
});

describe('captureIsValid', () => {
  it('accepts a real 32-byte base58 key that is not the buyer', () => {
    expect(captureIsValid(R2.toBase58(), USER)).toBe(true);
  });

  it('rejects self-referral, the default key, junk and null', () => {
    expect(captureIsValid(USER.toBase58(), USER)).toBe(false);
    expect(captureIsValid(PublicKey.default.toBase58(), USER)).toBe(false);
    expect(captureIsValid('not-base58!!', USER)).toBe(false);
    expect(captureIsValid(null, USER)).toBe(false);
  });
});
