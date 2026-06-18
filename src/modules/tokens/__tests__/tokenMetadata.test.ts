import {fetchTokenMetadata} from '../tokenMetadata';
import {pinnedFetch} from '../../sslPinning/pinnedFetch';
import {API_ORIGIN} from '../../../constants/programs';

jest.mock('../../sslPinning/pinnedFetch');
const mockPinned = pinnedFetch as jest.Mock;

afterEach(() => {
  mockPinned.mockReset();
  (global.fetch as jest.Mock | undefined)?.mockReset?.();
});

const dasResponse = (assets: unknown[]) => ({
  ok: true,
  status: 200,
  json: async () => ({jsonrpc: '2.0', id: 'meta', result: assets}),
});

describe('fetchTokenMetadata (backend path)', () => {
  it('maps backend data and absolutizes the proxy image url', async () => {
    mockPinned.mockResolvedValue({
      status: 200,
      json: async () => ({
        success: true,
        data: {
          MINT_A: {name: 'Bonk', symbol: 'BONK', image: '/api/v1/wallet/img?url=https%3A%2F%2Fx%2Fy.png'},
          MINT_B: {name: 'Foo', symbol: 'FOO'},
        },
      }),
    });
    global.fetch = jest.fn() as unknown as typeof fetch;

    const r = await fetchTokenMetadata(['MINT_A', 'MINT_B']);
    expect(r.MINT_A).toEqual({
      name: 'Bonk',
      symbol: 'BONK',
      logoUri: `${API_ORIGIN}/api/v1/wallet/img?url=https%3A%2F%2Fx%2Fy.png`,
    });
    expect(r.MINT_B).toEqual({name: 'Foo', symbol: 'FOO', logoUri: undefined});
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns {} for an empty mint list without any network call', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    expect(await fetchTokenMetadata([])).toEqual({});
    expect(mockPinned).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('fetchTokenMetadata (direct fallback)', () => {
  it('falls back to Helius DAS (cdn_uri only) when the backend fails', async () => {
    mockPinned.mockRejectedValue(new Error('pin fail'));
    global.fetch = jest.fn(async () =>
      dasResponse([
        {
          id: 'MINT_A',
          content: {
            metadata: {name: 'Bonk', symbol: 'BONK'},
            files: [{uri: 'https://x/y.png', cdn_uri: 'https://cdn.helius-rpc.com/img'}],
          },
        },
      ]),
    ) as unknown as typeof fetch;

    const r = await fetchTokenMetadata(['MINT_A']);
    expect(r.MINT_A).toEqual({name: 'Bonk', symbol: 'BONK', logoUri: 'https://cdn.helius-rpc.com/img'});
    expect(global.fetch).toHaveBeenCalled();
  });

  it('throws when both backend and direct fail', async () => {
    mockPinned.mockRejectedValue(new Error('pin fail'));
    global.fetch = jest.fn(async () => ({ok: false, status: 500, json: async () => ({})})) as unknown as typeof fetch;
    await expect(fetchTokenMetadata(['MINT_A'])).rejects.toThrow();
  });
});
