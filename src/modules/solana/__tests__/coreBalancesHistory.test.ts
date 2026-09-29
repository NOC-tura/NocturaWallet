import {sumTokenBalancesByMint as viaShim} from '../tokenBalances';
import {WALLET_TOKENS, sumTokenBalancesByMint} from '../../../../core/solana/balances';
import {decodeHistoryEntry} from '../../../../core/solana/history';

const NOC = WALLET_TOKENS.NOC.mint as string;
const OWNER = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';

describe('core/solana/{balances,history}, as the app imports them', () => {
  it('the shim and core are one function, summing across non-canonical accounts', () => {
    expect(viaShim).toBe(sumTokenBalancesByMint);
    expect(viaShim([{mint: NOC, amount: '5'}, {mint: NOC, amount: '13399619'}])).toEqual({[NOC]: '13399624'});
  });

  it('decodes a SOL send under the app runner', () => {
    const tx = {
      blockTime: 1,
      meta: {err: null, fee: 5000, preBalances: [2_000_000, 0], postBalances: [995_000, 1_000_000], preTokenBalances: [], postTokenBalances: []},
      transaction: {message: {accountKeys: [{pubkey: OWNER}, {pubkey: 'Other'}], instructions: []}},
    };
    expect(decodeHistoryEntry(OWNER, 's', tx)).toMatchObject({kind: 'sent', token: 'SOL', amount: 1_000_000n});
  });
});
