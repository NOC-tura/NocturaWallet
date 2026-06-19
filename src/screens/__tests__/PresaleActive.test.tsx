import {canBuy, FEE_HEADROOM_SOL} from '../PresaleScreen';
import {MIN_PURCHASE_USD} from '../../modules/presale/presaleBuyModule';

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

  it('disables below the $25 minimum and surfaces a "Minimum $25" reason', () => {
    // 0.1 SOL * $200 = $20 < $25
    const res = canBuy({amount: '0.1', solUsd: SOL_USD, solBalance: 10});
    expect(res.enabled).toBe(false);
    expect(res.reason).toBe('Minimum $25');
  });

  it('disables when amount + fee headroom exceeds the balance', () => {
    // balance 1 SOL, amount 1 SOL → 1 + 0.001 > 1
    const res = canBuy({amount: '1', solUsd: SOL_USD, solBalance: 1});
    expect(res.enabled).toBe(false);
    expect(res.reason).toBe('Insufficient SOL balance');
  });

  it('enables when amount > 0, usd >= min, and balance covers amount + headroom', () => {
    // 0.2 SOL * $200 = $40 >= $25; balance 10 covers 0.2 + 0.001
    const res = canBuy({amount: '0.2', solUsd: SOL_USD, solBalance: 10});
    expect(res.enabled).toBe(true);
    expect(res.reason).toBeNull();
  });

  it('treats the $25 minimum as inclusive', () => {
    // exactly $25 at $200/SOL = 0.125 SOL
    const res = canBuy({amount: '0.125', solUsd: SOL_USD, solBalance: 10});
    expect(res.enabled).toBe(true);
  });

  it('exposes MIN_PURCHASE_USD = 25 and a small fee headroom', () => {
    expect(MIN_PURCHASE_USD).toBe(25);
    expect(FEE_HEADROOM_SOL).toBe(0.001);
  });
});
