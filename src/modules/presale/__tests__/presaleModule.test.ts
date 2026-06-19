import {fetchPresaleStats, fetchUserAllocation} from '../presaleModule';
import {pinnedFetch} from '../../sslPinning/pinnedFetch';
import {parseTokenAmount} from '../../../utils/parseTokenAmount';

jest.mock('../../sslPinning/pinnedFetch');
const mockPinned = pinnedFetch as jest.Mock;

afterEach(() => {
  mockPinned.mockReset();
  (global.fetch as jest.Mock | undefined)?.mockReset?.();
});

describe('fetchPresaleStats', () => {
  it('maps coordinator stage (0-indexed) to display stage + USD price + into-stage', async () => {
    mockPinned.mockResolvedValue({
      status: 200,
      json: async () => ({success: true, data: {currentStage: 0, totalNocSold: 839030.874670029, isPaused: false}}),
    });
    global.fetch = jest.fn() as unknown as typeof fetch;
    const s = await fetchPresaleStats();
    expect(s.displayStage).toBe(1);
    expect(s.pricePerNocUsd).toBe(0.1501);
    expect(s.isPaused).toBe(false);
    expect(s.stageCapacityBase).toBe((10_240_000n * 1_000_000_000n).toString());
    expect(s.soldInStageBase).toBe(parseTokenAmount('839030.874670029', 9).toString());
    expect(mockPinned).toHaveBeenCalledWith(expect.stringContaining('/stats'));
    expect(global.fetch).not.toHaveBeenCalled(); // pinned succeeded, no fallback
  });

  it('computes into-stage for a mid presale stage', async () => {
    mockPinned.mockResolvedValue({
      status: 200,
      json: async () => ({success: true, data: {currentStage: 2, totalNocSold: 21_000_000, isPaused: false}}),
    });
    const s = await fetchPresaleStats();
    expect(s.displayStage).toBe(3);
    expect(s.pricePerNocUsd).toBe(0.1945);
    // 21,000,000 − 2×10,240,000 = 520,000 NOC into stage 3
    expect(s.soldInStageBase).toBe(parseTokenAmount('520000', 9).toString());
  });

  it('falls back to a plain fetch to the same coordinator when the pinned fetch fails', async () => {
    mockPinned.mockRejectedValue(new Error('pin/transport fail'));
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({success: true, data: {currentStage: 0, totalNocSold: 839030.874670029, isPaused: false}}),
    })) as unknown as typeof fetch;
    const s = await fetchPresaleStats();
    expect(s.displayStage).toBe(1);
    expect(s.soldInStageBase).toBe(parseTokenAmount('839030.874670029', 9).toString());
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/stats'));
  });

  it('throws when both the pinned and the direct fetch fail', async () => {
    mockPinned.mockRejectedValue(new Error('pin fail'));
    global.fetch = jest.fn(async () => ({ok: false, status: 500, json: async () => ({})})) as unknown as typeof fetch;
    await expect(fetchPresaleStats()).rejects.toThrow();
  });
});

describe('fetchUserAllocation', () => {
  it('sums noc_amount and referral_bonus over recorded purchases', async () => {
    mockPinned.mockResolvedValue({
      status: 200,
      json: async () => ({
        success: true,
        data: {purchases: [
          {noc_amount: '176.282478348', referral_bonus: '0'},
          {noc_amount: '100', referral_bonus: '10'},
        ]},
      }),
    });
    const a = await fetchUserAllocation('Addr11111111111111111111111111111111111111');
    expect(a.tokensPurchasedBase).toBe((parseTokenAmount('176.282478348', 9) + parseTokenAmount('100', 9)).toString());
    expect(a.referralBonusBase).toBe(parseTokenAmount('10', 9).toString());
    expect(mockPinned).toHaveBeenCalledWith(expect.stringContaining('/user/Addr11111111111111111111111111111111111111'));
  });

  it('returns 0/0 for no purchases', async () => {
    mockPinned.mockResolvedValue({status: 200, json: async () => ({success: true, data: {purchases: []}})});
    const a = await fetchUserAllocation('Addr');
    expect(a).toEqual({tokensPurchasedBase: '0', referralBonusBase: '0'});
  });

  it('falls back to a plain fetch when the pinned fetch fails', async () => {
    mockPinned.mockRejectedValue(new Error('pin fail'));
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({success: true, data: {purchases: [{noc_amount: '50', referral_bonus: '0'}]}}),
    })) as unknown as typeof fetch;
    const a = await fetchUserAllocation('Addr');
    expect(a.tokensPurchasedBase).toBe(parseTokenAmount('50', 9).toString());
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/user/Addr'));
  });

  it('throws when both the pinned and the direct fetch fail', async () => {
    mockPinned.mockRejectedValue(new Error('pin fail'));
    global.fetch = jest.fn(async () => ({ok: false, status: 500, json: async () => ({})})) as unknown as typeof fetch;
    await expect(fetchUserAllocation('Addr')).rejects.toThrow();
  });
});
