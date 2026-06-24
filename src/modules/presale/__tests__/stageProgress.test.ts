import {stageProgressDisplay} from '../stageProgress';

describe('stageProgressDisplay', () => {
  it('hides when stage data is missing', () => {
    expect(
      stageProgressDisplay({soldInStage: null, stageCapacity: null, pricePerNoc: null}),
    ).toEqual({show: false, percent: 0, raisedText: '', capText: ''});
  });

  it('hides when the capacity is zero or the price is non-positive', () => {
    expect(
      stageProgressDisplay({
        soldInStage: '1000000000',
        stageCapacity: '0',
        pricePerNoc: '0.025',
      }).show,
    ).toBe(false);
    expect(
      stageProgressDisplay({
        soldInStage: '1000000000',
        stageCapacity: '200000000000000000',
        pricePerNoc: '0',
      }).show,
    ).toBe(false);
  });

  it('computes percent + USD raised/cap from NOC base units × price', () => {
    // 62,000,000 NOC sold of 200,000,000 NOC cap @ $0.025
    const r = stageProgressDisplay({
      soldInStage: '62000000000000000',
      stageCapacity: '200000000000000000',
      pricePerNoc: '0.025',
    });
    expect(r.show).toBe(true);
    expect(r.percent).toBe(31);
    expect(r.raisedText).toBe('$1.55M'); // 62M × 0.025 = $1.55M
    expect(r.capText).toBe('$5.00M'); // 200M × 0.025 = $5.00M
  });

  it('clamps the bar to 100% when sold exceeds capacity', () => {
    const r = stageProgressDisplay({
      soldInStage: '300000000000000000',
      stageCapacity: '200000000000000000',
      pricePerNoc: '0.025',
    });
    expect(r.percent).toBe(100);
  });

  it('formats small raised amounts in whole dollars (no abbreviation)', () => {
    // 1,000 NOC × $0.025 = $25
    const r = stageProgressDisplay({
      soldInStage: '1000000000000',
      stageCapacity: '200000000000000000',
      pricePerNoc: '0.025',
    });
    expect(r.raisedText).toBe('$25');
  });

  it('hides when a stored value is malformed', () => {
    expect(
      stageProgressDisplay({
        soldInStage: 'oops',
        stageCapacity: '200000000000000000',
        pricePerNoc: '0.025',
      }).show,
    ).toBe(false);
  });
});

import {stageSecondRow} from '../stageProgress';
import {PRESALE_STAGE_PRICES} from '../../../constants/presale';

describe('stageSecondRow', () => {
  // 855,276 NOC sold of 10,240,000 cap, stage 1
  const SOLD = '855276000000000'; // 855,276 NOC (9-dec)
  const CAP = '10240000000000000'; // 10,240,000 NOC

  it('computes next-stage price + % and NOC remaining at stage 1', () => {
    const r = stageSecondRow({currentStage: 1, soldInStage: SOLD, stageCapacity: CAP});
    expect(r.show).toBe(true);
    expect(r.isFinalStage).toBe(false);
    expect(r.nextPriceText).toBe(`$${PRESALE_STAGE_PRICES[1]}`); // $0.1723
    expect(r.nextPctText).toBe('+15%'); // (0.1723-0.1501)/0.1501 ≈ 14.8 → 15
    expect(r.nocLeftText).toBe('9.4M'); // 10.24M − 0.855M ≈ 9.38M (label added by the view)
  });

  it('marks the final stage (no next price)', () => {
    const r = stageSecondRow({
      currentStage: PRESALE_STAGE_PRICES.length,
      soldInStage: SOLD,
      stageCapacity: CAP,
    });
    expect(r.isFinalStage).toBe(true);
    expect(r.nextPriceText).toBe('');
    expect(r.nextPctText).toBe('');
  });

  it('defaults a null stage to stage 1', () => {
    const r = stageSecondRow({currentStage: null, soldInStage: SOLD, stageCapacity: CAP});
    expect(r.nextPriceText).toBe(`$${PRESALE_STAGE_PRICES[1]}`);
  });

  it('hides when stage capacity data is missing', () => {
    expect(
      stageSecondRow({currentStage: 1, soldInStage: null, stageCapacity: null}).show,
    ).toBe(false);
  });
});
