import {ago, agoLong, approxSol, clock, dateSection, feeUsd, stamp, shortAddress, showAmount, showFee, showSol, twoGroups, usdParts} from '../format';
import {valuation} from '../valuation';

// The words and numbers the screens print, from one place.
describe('format', () => {
  // Plan-1 ruling L6, now shared by Home and #40 (plan-2 review M1): a SOL equivalent is truncated.
  it('approxSol truncates to the cent of a SOL, never rounds up', () => {
    expect(approxSol(10_112.52, 150)).toBe('≈ 67.41 SOL');
    expect(approxSol(20_225.05, 150)).toBe('≈ 134.83 SOL');
    expect(approxSol(299.99, 100)).toBe('≈ 2.99 SOL');
    expect(approxSol(0, 150)).toBe('≈ 0.00 SOL');
  });

  it('token amounts as the design prints them, truncated', () => {
    expect(showAmount('SOL', 62_482_199_999n)).toBe('62.4821');
    expect(showAmount('NOC', 4_200_000_000_000n)).toBe('4,200.00');
    expect(showAmount('USDC', 740_219_999n)).toBe('740.21');
    expect(showSol(5_000n)).toBe('0.000005');
  });

  // Task 17 fix round 1 (C8, C9; review L7): #27's fee line as index.html draws it — "0.000 005 SOL ·
  // $0.0007" (lines 12136, 12197). The design groups with a plain U+0020 space, checked byte for byte.
  it('the fee line only: fraction digits in groups of three, and its dollars to four places, truncated', () => {
    expect(showFee(5_000n)).toBe('0.000 005');
    expect(showFee(1_234_567n)).toBe('0.001 234 567');
    expect(showFee(10_000n)).toBe('0.000 01');
    expect(showFee(1_500_000_000n)).toBe('1.5');
    expect(showFee(0n)).toBe('0');
    expect(showFee(5_000n)).not.toContain('\u2009');
    // Other amounts are unchanged.
    expect(showSol(5_000n)).toBe('0.000005');
    expect(showAmount('SOL', 62_482_199_999n)).toBe('62.4821');
    expect(feeUsd(0.000745)).toBe('$0.0007');
    expect(feeUsd(0.00075)).toBe('$0.0007');
    expect(feeUsd(0.0123)).toBe('$0.01');
    expect(feeUsd(null)).toBe('—');
    // A fee that is not zero never reads as $0.0000 (plan-3 review L3); zero itself does.
    expect(feeUsd(0.0000075)).toBe('< $0.0001');
    expect(feeUsd(0)).toBe('$0.0000');
  });

  it('the hero’s dollars and cents, floored', () => {
    expect(usdParts(14_881.199)).toEqual({whole: '$14,881', cents: '.19'});
    expect(usdParts(0.5)).toEqual({whole: '$0', cents: '.50'});
  });

  it('addresses in lists: four … four; in the switcher: two groups', () => {
    const a = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
    expect(shortAddress(a)).toBe('HAgk…Kpqk');
    expect(twoGroups(a)).toBe('HAgk 14Jp…');
  });

  it('ages and clock times', () => {
    expect(ago(0, 2_000)).toBe('2 s ago');
    expect(ago(0, 120_000)).toBe('2 min ago');
    expect(ago(0, 7_200_000)).toBe('2 h ago');
    expect(ago(0, 3 * 86_400_000)).toBe('3 d ago');
    expect(agoLong(0, 138_000)).toBe('2 min 18 s ago');
    expect(clock(new Date(2026, 0, 2, 9, 41, 13).getTime())).toBe('09:41:13');
    // Long ages fall back to the short form: "3 d ago", never "4320 min 0 s ago".
    expect(agoLong(0, 7_205_000)).toBe('2 h ago');
    expect(agoLong(0, 3 * 86_400_000)).toBe('3 d ago');
    // A clock time alone today; with the day when it is not today (a "Stale · 09:41:13" from days ago).
    const synced = new Date(2026, 0, 2, 9, 41, 13).getTime();
    expect(stamp(synced, new Date(2026, 0, 2, 18, 0).getTime())).toBe('09:41:13');
    expect(stamp(synced, new Date(2026, 0, 5, 8, 0).getTime())).toBe('Jan 2, 09:41:13');
  });

  it('date sections, local calendar days', () => {
    const now = new Date(2026, 4, 8, 15, 0).getTime();
    expect(dateSection(new Date(2026, 4, 8, 9, 14).getTime(), now)).toBe('TODAY · MAY 8');
    expect(dateSection(new Date(2026, 4, 7, 23, 59).getTime(), now)).toBe('YESTERDAY · MAY 7');
    expect(dateSection(new Date(2026, 4, 4, 12).getTime(), now)).toBe('THIS WEEK');
    expect(dateSection(new Date(2026, 4, 1, 12).getTime(), now)).toBe('THIS MONTH');
    expect(dateSection(new Date(2026, 3, 20, 12).getTime(), now)).toBe('APRIL 2026');
    expect(dateSection(null, now)).toBe('TODAY · MAY 8');
  });
});

describe('valuation (parent spec §4, as web/)', () => {
  const b = {sol: 62_482_100_000n, noc: 4_200_000_000_000n, usdc: 740_210_000n, usdt: 0n};

  it('the total is SOL + USDC + USDT at market; NOC at the stage price, beside it, never in it', () => {
    const v = valuation(b, {sol: 150, usdc: 1, usdt: 1, noc: 0.1501, at: 1});
    expect(v.total).toBeCloseTo(62.4821 * 150 + 740.21, 6);
    expect(v.rows.NOC).toMatchObject({usd: 4200 * 0.1501, basis: 'stage'});
    expect(v.rows.USDT.usd).toBe(0);
  });

  it('no price is null — never $0 — and a total with no market price at all is null', () => {
    const v = valuation(b, null);
    expect(v.total).toBeNull();
    expect(v.rows.SOL.usd).toBeNull();
    expect(v.rows.NOC.usd).toBeNull();
    expect(v.rows.USDT.usd).toBeNull();
    expect(valuation(b, {sol: null, usdc: 1, usdt: null, noc: null, at: 1}).total).toBeCloseTo(740.21, 6);
  });
});
