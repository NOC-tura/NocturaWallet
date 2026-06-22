import {presaleAllocationDisplay} from '../presaleAllocation';
import {formatBalanceForDisplay} from '../../../utils/parseTokenAmount';

describe('presaleAllocationDisplay', () => {
  it('hides when there is no allocation', () => {
    expect(presaleAllocationDisplay({tokensPurchased: '0', referralBonusTokens: '0'}).show).toBe(false);
    expect(presaleAllocationDisplay({tokensPurchased: '', referralBonusTokens: ''}).show).toBe(false);
  });

  it('shows the purchased amount when there is no bonus', () => {
    const r = presaleAllocationDisplay({tokensPurchased: '176282478348', referralBonusTokens: '0'});
    expect(r.show).toBe(true);
    expect(r.nocText).toBe(formatBalanceForDisplay('176282478348', 9, 2));
  });

  it('sums purchased + referral bonus (base units)', () => {
    const r = presaleAllocationDisplay({tokensPurchased: '100000000000', referralBonusTokens: '10000000000'});
    expect(r.show).toBe(true);
    // 100 NOC + 10 NOC = 110 NOC
    expect(r.nocText).toBe(formatBalanceForDisplay('110000000000', 9, 2));
  });

  it('is resilient to a malformed stored value', () => {
    expect(presaleAllocationDisplay({tokensPurchased: 'oops', referralBonusTokens: '0'}).show).toBe(false);
  });
});
