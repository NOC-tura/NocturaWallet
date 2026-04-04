import {getRelayerLookupTables} from '../relayer';
import {pinnedFetch} from '../../sslPinning/pinnedFetch';

jest.mock('../../sslPinning/pinnedFetch');

describe('getRelayerLookupTables', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches lookup tables from relayer API', async () => {
    (pinnedFetch as jest.Mock).mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        tables: [{address: 'ALTaddress1', addresses: ['addr1', 'addr2']}],
      }),
    });

    const tables = await getRelayerLookupTables();
    expect(tables.length).toBe(1);
    expect(pinnedFetch).toHaveBeenCalledWith(expect.stringContaining('/v1/relayer/lookup-tables'));
  });

  it('returns empty array on API error', async () => {
    (pinnedFetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
    const tables = await getRelayerLookupTables();
    expect(tables).toEqual([]);
  });
});
