import {canBuy, FEE_HEADROOM_SOL} from '../PresaleScreen';
import {MIN_PURCHASE_USD, MAX_PURCHASE_USD} from '../../modules/presale/presaleBuyModule';

const SOL_USD = 200;
const base = {solUsd: SOL_USD, solBalance: 10, tokenBalance: 1000};

describe('canBuy (token-aware)', () => {
  it('SOL: zero/min/max/balance', () => {
    expect(canBuy({...base, paymentToken: 'SOL', amount: '0'}).enabled).toBe(false);
    expect(canBuy({...base, paymentToken: 'SOL', amount: '0.04'}).reason).toBe('Minimum $10'); // $8
    expect(canBuy({...base, paymentToken: 'SOL', amount: '300', solBalance: 1000}).reason).toBe('Maximum $50,000 per transaction');
    expect(canBuy({...base, paymentToken: 'SOL', amount: '1', solBalance: 1}).reason).toBe('Insufficient SOL balance');
    expect(canBuy({...base, paymentToken: 'SOL', amount: '0.2'}).enabled).toBe(true);
  });
  it('USDC/USDT: 1:1 USD min/max + token balance + SOL fee headroom', () => {
    expect(canBuy({...base, paymentToken: 'USDC', amount: '8'}).reason).toBe('Minimum $10');
    expect(canBuy({...base, paymentToken: 'USDC', amount: '60000', tokenBalance: 100000}).reason).toBe('Maximum $50,000 per transaction');
    expect(canBuy({...base, paymentToken: 'USDC', amount: '50', tokenBalance: 20}).reason).toBe('Insufficient USDC balance');
    expect(canBuy({...base, paymentToken: 'USDT', amount: '50', solBalance: 0}).reason).toBe('Need a little SOL for the network fee');
    expect(canBuy({...base, paymentToken: 'USDC', amount: '50'}).enabled).toBe(true);
    expect(canBuy({...base, paymentToken: 'USDC', amount: '10'}).enabled).toBe(true); // inclusive $10
  });
  it('exposes MIN $10 / MAX $50,000 + fee headroom', () => {
    expect(MIN_PURCHASE_USD).toBe(10);
    expect(MAX_PURCHASE_USD).toBe(50_000);
    expect(FEE_HEADROOM_SOL).toBe(0.001);
  });
});
