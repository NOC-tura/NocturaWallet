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
});
