import {buildReferralLink, fetchReferralStats} from '../index';
import type {JsonGetter} from '../../ports';

const jsonReturning = (body: unknown): JsonGetter => ({get: async () => body as never});
const ADDR = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';

describe('buildReferralLink', () => {
  it('matches the website form the presale already records', () => {
    expect(buildReferralLink(ADDR)).toBe(`https://noc-tura.io?ref=${ADDR}`);
  });
});

describe('fetchReferralStats', () => {
  it('reads the seven fields the coordinator actually returns', async () => {
    const stats = await fetchReferralStats(
      jsonReturning({
        success: true,
        data: {
          totalReferrals: 3,
          totalBaseBonusNoc: 10,
          totalExtraBonusNoc: 2.5,
          totalBonusNoc: 12.5,
          totalReferredNoc: 500,
          totalReferredUsd: 75,
          tierBonusCount: 1,
        },
      }),
      ADDR,
    );
    expect(stats.totalReferrals).toBe(3);
    expect(stats.totalBonusNoc).toBe(12.5);
    expect(stats.tierBonusCount).toBe(1);
  });

  it('renders a partial response as zeros, not undefined', async () => {
    const stats = await fetchReferralStats(jsonReturning({success: true, data: {totalReferrals: 2}}), ADDR);
    expect(stats.totalReferrals).toBe(2);
    expect(stats.totalBonusNoc).toBe(0);
    expect(Number.isNaN(stats.totalReferredUsd)).toBe(false);
  });

  it('throws on an unsuccessful envelope rather than showing an empty scoreboard', async () => {
    await expect(fetchReferralStats(jsonReturning({success: false}), ADDR)).rejects.toThrow();
    await expect(fetchReferralStats(jsonReturning({success: true}), ADDR)).rejects.toThrow();
  });
});
