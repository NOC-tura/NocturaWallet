import {fetchReferralStats, buildReferralLink} from '../referralModule';
import * as client from '../../backend/coordinatorClient';

describe('buildReferralLink', () => {
  it('builds an address-based ?ref link', () => {
    expect(buildReferralLink('ABC123')).toBe('https://noc-tura.io?ref=ABC123');
  });
});

describe('fetchReferralStats', () => {
  it('parses a success payload', async () => {
    jest.spyOn(client, 'getCoordinatorJson').mockResolvedValue({
      success: true,
      data: {totalReferrals: 3, totalBaseBonusNoc: 10, totalExtraBonusNoc: 5,
        totalBonusNoc: 15, totalReferredNoc: 100, totalReferredUsd: 25.5, tierBonusCount: 1},
    });
    const r = await fetchReferralStats('ABC');
    expect(r.totalReferrals).toBe(3);
    expect(r.totalBonusNoc).toBe(15);
    expect(r.totalReferredUsd).toBe(25.5);
  });

  it('coerces missing fields to 0', async () => {
    jest.spyOn(client, 'getCoordinatorJson').mockResolvedValue({success: true, data: {}});
    const r = await fetchReferralStats('ABC');
    expect(r.totalReferrals).toBe(0);
    expect(r.totalBonusNoc).toBe(0);
  });

  it('throws on success:false', async () => {
    jest.spyOn(client, 'getCoordinatorJson').mockResolvedValue({success: false});
    await expect(fetchReferralStats('ABC')).rejects.toThrow();
  });
});
