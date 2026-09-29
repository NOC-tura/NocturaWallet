import {applyStakingDiscount, effectiveFee, MAINNET_FEE_TREASURY, TRANSFER_MARKUP_LAMPORTS} from '../../../../core/fees/transferMarkup';
import {NOCTURA_FEE_TREASURY, TRANSPARENT_FEES} from '../../../constants/programs';

// The root jest ignores core/ tests; this imports the moved policy from core/ so the app's own
// runner (Babel, the RN preset) proves it loads and behaves the same here.
describe('core/fees/transferMarkup, as the app imports it', () => {
  it('applies the rules the app has always applied', () => {
    expect(effectiveFee(20_000n, {tgeStatus: 'pre_tge', isZeroFeeEligible: false, stakingDiscount: 0}).lamports).toBe(0n);
    expect(effectiveFee(20_000n, {tgeStatus: 'claimable', isZeroFeeEligible: true, stakingDiscount: 0}).lamports).toBe(0n);
    expect(effectiveFee(20_000n, {tgeStatus: 'claimable', isZeroFeeEligible: false, stakingDiscount: 0}).lamports).toBe(20_000n);
    expect(applyStakingDiscount(500_000n, 0.1)).toBe(450_000n);
  });

  it('the app reads the same literals as core', () => {
    expect(TRANSPARENT_FEES.transferMarkup).toBe(TRANSFER_MARKUP_LAMPORTS);
    expect(NOCTURA_FEE_TREASURY).toBe(MAINNET_FEE_TREASURY);
  });
});
