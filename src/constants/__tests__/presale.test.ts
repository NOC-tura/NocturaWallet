import {PRESALE_STAGE_PRICES, nocUsdPriceForStage} from '../presale';

describe('PRESALE_STAGE_PRICES', () => {
  it('has 10 stages starting at 0.1501', () => {
    expect(PRESALE_STAGE_PRICES).toHaveLength(10);
    expect(PRESALE_STAGE_PRICES[0]).toBe(0.1501);
    expect(PRESALE_STAGE_PRICES[9]).toBe(0.3499);
  });
});

describe('nocUsdPriceForStage', () => {
  it('returns the price for the given 1-indexed stage', () => {
    expect(nocUsdPriceForStage(1)).toBe(0.1501);
    expect(nocUsdPriceForStage(2)).toBe(0.1723);
  });
  it('defaults to stage 1 for null/out-of-range', () => {
    expect(nocUsdPriceForStage(null)).toBe(0.1501);
    expect(nocUsdPriceForStage(0)).toBe(0.1501);
    expect(nocUsdPriceForStage(99)).toBe(0.1501);
  });
});
