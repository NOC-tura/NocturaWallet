import type {TokenAccount} from '../types';
import {sumTokenBalancesByMint} from '../tokenBalances';

const MINT_A = 'A1111111111111111111111111111111111111111111';
const MINT_B = 'B1111111111111111111111111111111111111111111';

function acct(mint: string, amount: string, address = 'addr'): TokenAccount {
  return {mint, owner: 'owner', amount, decimals: 9, address};
}

describe('sumTokenBalancesByMint', () => {
  it('returns an empty map for no accounts', () => {
    expect(sumTokenBalancesByMint([])).toEqual({});
  });

  it('passes through a single account per mint', () => {
    expect(sumTokenBalancesByMint([acct(MINT_A, '100')])).toEqual({[MINT_A]: '100'});
  });

  it('SUMS multiple accounts for the same mint instead of overwriting', () => {
    // The wallet holds tokens in non-canonical accounts, so several accounts
    // for one mint is the normal case, not an edge case.
    const accounts = [
      acct(MINT_A, '100', 'acct1'),
      acct(MINT_A, '60', 'acct2'),
      acct(MINT_B, '7', 'acct3'),
    ];
    expect(sumTokenBalancesByMint(accounts)).toEqual({
      [MINT_A]: '160',
      [MINT_B]: '7',
    });
  });

  it('does not let an empty account zero out a funded one', () => {
    // Regression: Object.fromEntries kept the LAST account, so a canonical but
    // empty ATA returned after the funded account displayed a balance of 0.
    const accounts = [acct(MINT_A, '100', 'funded'), acct(MINT_A, '0', 'emptyAta')];
    expect(sumTokenBalancesByMint(accounts)).toEqual({[MINT_A]: '100'});
  });

  it('sums exactly above Number.MAX_SAFE_INTEGER', () => {
    const big = '9007199254740993'; // 2^53 + 1
    expect(sumTokenBalancesByMint([acct(MINT_A, big), acct(MINT_A, big)])).toEqual({
      [MINT_A]: '18014398509481986',
    });
  });

  it('ignores accounts whose amount is not a valid integer string', () => {
    const accounts = [acct(MINT_A, '100'), acct(MINT_A, 'not-a-number')];
    expect(sumTokenBalancesByMint(accounts)).toEqual({[MINT_A]: '100'});
  });
});
