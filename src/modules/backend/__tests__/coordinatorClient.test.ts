import {getCoordinatorJson} from '../coordinatorClient';
import {pinnedFetch, SSLPinningError} from '../../sslPinning/pinnedFetch';

jest.mock('../../sslPinning/pinnedFetch', () => {
  const actual = jest.requireActual('../../sslPinning/pinnedFetch');
  return {...actual, pinnedFetch: jest.fn()};
});

const mockPinned = pinnedFetch as jest.Mock;
const mockFetch = jest.fn();
(global as unknown as {fetch: jest.Mock}).fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getCoordinatorJson', () => {
  it('returns the pinned response when pinning succeeds', async () => {
    mockPinned.mockResolvedValue({status: 200, json: async () => ({ok: true})});
    await expect(getCoordinatorJson('/stats')).resolves.toEqual({ok: true});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('REFUSES to fall back when the pin check fails', async () => {
    // The bare `catch` fired on ANY throw, including SSLPinningError, and
    // retried the same URL UNPINNED. An active MITM can force that: present a
    // cert that doesn't match SSL_PINS — or simply reset the pinned connection —
    // and the client downgrades itself. The path carries the user's transparent
    // address (/user/<addr>, /referral-stats/<addr>), so the downgrade is the
    // whole point of attacking it.
    mockPinned.mockRejectedValue(new SSLPinningError('pin failed', new Error('ssl')));

    await expect(getCoordinatorJson('/stats')).rejects.toBeInstanceOf(SSLPinningError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('still falls back on a genuine transport failure', async () => {
    // Pinning cannot have failed if the connection never got far enough to
    // present a certificate, so a DNS/offline error is not a downgrade signal.
    mockPinned.mockRejectedValue(new Error('Network request failed'));
    mockFetch.mockResolvedValue({ok: true, json: async () => ({ok: true})});

    await expect(getCoordinatorJson('/stats')).resolves.toEqual({ok: true});
    expect(mockFetch).toHaveBeenCalled();
  });

  it('does not fall back on a non-2xx from the pinned request', async () => {
    // A 500 from the coordinator is an answer, not a transport failure —
    // retrying it unpinned gains nothing and drops the protection.
    mockPinned.mockResolvedValue({status: 500, json: async () => ({})});

    await expect(getCoordinatorJson('/stats')).rejects.toThrow(/500/);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
