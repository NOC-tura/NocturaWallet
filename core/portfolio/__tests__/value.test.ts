import {valueHoldings, marketTotalUsd} from '../value';

const B = {sol: 2_000_000_000n, noc: 100_000_000_000n, usdc: 25_000_000n, usdt: null};
const P = {solana: 118.02, usdc: 0.999956, usdt: 0.999954};
const STAGE = 0.1501;

describe('valuing a holding', () => {
  it('values SOL, USDC and USDT at the market', () => {
    const v = valueHoldings(B, P, STAGE);
    expect(v.find(x => x.symbol === 'SOL')?.usd).toBeCloseTo(236.04, 2);
    expect(v.find(x => x.symbol === 'USDC')?.usd).toBeCloseTo(24.999, 2);
  });

  it('values NOC at the stage price and SAYS it is the stage price', () => {
    // The whole point. NOC is not listed and will not be until TGE, so a number beside a
    // NOC balance is a statement the market has never made. The basis travels with the
    // figure so the UI cannot render it as "worth" by accident.
    const noc = valueHoldings(B, P, STAGE).find(x => x.symbol === 'NOC');
    expect(noc?.usd).toBeCloseTo(100 * STAGE, 6);
    expect(noc?.basis).toBe('stage');
  });

  it('marks everything else as market', () => {
    for (const v of valueHoldings(B, P, STAGE).filter(x => x.symbol !== 'NOC')) {
      expect(v.basis).toBe('market');
    }
  });

  it('reports an unknown price as null, never as zero', () => {
    // "$0.00" and "we do not know" are different claims about someone's money.
    const v = valueHoldings(B, {}, STAGE);
    expect(v.find(x => x.symbol === 'SOL')?.usd).toBeNull();
  });

  it('leaves out a stablecoin that is not held, and keeps SOL and NOC at zero', () => {
    const v = valueHoldings({sol: 0n, noc: 0n, usdc: 0n, usdt: 0n}, P, STAGE);
    expect(v.map(x => x.symbol)).toEqual(['NOC', 'SOL']);
  });
});

describe('the headline total', () => {
  it('sums only market values — never the stage-priced NOC', () => {
    // Folding NOC in would produce one bold figure that is part market price and part a
    // price the project set for itself, with nothing in the number saying which is which.
    const v = valueHoldings(B, P, STAGE);
    const total = marketTotalUsd(v) as number;
    expect(total).toBeCloseTo(236.04 + 24.999, 1);
    expect(total).toBeLessThan(236.04 + 24.999 + 100 * STAGE);
  });

  it('is null when nothing has a market price, never $0.00', () => {
    expect(marketTotalUsd(valueHoldings(B, {}, STAGE))).toBeNull();
  });

  it('is null even when a stage-priced holding exists (the control)', () => {
    // Without this the previous case could pass because the list was empty rather than
    // because stage values are excluded.
    const v = valueHoldings({sol: null, noc: 100_000_000_000n, usdc: null, usdt: null}, {}, STAGE);
    expect(v).toHaveLength(1);
    expect(marketTotalUsd(v)).toBeNull();
  });
});
