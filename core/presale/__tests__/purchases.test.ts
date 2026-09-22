import {parsePurchases, fetchPurchases} from '../purchases';

/** A row shaped like the live endpoint's, captured from it on 2026-09-22. */
const row = (over: Record<string, unknown> = {}) => ({
  tx_hash: '5fUCBTqKY12ChRgktmUM7Ad4NWbysmk44WKfQkVNWfJgLpuZz9pXiwx7NoqHBrF3UVfind9ZbzYdLDZVB1baJqwS',
  solana_tx_hash: '5fUCBTqKY12ChRgktmUM7Ad4NWbysmk44WKfQkVNWfJgLpuZz9pXiwx7NoqHBrF3UVfind9ZbzYdLDZVB1baJqwS',
  payment_token: 'USDC',
  payment_amount: '10.500000000000000000',
  noc_amount: '69.953364424',
  usd_value: '10.50',
  stage: 1,
  status: 'confirmed',
  created_at: '2026-09-22T15:05:56.382Z',
  referral_bonus: '0.000000000',
  ...over,
});
const body = (purchases: unknown[]) => ({success: true, data: {purchases}});

describe('parsePurchases', () => {
  it('reads the live shape (positive control)', () => {
    const [p] = parsePurchases(body([row()]));
    expect(p?.signature).toMatch(/^5fUCBTqK/);
    expect(p?.paymentToken).toBe('USDC');
    expect(p?.paymentAmount).toBeCloseTo(10.5, 9);
    expect(p?.nocAmount).toBeCloseTo(69.953364424, 9);
    expect(p?.stage).toBe(1);
    expect(p?.status).toBe('confirmed');
  });

  it('drops a row with no signature rather than rendering it', () => {
    // The coordinator's own notes record purchases marked `completed` carrying no
    // signature. On a page whose purpose is proof, a row the reader cannot check is
    // worse than no row — they cannot tell it apart from a real one.
    expect(parsePurchases(body([row({tx_hash: '', solana_tx_hash: ''})]))).toEqual([]);
  });

  it('prefers solana_tx_hash, falling back to tx_hash', () => {
    expect(parsePurchases(body([row({solana_tx_hash: 'SOLANA_ONE'})]))[0]?.signature).toBe('SOLANA_ONE');
    expect(parsePurchases(body([row({solana_tx_hash: null, tx_hash: 'FALLBACK'})]))[0]?.signature).toBe('FALLBACK');
  });

  it('puts the newest first', () => {
    const out = parsePurchases(
      body([
        row({created_at: '2026-01-02T00:00:00Z', tx_hash: 'OLD', solana_tx_hash: 'OLD'}),
        row({created_at: '2026-09-22T00:00:00Z', tx_hash: 'NEW', solana_tx_hash: 'NEW'}),
      ]),
    );
    expect(out.map(p => p.signature)).toEqual(['NEW', 'OLD']);
  });

  it('survives a body that is not what we expect, without throwing', () => {
    // An empty list means "none". It must never come from a parse that gave up quietly on
    // something that WAS there — hence the positive control above.
    expect(parsePurchases(undefined)).toEqual([]);
    expect(parsePurchases({success: true})).toEqual([]);
    expect(parsePurchases({success: true, data: {purchases: 'not an array'}})).toEqual([]);
  });

  it('never turns an unparseable amount into NaN on screen', () => {
    const [p] = parsePurchases(body([row({noc_amount: 'oops'})]));
    expect(p?.nocAmount).toBe(0);
  });
});

describe('fetchPurchases', () => {
  it('asks the bare path — the base URL already carries /api/v1', async () => {
    const get = {get: async () => body([row()])};
    const spy = vi.spyOn(get, 'get');
    await fetchPurchases(get as never, 'ADDR');
    expect(spy).toHaveBeenCalledWith('/user/ADDR');
  });

  it('throws when the envelope is unsuccessful, so a failure cannot read as "none"', async () => {
    const get = {get: async () => ({success: false})};
    await expect(fetchPurchases(get as never, 'ADDR')).rejects.toThrow();
  });
});
