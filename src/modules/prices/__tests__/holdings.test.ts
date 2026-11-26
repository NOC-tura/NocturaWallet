import {buildHoldings} from '../holdings';
const NOC = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
describe('buildHoldings', () => {
  it('always includes SOL (native) and NOC, then other store tokens', () => {
    const h = buildHoldings({
      solBalance: '17027600000',
      nocBalance: '69119998000000000',
      tokenBalances: {[NOC]: '69119998000000000', USDCMINT: '13399619'},
      tokens: [
        {mint: NOC, symbol: 'NOC', name: 'Noctura', decimals: 9, trust: 'core'},
        {mint: 'USDCMINT', symbol: 'USDC', name: 'USD Coin', decimals: 6, trust: 'core'},
      ],
    });
    expect(h.find(x => x.mint === 'native')).toEqual({mint: 'native', amountRaw: '17027600000', decimals: 9});
    expect(h.find(x => x.mint === NOC)?.amountRaw).toBe('69119998000000000');
    expect(h.find(x => x.mint === 'USDCMINT')).toEqual({mint: 'USDCMINT', amountRaw: '13399619', decimals: 6});
    expect(h.filter(x => x.mint === NOC)).toHaveLength(1);
  });

  it('R6: a mint already summed in tokenBalances is one holding with that sum (no second summing here)', () => {
    const h = buildHoldings({
      solBalance: '1',
      nocBalance: '0',
      tokenBalances: {USDCMINT: '3500000'},
      tokens: [{mint: 'USDCMINT', symbol: 'USDC', name: 'USD Coin', decimals: 6, trust: 'core'}],
    });
    expect(h.filter(x => x.mint === 'USDCMINT')).toEqual([{mint: 'USDCMINT', amountRaw: '3500000', decimals: 6}]);
  });

  it('R7: wSOL is its own holding next to native SOL', () => {
    const WSOL = 'So11111111111111111111111111111111111111112';
    const h = buildHoldings({
      solBalance: '1000000000',
      nocBalance: '0',
      tokenBalances: {[WSOL]: '500000000'},
      tokens: [{mint: WSOL, symbol: 'wSOL', name: 'Wrapped SOL', decimals: 9, trust: 'core'}],
    });
    expect(h.find(x => x.mint === 'native')!.amountRaw).toBe('1000000000');
    expect(h.find(x => x.mint === WSOL)!.amountRaw).toBe('500000000');
  });
});
