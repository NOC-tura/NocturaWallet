import {isHighValueTransfer, formatChecksumParts, TYPED_CONFIRM_SENTINEL} from '../transferRisk';
import type {TransferIntent} from '../../../types/transfer';

const base: TransferIntent = {
  mode: 'transparent',
  recipient: 'GabcDEF123456789xxxxxxxxxxxxxxxxxxxxxxQMr9',
  amount: '1',
  tokenMint: 'native',
  tokenSymbol: 'SOL',
  decimals: 9,
  priorityLevel: 'normal',
  createAta: false,
};

describe('isHighValueTransfer', () => {
  it('SOL over 5% of balance is high-value', () => {
    const r = isHighValueTransfer(base, {solBalance: 10_000_000_000n, tokenBalances: {}});
    expect(r.highValue).toBe(true);
    expect(r.percentOfBalance).toBe(10);
  });

  it('SOL over 5 SOL absolute is high-value even at <5% of a huge balance', () => {
    const r = isHighValueTransfer({...base, amount: '6'}, {solBalance: 10_000_000_000_000n, tokenBalances: {}});
    expect(r.highValue).toBe(true);
  });

  it('SOL under both thresholds is not high-value', () => {
    const r = isHighValueTransfer({...base, amount: '0.1'}, {solBalance: 100_000_000_000n, tokenBalances: {}});
    expect(r.highValue).toBe(false);
  });

  it('SPL over 5% of that token balance is high-value', () => {
    const noc: TransferIntent = {...base, tokenMint: 'NOCmint', tokenSymbol: 'NOC', amount: '60'};
    const r = isHighValueTransfer(noc, {solBalance: 0n, tokenBalances: {NOCmint: 1_000_000_000_000n}});
    expect(r.highValue).toBe(true);
  });

  it('zero balance: % clause cannot trigger, SOL absolute still can', () => {
    expect(isHighValueTransfer({...base, amount: '0.1'}, {solBalance: 0n, tokenBalances: {}}).highValue).toBe(false);
    expect(isHighValueTransfer({...base, amount: '6'}, {solBalance: 0n, tokenBalances: {}}).highValue).toBe(true);
  });
});

describe('formatChecksumParts', () => {
  it('returns first-6 and last-6 for a long address', () => {
    expect(formatChecksumParts('GabcDEF123456789ZZZZZZQMr9XXXXXX')).toEqual({head: 'GabcDE', tail: 'XXXXXX'});
  });
  it('passes short addresses through with empty tail', () => {
    expect(formatChecksumParts('short')).toEqual({head: 'short', tail: ''});
  });
});

describe('TYPED_CONFIRM_SENTINEL', () => {
  it('is the literal CONFIRM', () => expect(TYPED_CONFIRM_SENTINEL).toBe('CONFIRM'));
});
