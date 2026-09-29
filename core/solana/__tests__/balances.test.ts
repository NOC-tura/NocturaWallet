import {SPL_TOKEN_PROGRAM, WALLET_TOKENS, readWalletBalances, sumTokenBalancesByMint, tokenForMint} from '../balances';
import type {TokenAccountEntry} from '../rpc';

const OWNER = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const NOC = WALLET_TOKENS.NOC.mint as string;
const USDT = WALLET_TOKENS.USDT.mint as string;
const entry = (mint: string, amount: bigint, pubkey = 'Acc'): TokenAccountEntry => ({pubkey, mint, owner: OWNER, amount, decimals: 9});

describe('sumTokenBalancesByMint (moved from the app)', () => {
  it('sums every account per mint — a funded non-canonical account next to an empty ATA still counts', () => {
    expect(sumTokenBalancesByMint([{mint: NOC, amount: '13399619'}, {mint: NOC, amount: '0'}, {mint: USDT, amount: '5'}])).toEqual({[NOC]: '13399619', [USDT]: '5'});
  });

  it('sums beyond 2^53 exactly and skips a malformed amount', () => {
    expect(sumTokenBalancesByMint([{mint: NOC, amount: '9007199254740993'}, {mint: NOC, amount: '1'}, {mint: NOC, amount: 'x'}])).toEqual({[NOC]: '9007199254740994'});
  });
});

describe('the wallet tokens', () => {
  it('are read under the classic SPL Token program — Token-2022 holdings are out of scope', () => {
    expect(SPL_TOKEN_PROGRAM).toBe('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
  });

  it('are SOL, NOC, USDC and USDT with their decimals', () => {
    expect(WALLET_TOKENS).toEqual({
      SOL: {mint: null, decimals: 9},
      NOC: {mint: 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW', decimals: 9},
      USDC: {mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6},
      USDT: {mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6},
    });
    expect(tokenForMint(USDT)).toBe('USDT');
    expect(tokenForMint(OWNER)).toBeNull();
  });
});

describe('readWalletBalances', () => {
  it('reads SOL and the three tokens with two calls, token accounts by program, summed per mint', async () => {
    const asked: unknown[] = [];
    const reader = {
      getBalance: async () => 5n,
      getTokenAccountsByOwner: async (_owner: string, filter: {mint: string} | {programId: string}) => {
        asked.push(filter);
        return [entry(NOC, 10n, 'a'), entry(NOC, 3n, 'b'), entry(USDT, 7n, 'c'), entry(OWNER, 99n, 'd')];
      },
    };
    expect(await readWalletBalances(reader, OWNER)).toEqual({sol: 5n, noc: 13n, usdc: 0n, usdt: 7n});
    expect(asked).toEqual([{programId: SPL_TOKEN_PROGRAM}]);
  });
});
