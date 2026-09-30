import {HISTORY_PAGE_SIZE, MAX_CACHED, TX_MIN_INTERVAL_MS, createHistory} from '../history';
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
    const {items, next} = await history.page(OWNER);
    expect(items.map(e => [e.signature, e.kind, e.amount])).toEqual([['s1', 'sent', '1000000'], ['s2', 'sent', '1000000']]);
    expect(items[0]?.feeLamports).toBe('5000');
    // Three signatures, fewer than HISTORY_PAGE_SIZE: no further page.
    expect(next).toBeNull();
    expect(sleeps).toEqual([TX_MIN_INTERVAL_MS, TX_MIN_INTERVAL_MS]);
    expect(asked).toEqual([{limit: HISTORY_PAGE_SIZE}]);
    await history.page(OWNER, 's1');
    expect(fetched).toEqual(['s1', 's2', 's3', 's3']);
    expect(asked[1]).toEqual({limit: HISTORY_PAGE_SIZE, before: 's1'});
    expect(TX_MIN_INTERVAL_MS).toBeGreaterThanOrEqual(500);
  });

  // Review fix round 1, #1: a full signature page with an unindexed entry must not lose "Load more",
  // and the resume cursor must be the RPC page's own last signature — never derived from `items`.
  it('an unindexed signature does not shrink next: it is the getSignaturesForAddress page\'s last signature, not the last decoded item', async () => {
    const sigs = Array.from({length: HISTORY_PAGE_SIZE}, (_, i) => `s${i}`);
    const reader = fakeReader({
      getSignaturesForAddress: async () => sigs.map(signature => ({signature, blockTime: 5, err: null})),
      // The first signature is not indexed yet (getTransaction answers null); the rest decode fine.
      getTransaction: async sig => (sig === sigs[0] ? null : solSend),
    });
    const history = createHistory({reader, now: () => 0, sleep: async () => undefined});
    const {items, next} = await history.page(OWNER);
    expect(items).toHaveLength(HISTORY_PAGE_SIZE - 1);
    expect(next).toBe(sigs[sigs.length - 1]);
  });

  it('a full page of all-unindexed signatures: no items, but next is still set (Load more must still show)', async () => {
    const sigs = Array.from({length: HISTORY_PAGE_SIZE}, (_, i) => `u${i}`);
    const reader = fakeReader({
      getSignaturesForAddress: async () => sigs.map(signature => ({signature, blockTime: 5, err: null})),
      getTransaction: async () => null,
    });
    const history = createHistory({reader, now: () => 0, sleep: async () => undefined});
    const {items, next} = await history.page(OWNER);
    expect(items).toEqual([]);
    expect(next).toBe(sigs[sigs.length - 1]);
  });

  it('keeps at most MAX_CACHED entries: of 501, the oldest is fetched again and the newest is not', async () => {
    const sigs = Array.from({length: MAX_CACHED + 1}, (_, i) => `s${i}`);
    let answer = sigs;
    const fetched: string[] = [];
    const reader = fakeReader({
      getSignaturesForAddress: async () => answer.map(signature => ({signature, blockTime: 5, err: null})),
      getTransaction: async sig => (fetched.push(sig), solSend),
    });
    const history = createHistory({reader, now: () => 0, sleep: async () => undefined});
    expect((await history.page(OWNER)).items).toHaveLength(MAX_CACHED + 1);
    expect(fetched).toHaveLength(MAX_CACHED + 1);
    answer = [`s${MAX_CACHED}`];
    await history.page(OWNER);
    expect(fetched).toHaveLength(MAX_CACHED + 1); // the newest is still cached
    answer = ['s0'];
    await history.page(OWNER);
    expect(fetched.slice(MAX_CACHED + 1)).toEqual(['s0']); // the oldest was evicted
  });

  it('a malformed getTransaction body decodes to "other" without throwing', async () => {
    for (const body of [{}, 'garbage', 42, [], {meta: 'x', transaction: {message: {accountKeys: 'y'}}}]) {
      const reader = fakeReader({
        getSignaturesForAddress: async () => [{signature: 's1', blockTime: 5, err: null}],
        getTransaction: async () => body,
      });
      const [entry] = (await createHistory({reader, now: () => 0, sleep: async () => undefined}).page(OWNER)).items;
      expect(entry).toMatchObject({signature: 's1', kind: 'other', token: null, amount: null, feeLamports: '0', failed: false});
    }
  });
});
