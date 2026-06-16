import {fetchTokenMetadata} from '../tokenMetadata';

afterEach(() => {
  (global.fetch as jest.Mock | undefined)?.mockReset?.();
});

const dasResponse = (assets: unknown[]) => ({
  ok: true,
  status: 200,
  json: async () => ({jsonrpc: '2.0', id: 'meta', result: assets}),
});

describe('fetchTokenMetadata', () => {
  it('maps getAssetBatch assets to name/symbol/cdn_uri', async () => {
    global.fetch = jest.fn(async () =>
      dasResponse([
        {
          id: 'MINT_A',
          content: {
            metadata: {name: 'Bonk', symbol: 'BONK'},
            files: [{uri: 'https://x/y.png', cdn_uri: 'https://cdn.helius-rpc.com/img'}],
          },
        },
        null,
      ]),
    ) as unknown as typeof fetch;
    const r = await fetchTokenMetadata(['MINT_A', 'MINT_B']);
    expect(r.MINT_A).toEqual({name: 'Bonk', symbol: 'BONK', logoUri: 'https://cdn.helius-rpc.com/img'});
    expect(r.MINT_B).toBeUndefined();
  });

  it('leaves logoUri undefined when there is no cdn_uri (no arbitrary-host fallback)', async () => {
    global.fetch = jest.fn(async () =>
      dasResponse([{id: 'MINT_C', content: {metadata: {name: 'Foo', symbol: 'FOO'}, files: [{uri: 'https://x/y.png'}]}}]),
    ) as unknown as typeof fetch;
    const r = await fetchTokenMetadata(['MINT_C']);
    expect(r.MINT_C).toEqual({name: 'Foo', symbol: 'FOO', logoUri: undefined});
  });

  it('returns {} for an empty mint list without calling fetch', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    expect(await fetchTokenMetadata([])).toEqual({});
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws on a non-200 response', async () => {
    global.fetch = jest.fn(async () => ({ok: false, status: 500, json: async () => ({})})) as unknown as typeof fetch;
    await expect(fetchTokenMetadata(['MINT_A'])).rejects.toThrow();
  });
});
