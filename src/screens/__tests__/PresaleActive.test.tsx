import {canBuy, FEE_HEADROOM_SOL} from '../PresaleScreen';
import {MIN_PURCHASE_USD, MAX_PURCHASE_USD} from '../../modules/presale/presaleBuyModule';

// Unit tests for the pure button-gating helper extracted from PresaleActive.
// Rendering the full screen pulls in Zustand + price hooks + navigation, so the
// gating logic lives in a tiny pure function that we test in isolation.

const SOL_USD = 200; // 1 SOL = $200

describe('canBuy', () => {
  it('disables when amount is zero / empty / NaN', () => {
    expect(canBuy({amount: '0', solUsd: SOL_USD, solBalance: 10}).enabled).toBe(false);
    expect(canBuy({amount: '', solUsd: SOL_USD, solBalance: 10}).enabled).toBe(false);
    expect(canBuy({amount: 'abc', solUsd: SOL_USD, solBalance: 10}).enabled).toBe(false);
  });

  it('disables below the $10 minimum and surfaces a "Minimum $10" reason', () => {
    // 0.04 SOL * $200 = $8 < $10
    const res = canBuy({amount: '0.04', solUsd: SOL_USD, solBalance: 10});
    expect(res.enabled).toBe(false);
    expect(res.reason).toBe('Minimum $10');
  });

  it('disables above the $50,000 maximum per transaction', () => {
    // 300 SOL * $200 = $60,000 > $50,000 (balance large enough to isolate the max check)
    const res = canBuy({amount: '300', solUsd: SOL_USD, solBalance: 1000});
    expect(res.enabled).toBe(false);
    expect(res.reason).toBe('Maximum $50,000 per transaction');
  });

  it('disables when amount + fee headroom exceeds the balance', () => {
    // balance 1 SOL, amount 1 SOL → 1 + 0.001 > 1
    const res = canBuy({amount: '1', solUsd: SOL_USD, solBalance: 1});
    expect(res.enabled).toBe(false);
    expect(res.reason).toBe('Insufficient SOL balance');
  });

  it('enables when amount > 0, usd in [min,max], and balance covers amount + headroom', () => {
    // 0.2 SOL * $200 = $40 (≥ $10, ≤ $50k); balance 10 covers 0.2 + 0.001
    const res = canBuy({amount: '0.2', solUsd: SOL_USD, solBalance: 10});
    expect(res.enabled).toBe(true);
    expect(res.reason).toBeNull();
  });

  it('treats the $10 minimum as inclusive', () => {
    // exactly $10 at $200/SOL = 0.05 SOL
    const res = canBuy({amount: '0.05', solUsd: SOL_USD, solBalance: 10});
    expect(res.enabled).toBe(true);
  });

  it('exposes MIN $10 / MAX $50,000 and a small fee headroom', () => {
    expect(MIN_PURCHASE_USD).toBe(10);
    expect(MAX_PURCHASE_USD).toBe(50_000);
    expect(FEE_HEADROOM_SOL).toBe(0.001);
  });
});
