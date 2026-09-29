import {HISTORY_PAGE_SIZE, TX_MIN_INTERVAL_MS, createHistory} from '../history';
import {fakeReader} from './fakeDeps';

const OWNER = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const solSend = {
  blockTime: 5,
  meta: {err: null, fee: 5000, preBalances: [2_000_000, 0], postBalances: [995_000, 1_000_000], preTokenBalances: [], postTokenBalances: []},
  transaction: {message: {accountKeys: [{pubkey: OWNER}, {pubkey: 'Other'}], instructions: []}},
};

describe('history', () => {
  it('pages by signature, decodes each, paces getTransaction to ≤ 2 per second and caches', async () => {
    const sleeps: number[] = [];
    const fetched: string[] = [];
    const asked: unknown[] = [];
    const reader = fakeReader({
      getSignaturesForAddress: async (_a, opts) => (asked.push(opts), [{signature: 's1', blockTime: 5, err: null}, {signature: 's2', blockTime: 4, err: null}, {signature: 's3', blockTime: 3, err: null}]),
      getTransaction: async sig => (fetched.push(sig), sig === 's3' ? null : solSend),
    });
    const history = createHistory({reader, now: () => 0, sleep: async ms => void sleeps.push(ms)});
    const page = await history.page(OWNER);
    expect(page.map(e => [e.signature, e.kind, e.amount])).toEqual([['s1', 'sent', '1000000'], ['s2', 'sent', '1000000']]);
    expect(page[0]?.feeLamports).toBe('5000');
    expect(sleeps).toEqual([TX_MIN_INTERVAL_MS, TX_MIN_INTERVAL_MS]);
    expect(asked).toEqual([{limit: HISTORY_PAGE_SIZE}]);
    await history.page(OWNER, 's1');
    expect(fetched).toEqual(['s1', 's2', 's3', 's3']);
    expect(asked[1]).toEqual({limit: HISTORY_PAGE_SIZE, before: 's1'});
    expect(TX_MIN_INTERVAL_MS).toBeGreaterThanOrEqual(500);
  });
});
