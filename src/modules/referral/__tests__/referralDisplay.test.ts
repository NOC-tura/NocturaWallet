import {referralStatsDisplay} from '../referralDisplay';

describe('referralStatsDisplay', () => {
  it('formats zero state', () => {
    const r = referralStatsDisplay({totalReferrals: 0, totalBaseBonusNoc: 0, totalExtraBonusNoc: 0,
      totalBonusNoc: 0, totalReferredNoc: 0, totalReferredUsd: 0, tierBonusCount: 0});
    expect(r).toEqual({referrals: '0', earnedNoc: '0.00', referredUsd: '$0.00'});
  });
  it('formats populated state (2dp NOC, USD)', () => {
    const r = referralStatsDisplay({totalReferrals: 12, totalBaseBonusNoc: 20, totalExtraBonusNoc: 12.4,
      totalBonusNoc: 32.4, totalReferredNoc: 1000, totalReferredUsd: 1234.5, tierBonusCount: 2});
    expect(r.referrals).toBe('12');
    expect(r.earnedNoc).toBe('32.40');
    expect(r.referredUsd).toBe('$1,234.50');
  });
});
