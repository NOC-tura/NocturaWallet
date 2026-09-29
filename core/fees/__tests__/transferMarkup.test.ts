import {applyStakingDiscount, effectiveFee, MAINNET_FEE_TREASURY, TRANSFER_MARKUP_LAMPORTS, type FeePolicyInputs} from '../transferMarkup';

const post: FeePolicyInputs = {tgeStatus: 'claimable', isZeroFeeEligible: false, stakingDiscount: 0};

describe('the transparent-transfer markup policy', () => {
  it('is 20 000 lamports to the Squads fee vault', () => {
    expect(TRANSFER_MARKUP_LAMPORTS).toBe(20_000n);
    expect(MAINNET_FEE_TREASURY).toBe('6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd');
  });

  it('charges nothing before TGE', () => {
    expect(effectiveFee(TRANSFER_MARKUP_LAMPORTS, {...post, tgeStatus: 'pre_tge'})).toEqual({lamports: 0n, reason: 'pre-tge'});
  });

  it('charges nothing to a zero-fee-eligible user', () => {
    expect(effectiveFee(TRANSFER_MARKUP_LAMPORTS, {...post, isZeroFeeEligible: true})).toEqual({lamports: 0n, reason: 'zero-fee-eligible'});
  });

  it('charges nothing when either status is unknown — the extension has no source for them yet', () => {
    expect(effectiveFee(TRANSFER_MARKUP_LAMPORTS, {...post, tgeStatus: 'unknown'})).toEqual({lamports: 0n, reason: 'status-unknown'});
    expect(effectiveFee(TRANSFER_MARKUP_LAMPORTS, {...post, isZeroFeeEligible: 'unknown'})).toEqual({lamports: 0n, reason: 'status-unknown'});
  });

  it('charges the markup after TGE (positive control), minus a staking discount in whole percent', () => {
    expect(effectiveFee(TRANSFER_MARKUP_LAMPORTS, post)).toEqual({lamports: 20_000n, reason: 'charged'});
    expect(effectiveFee(TRANSFER_MARKUP_LAMPORTS, {...post, tgeStatus: 'claimed', stakingDiscount: 0.1})).toEqual({lamports: 18_000n, reason: 'charged'});
    expect(applyStakingDiscount(500_000n, 0.3)).toBe(350_000n);
  });

  it('clamps a discount outside [0, 1] and ignores NaN — never a negative fee', () => {
    expect(applyStakingDiscount(20_000n, 1.5)).toBe(0n);
    expect(applyStakingDiscount(20_000n, -0.5)).toBe(20_000n);
    expect(applyStakingDiscount(20_000n, Number.NaN)).toBe(20_000n);
  });
});
