import {proveShielded} from '../zkProverModule';

jest.mock('../../sslPinning/pinnedFetch', () => ({
  pinnedFetch: jest.fn(),
}));
import {pinnedFetch} from '../../sslPinning/pinnedFetch';

const mockFetch = pinnedFetch as jest.MockedFunction<typeof pinnedFetch>;

describe('proveShielded', () => {
  beforeEach(() => mockFetch.mockReset());

  it('POSTs the full params (incl noteSecret) and returns proofBytes+publicInputs', async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({
      status: 200,
      headers: {},
      json: async () => ({
        success: true,
        proofData: 'base64',
        proofBytes: 'ab'.repeat(256),
        publicInputs: ['1', '2', '3'],
      }),
      text: async () => '',
    }));

    const params = {commitment: '1', amount: '1000', mintHash: '2',
      pkRecipientHash: '3', noteSecret: '4'};
    const res = await proveShielded('deposit', params);

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({proofType: 'deposit', params}); // noteSecret NOT stripped
    expect(res.proofBytes).toBe('ab'.repeat(256));
    expect(res.publicInputs).toEqual(['1', '2', '3']);
  });

  it('throws on success:false', async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({
      status: 200, headers: {}, json: async () => ({success: false, error: 'bad'}),
      text: async () => '',
    }));
    await expect(proveShielded('deposit', {} as never)).rejects.toThrow('bad');
  });
});
